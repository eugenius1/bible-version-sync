import { ApiError, BOOKS, Standard } from "@bvs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getIndex = vi.fn();
const cached = new Map<number, unknown>();
vi.mock("../auth", () => ({ client: { getIndex: (id: number) => getIndex(id) } }));
vi.mock("../db", () => ({
  store: {
    getIndex: async (id: number) => cached.get(id),
    setIndex: async (id: number, index: unknown) => void cached.set(id, index),
  },
}));

const { resolveVersions } = await import("../versions");

describe("resolveVersions", () => {
  beforeEach(() => {
    getIndex.mockReset();
    cached.clear();
  });

  it("uses bundled counts without asking the API", async () => {
    const out = await resolveVersions([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "KJV", bibleId: 1 },
      { abbr: "SYNO", bibleId: 400 },
    ]);
    expect(out.map((v) => v.source)).toEqual(["verified", "scanned", "scanned"]);
    expect(getIndex).not.toHaveBeenCalled();
  });

  it("keeps settings saved under any name", async () => {
    // Settings from before counts were keyed by id carry the person's own names.
    const [mine] = await resolveVersions([{ abbr: "MY BIBLE", bibleId: 93 }]);
    const [lsg] = await resolveVersions([{ abbr: "LSG", bibleId: 93 }]);
    expect(mine.abbr).toBe("MY BIBLE");
    expect(mine.source).toBe("verified");
    expect([...mine.map.toCanon]).toEqual([...lsg.map.toCanon]);
  });

  it("reads the API index for other versions, once", async () => {
    getIndex.mockResolvedValue({ books: [{ id: "JHN", chapters: [{ id: "3", verses: [1, 2, 3] }] }] });
    const [first] = await resolveVersions([{ abbr: "X", bibleId: 999999 }]);
    const [again] = await resolveVersions([{ abbr: "X", bibleId: 999999 }]);
    expect(first.source).toBe("api-index");
    expect(again.source).toBe("api-index");
    expect(getIndex).toHaveBeenCalledTimes(1);
  });

  it("marks a saved version unsupported when its counts fit neither English nor Hebrew", async () => {
    // Russian Synodal counts, for a version YouVersion doesn't label.
    const rso = Standard.load().counts.rso;
    getIndex.mockResolvedValue({
      books: BOOKS.map((id) => ({
        id,
        chapters: rso[id].map((n, i) => ({ id: String(i + 1), verses: Array.from({ length: n }, (_, k) => k + 1) })),
      })),
    });
    const [v] = await resolveVersions([{ abbr: "RUS", bibleId: 999998 }]);
    expect(v.source).toBe("unsupported");
    expect(v.unfit).toBe(153);
    expect(v.map.unsupported).toBe(true);
    expect(v.map.chapters("PSA")).toEqual([]);
  });

  it("refuses a saved version whose chapters YouVersion ids PSA.1_1, whatever its numbering (#25)", async () => {
    const out = await resolveVersions([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "GNA2025", bibleId: 67 },
      { abbr: "TUKARA84", bibleId: 3404 },
      { abbr: "NR2006", bibleId: 4833 },
    ]);
    expect(out.map((v) => [v.source, v.reason])).toEqual([
      ["verified", undefined],
      ["unsupported", "chapter-ids"],
      ["unsupported", "chapter-ids"],
      ["unsupported", "chapter-ids"],
    ]);
    for (const v of out.slice(1)) expect(v.map.unsupported).toBe(true);
    expect(getIndex).not.toHaveBeenCalled();
  });

  it("doesn't cache a failure worth retrying, and doesn't assume numbering meanwhile", async () => {
    getIndex.mockRejectedValueOnce(new ApiError(503, "unavailable"));
    await expect(resolveVersions([{ abbr: "X", bibleId: 999997 }])).rejects.toThrow(ApiError);
    expect(cached.has(999997)).toBe(false);
    getIndex.mockResolvedValue({ books: [{ id: "JHN", chapters: [{ id: "3", verses: [1, 2, 3] }] }] });
    const [v] = await resolveVersions([{ abbr: "X", bibleId: 999997 }]);
    expect(v.source).toBe("api-index");
  });

  it("remembers an index the app key may not read", async () => {
    getIndex.mockRejectedValue(new ApiError(403, "forbidden"));
    const [first] = await resolveVersions([{ abbr: "X", bibleId: 999996 }]);
    const [again] = await resolveVersions([{ abbr: "X", bibleId: 999996 }]);
    expect(first.source).toBe("assumed");
    expect(again.source).toBe("assumed");
    expect(getIndex).toHaveBeenCalledTimes(1);
  });
});

import { ApiError, BOOKS, Standard } from "@bvs/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getIndex = vi.fn();
const cached = new Map<number, unknown>();
const useSuffixedChapters = vi.fn();
vi.mock("../auth", () => ({
  client: {
    getIndex: (id: number) => getIndex(id),
    useSuffixedChapters: (id: number, s: unknown) => useSuffixedChapters(id, s),
  },
}));
vi.mock("../db", () => ({
  store: {
    getIndex: async (id: number) => cached.get(id),
    setIndex: async (id: number, index: unknown) => void cached.set(id, index),
  },
}));

const { problemText, resolveVersions } = await import("../versions");
const { createI18n } = await import("../../i18n");

describe("resolveVersions", () => {
  beforeEach(() => {
    getIndex.mockReset();
    useSuffixedChapters.mockReset();
    cached.clear();
  });

  it("uses bundled counts without asking the API", async () => {
    const out = await resolveVersions([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "ESV", bibleId: 59 },
      { abbr: "BTI", bibleId: 313 },
    ]);
    expect(out.map((v) => v.source)).toEqual(["verified", "scanned", "scanned"]);
    expect(getIndex).not.toHaveBeenCalled();
  });

  it("tells the client which chapters YouVersion ids BOOK.<n>_1", async () => {
    // Bundled for NR2006; for a version that isn't, only its index says.
    getIndex.mockResolvedValue({ books: [{ id: "PSA", chapters: [{ id: "23_1", verses: [1, 2, 3, 4, 5, 6] }] }] });
    const [nr2006, other] = await resolveVersions([
      { abbr: "NR2006", bibleId: 4833 },
      { abbr: "X", bibleId: 999999 },
    ]);
    expect(other.source).toBe("api-index");
    expect(useSuffixedChapters.mock.calls).toEqual([
      [4833, nr2006.map.suffixed],
      [999999, { PSA: [23] }],
    ]);
    expect(Object.keys(nr2006.map.suffixed)).toEqual(["JOB", "PSA"]);
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

describe("problemText", () => {
  const en = createI18n("en");
  const fr = createI18n("fr");
  const limited = (retryAfter?: number) => Object.assign(new ApiError(429, "too many requests"), { retryAfter });

  it("phrases the failures a person can act on in their language, never the client's English", () => {
    expect(problemText(new ApiError(401, "sign-in expired"), fr)).toBe("votre connexion YouVersion a expiré. Reconnectez-vous.");
    expect(problemText(new ApiError(0, "Failed to fetch"), fr)).toMatch(/^YouVersion ne répond pas\./);
    expect(problemText(new ApiError(0, "Failed to fetch"), en)).not.toMatch(/Failed to fetch/);
  });

  it("says how long a rate limit lasts when YouVersion says, in whole minutes", () => {
    expect(problemText(limited(300), en)).toMatch(/Try again in 5 minutes\.$/);
    expect(problemText(limited(30), en)).toMatch(/Try again in 1 minute\.$/);
    expect(problemText(limited(), en)).toMatch(/Try again in a few minutes\.$/);
  });

  it("falls back to YouVersion's own message, then the status, for anything else", () => {
    expect(problemText(new ApiError(403, "not licensed"), en)).toBe("not licensed");
    expect(problemText(new ApiError(500, ""), en)).toBe("HTTP 500");
    expect(problemText(new TypeError("boom"), en)).toBe("TypeError: boom");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  applyPlan,
  buildVersionMap,
  chapterScope,
  emptyState,
  forgetVersion,
  planBook,
  readBook,
  runSync,
  type Highlight,
  type HighlightsApi,
  type SyncState,
  type SyncVersion,
} from "../src";

// Config order: AMP decides the color for blank verses when versions disagree.
const IDS: Record<string, number> = { AMP: 1588, NIV: 111, LSG: 93, S21: 152 };
const VERSIONS: SyncVersion[] = Object.entries(IDS).map(([abbr, id]) => ({
  abbr,
  bibleId: id,
  map: buildVersionMap(abbr, id).map,
}));

/** In-memory stand-in for the YouVersion highlights API. */
class FakeApi implements HighlightsApi {
  store: Record<number, Record<string, string>> = Object.fromEntries(Object.values(IDS).map((i) => [i, {}]));
  failReads = new Set<string>();
  rejectWrites = new Set<string>();
  writes = 0;

  hl(abbr: string, ref: string, color: string) {
    this.store[IDS[abbr]][ref] = color;
  }

  color(abbr: string, ref: string): string | null {
    return this.store[IDS[abbr]][ref] ?? null;
  }

  async getHighlights(bibleId: number, passageId: string): Promise<Highlight[]> {
    if (this.failReads.has(`${bibleId}:${passageId}`)) throw new ApiError(503, "boom", passageId);
    return Object.entries(this.store[bibleId])
      .filter(([p]) => p.startsWith(`${passageId}.`))
      .map(([p, c]) => ({ bible_id: bibleId, passage_id: p, color: c }));
  }

  async setHighlight(bibleId: number, passageId: string, color: string) {
    if (this.rejectWrites.has(`${bibleId}:${passageId}`)) throw new ApiError(422, "verse not in this version", passageId);
    this.writes++;
    this.store[bibleId][passageId] = color;
  }

  async deleteHighlight(bibleId: number, passageId: string) {
    this.writes++;
    delete this.store[bibleId][passageId];
  }
}

let api: FakeApi;
let state: SyncState;

async function sync(book: string, apply = true) {
  const current = await readBook(api, VERSIONS, book, { concurrency: 2 });
  const plan = planBook(book, VERSIONS, current, state);
  if (apply) await applyPlan(api, VERSIONS, plan, state);
  return plan;
}

const every = (ref: string) => Object.fromEntries(Object.keys(IDS).map((a) => [a, api.color(a, ref)]));

beforeEach(() => {
  api = new FakeApi();
  state = emptyState();
});

describe("sync", () => {
  it("copies highlights to the other versions with renumbering", async () => {
    api.hl("NIV", "MAL.4.5", "ffe066");
    api.hl("S21", "PSA.51.3", "a3d9ff"); // = English Psalm 51:1
    await sync("MAL");
    await sync("PSA");
    expect([api.color("AMP", "MAL.4.5"), api.color("LSG", "MAL.4.5"), api.color("S21", "MAL.3.23")])
      .toEqual(["ffe066", "ffe066", "ffe066"]);
    expect([api.color("NIV", "PSA.51.1"), api.color("AMP", "PSA.51.1"), api.color("LSG", "PSA.51.3")])
      .toEqual(["a3d9ff", "a3d9ff", "a3d9ff"]);
  });

  it("is a no-op the second time", async () => {
    api.hl("LSG", "JHN.3.16", "ffe066");
    await sync("JHN");
    const writes = api.writes;
    expect((await sync("JHN")).actions).toEqual([]);
    expect(api.writes).toBe(writes);
  });

  it("keeps each version's own color and fills blanks with the first version's", async () => {
    api.hl("NIV", "ROM.8.28", "ffe066");
    api.hl("AMP", "ROM.8.28", "ff9999");
    const plan = await sync("ROM");
    expect(plan.differences).toMatchObject([{ canon: "ROM.8.28", ref: "ROM.8.28", winner: "AMP", color: "ff9999" }]);
    expect(every("ROM.8.28")).toEqual({ AMP: "ff9999", NIV: "ffe066", LSG: "ff9999", S21: "ff9999" });
    expect((await sync("ROM")).actions).toEqual([]);
  });

  it("reports differences using the first version's verse numbers", async () => {
    api.hl("AMP", "PSA.51.1", "ff9999");
    api.hl("S21", "PSA.51.3", "ffe066");
    const plan = await sync("PSA", false);
    expect(plan.differences).toMatchObject([{ canon: "PSA.51.3", ref: "PSA.51.1", colors: { AMP: "ff9999", S21: "ffe066" } }]);
  });

  it("never recolors an existing highlight on the first sync", async () => {
    api.hl("NIV", "JHN.1.1", "ffe066");
    api.hl("LSG", "JHN.1.1", "a3d9ff");
    await sync("JHN");
    expect(every("JHN.1.1")).toEqual({ AMP: "ffe066", NIV: "ffe066", LSG: "a3d9ff", S21: "ffe066" });
  });

  it("propagates a removal after the first sync", async () => {
    api.hl("NIV", "JHN.3.16", "ffe066");
    await sync("JHN");
    delete api.store[IDS.AMP]["JHN.3.16"];
    await sync("JHN");
    for (const a of Object.keys(IDS)) expect(api.color(a, "JHN.3.16"), a).toBeNull();
  });

  it("leaves versions with their own color alone on removal", async () => {
    api.hl("AMP", "JHN.1.1", "ff9999");
    api.hl("NIV", "JHN.1.1", "ffe066");
    await sync("JHN");
    delete api.store[IDS.AMP]["JHN.1.1"];
    await sync("JHN");
    expect(every("JHN.1.1")).toEqual({ AMP: null, NIV: "ffe066", LSG: null, S21: null });
  });

  it("recolors only the copies the sync made", async () => {
    api.hl("AMP", "JHN.1.1", "ff9999");
    api.hl("NIV", "JHN.1.1", "ffe066");
    await sync("JHN");
    api.hl("AMP", "JHN.1.1", "a3d9ff");
    await sync("JHN");
    expect(every("JHN.1.1")).toEqual({ AMP: "a3d9ff", NIV: "ffe066", LSG: "a3d9ff", S21: "a3d9ff" });
  });

  it("skips the whole book when a read fails", async () => {
    api.hl("NIV", "JHN.3.16", "ffe066");
    await sync("JHN");
    delete api.store[IDS.NIV]["JHN.3.16"];
    api.failReads.add(`${IDS.LSG}:JHN.3`);
    await expect(sync("JHN")).rejects.toThrow(ApiError);
    expect(api.color("AMP", "JHN.3.16")).toBe("ffe066"); // nothing removed
  });

  it("remembers rejected writes instead of treating them as removals", async () => {
    api.hl("NIV", "JHN.3.16", "ffe066");
    api.rejectWrites.add(`${IDS.S21}:JHN.3.16`);
    await sync("JHN");
    expect(state.unwritable.S21).toContain("JHN.3.16");
    expect((await sync("JHN")).actions).toEqual([]);
    expect(api.color("AMP", "JHN.3.16")).toBe("ffe066");
  });

  it("lands Job 41:1 in each version's numbering", async () => {
    api.hl("NIV", "JOB.41.1", "ffe066");
    await sync("JOB");
    expect([api.color("AMP", "JOB.41.1"), api.color("LSG", "JOB.40.20"), api.color("S21", "JOB.40.25")])
      .toEqual(["ffe066", "ffe066", "ffe066"]);
  });

  it("fills a version added after the first sync, without undoing removals", async () => {
    const three = VERSIONS.filter((v) => v.abbr !== "S21");
    const syncWith = async (versions: SyncVersion[]) => {
      const plan = planBook("JHN", versions, await readBook(api, versions, "JHN"), state);
      await applyPlan(api, versions, plan, state);
    };
    api.hl("AMP", "JHN.1.1", "ff9999");
    api.hl("NIV", "JHN.1.2", "ffe066");
    await syncWith(three);
    delete api.store[IDS.AMP]["JHN.1.2"]; // a real removal, made before S21 is added
    await syncWith(three);
    expect(every("JHN.1.2")).toEqual({ AMP: null, NIV: null, LSG: null, S21: null });

    await syncWith(VERSIONS); // S21 added now
    expect(api.color("S21", "JHN.1.1")).toBe("ff9999");
    expect(every("JHN.1.2")).toEqual({ AMP: null, NIV: null, LSG: null, S21: null });
    expect((await sync("JHN")).actions).toEqual([]);
  });

  it("forgets a removed version so re-adding it fills it again", async () => {
    api.hl("AMP", "JHN.1.1", "ff9999");
    await sync("JHN");
    delete api.store[IDS.S21]["JHN.1.1"]; // S21 wiped outside the app...
    forgetVersion(state, "S21"); // ...and was removed from the list and re-added
    await sync("JHN");
    expect(api.color("S21", "JHN.1.1")).toBe("ff9999");
  });

  it("writes nothing on a dry run", async () => {
    api.hl("NIV", "JHN.3.16", "ffe066");
    const plan = await sync("JHN", false);
    expect(plan.actions).toHaveLength(3);
    expect(api.writes).toBe(0);
    expect(state).toEqual(emptyState());
  });
});

describe("runSync", () => {
  it("limits a chapter scope to that chapter, reading the right local chapters", async () => {
    api.hl("AMP", "MAL.4.5", "ffe066");
    api.hl("AMP", "MAL.3.1", "ffe066");
    expect(chapterScope(VERSIONS, "MAL", 4).chapters.S21).toEqual(new Set([3]));
    await runSync({ api, versions: VERSIONS, scope: { kind: "chapter", book: "MAL", chapter: 4 }, state, apply: true });
    expect(api.store[IDS.S21]).toEqual({ "MAL.3.23": "ffe066" }); // 3:1 untouched
  });

  it("reports read failures per book and keeps going", async () => {
    api.hl("NIV", "RUT.1.16", "ffe066");
    api.failReads.add(`${IDS.S21}:JHN.1`);
    const s = await runSync({ api, versions: VERSIONS, scope: { kind: "books", books: ["JHN", "RUT"] }, state, apply: true });
    expect(s.failedBooks).toBe(1);
    expect(s.books[0].readError).toMatch(/503/);
    expect(api.color("S21", "RUT.1.16")).toBe("ffe066");
  });

  it("stops the whole run when the sign-in has expired", async () => {
    const orig = api.getHighlights.bind(api);
    api.getHighlights = async (id, p) => {
      if (p === "RUT.1") throw new ApiError(401, "sign-in expired", p);
      return orig(id, p);
    };
    const s = await runSync({ api, versions: VERSIONS, scope: { kind: "books", books: ["RUT", "JHN"] }, state, apply: true });
    expect(s.fatal?.reason).toBe("auth");
    expect(s.books.map((b) => b.book)).toEqual(["RUT"]);
  });

  it("blocks books that exceed the removal limit", async () => {
    for (let v = 1; v <= 5; v++) api.hl("NIV", `RUT.1.${v}`, "ffe066");
    await runSync({ api, versions: VERSIONS, scope: { kind: "books", books: ["RUT"] }, state, apply: true });
    for (let v = 1; v <= 5; v++) delete api.store[IDS.NIV][`RUT.1.${v}`];
    const s = await runSync({
      api, versions: VERSIONS, scope: { kind: "books", books: ["RUT"] }, state, apply: true, maxRemovals: 10,
    });
    expect(s.blockedBooks).toBe(1);
    expect(api.color("AMP", "RUT.1.1")).toBe("ffe066");
  });

  it("reports progress up to the total", async () => {
    const seen: number[] = [];
    await runSync({
      api, versions: VERSIONS, scope: { kind: "books", books: ["RUT"] }, state, apply: false,
      onProgress: (p) => seen.push(p.readDone / p.readTotal),
    });
    expect(seen.at(-1)).toBe(1);
  });
});

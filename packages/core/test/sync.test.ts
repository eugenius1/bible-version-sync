import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  Standard,
  VersionMap,
  applyPlan,
  buildVersionMap,
  chapterScope,
  emptyState,
  forgetVersion,
  migrateState,
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
/** Every version the tests use, by bible id, to read plans and snapshots by name. */
const NAMES: Record<number, string> = { ...Object.fromEntries(Object.entries(IDS).map(([a, id]) => [id, a])), 400: "SYNO", 73: "HFA" };
const named = <T>(o: Record<number, T> | undefined) =>
  o && Object.fromEntries(Object.entries(o).map(([id, v]) => [NAMES[Number(id)], v]));
const actionsByName = (plan: { actions: { version: number; op: string; local: string }[] }) =>
  plan.actions.map((a) => [NAMES[a.version], a.op, a.local]);

/** In-memory stand-in for the YouVersion highlights API. */
class FakeApi implements HighlightsApi {
  store: Record<number, Record<string, string>> = Object.fromEntries(Object.values(IDS).map((i) => [i, {}]));
  failReads = new Set<string>();
  rejectWrites = new Set<string>();
  /** Writes that fail once with a retryable error. */
  flakyWrites = new Set<string>();
  writes = 0;
  /** The bible id of every chapter read. */
  reads: number[] = [];

  hl(abbr: string, ref: string, color: string) {
    this.store[IDS[abbr]][ref] = color;
  }

  color(abbr: string, ref: string): string | null {
    return this.store[IDS[abbr]][ref] ?? null;
  }

  async getHighlights(bibleId: number, passageId: string): Promise<Highlight[]> {
    this.reads.push(bibleId);
    if (this.failReads.has(`${bibleId}:${passageId}`)) throw new ApiError(503, "boom", passageId);
    return Object.entries(this.store[bibleId])
      .filter(([p]) => p.startsWith(`${passageId}.`))
      .map(([p, c]) => ({ bible_id: bibleId, passage_id: p, color: c }));
  }

  async setHighlight(bibleId: number, passageId: string, color: string) {
    if (this.rejectWrites.has(`${bibleId}:${passageId}`)) throw new ApiError(422, "verse not in this version", passageId);
    if (this.flakyWrites.delete(`${bibleId}:${passageId}`)) throw new ApiError(503, "try again", passageId);
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
    expect(plan.differences).toMatchObject([{ canon: "ROM.8.28", ref: "ROM.8.28", winner: IDS.AMP, color: "ff9999" }]);
    expect(every("ROM.8.28")).toEqual({ AMP: "ff9999", NIV: "ffe066", LSG: "ff9999", S21: "ff9999" });
    expect((await sync("ROM")).actions).toEqual([]);
  });

  it("reports differences using the first version's verse numbers", async () => {
    api.hl("AMP", "PSA.51.1", "ff9999");
    api.hl("S21", "PSA.51.3", "ffe066");
    const plan = await sync("PSA", false);
    expect(plan.differences).toMatchObject([{ canon: "PSA.51.3", ref: "PSA.51.1" }]);
    expect(named(plan.differences[0].colors)).toEqual({ AMP: "ff9999", S21: "ffe066" });
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
    expect(state.unwritable[IDS.S21]).toContain("JHN.3.16");
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

  it("retries a newcomer's fill that failed retryably", async () => {
    const three = VERSIONS.filter((v) => v.abbr !== "S21");
    const syncWith = async (versions: SyncVersion[]) => {
      const plan = planBook("JHN", versions, await readBook(api, versions, "JHN"), state);
      await applyPlan(api, versions, plan, state);
      return plan;
    };
    api.hl("AMP", "JHN.1.1", "ff9999");
    await syncWith(three);
    api.flakyWrites.add(`${IDS.S21}:JHN.1.1`);
    await syncWith(VERSIONS); // S21 added; its fill fails once
    expect(api.color("S21", "JHN.1.1")).toBeNull();
    const retry = await syncWith(VERSIONS);
    expect(actionsByName(retry)).toEqual([["S21", "set", "JHN.1.1"]]);
    expect(api.color("S21", "JHN.1.1")).toBe("ff9999");
    expect((await syncWith(VERSIONS)).actions).toEqual([]);
  });

  it("forgets a removed version so re-adding it fills it again", async () => {
    api.hl("AMP", "JHN.1.1", "ff9999");
    await sync("JHN");
    delete api.store[IDS.S21]["JHN.1.1"]; // S21 wiped outside the app...
    forgetVersion(state, IDS.S21); // ...and was removed from the list and re-added
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

describe("a verse outside the synced books", () => {
  // CPDV's Esther additions map to Greek Esther (ESG), which no other version
  // reaches from Esther: a highlight there stays in CPDV.
  it("pairs with nothing", () => {
    const versions: SyncVersion[] = [111, 42].map((id) => ({ abbr: String(id), bibleId: id, map: buildVersionMap(String(id), id).map }));
    const current = { 111: new Map<string, string>(), 42: new Map([["EST.1.1", "ffe066"], ["EST.3.1", "ffe066"]]) };
    const plan = planBook("EST", versions, current, emptyState());
    // Mordecai's dream (CPDV 1:1) goes nowhere; Hebrew 1:1 (CPDV 3:1) reaches NIV.
    expect(plan.actions.map((a) => [a.version, a.op, a.local])).toEqual([[111, "set", "EST.1.1"]]);
  });
});

describe("runSync", () => {
  it("limits a chapter scope to that chapter, reading the right local chapters", async () => {
    api.hl("AMP", "MAL.4.5", "ffe066");
    api.hl("AMP", "MAL.3.1", "ffe066");
    expect(chapterScope(VERSIONS, "MAL", 4).chapters[IDS.S21]).toEqual(new Set([3]));
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

describe("a version whose mapping changed", () => {
  // Synodal Psalms as mapped before rso support (eng/org only: Psalm 91 taken
  // as English 91) and after (Psalm 91 is Hebrew 92).
  const scan = JSON.parse(
    readFileSync(new URL("../../../tools/versification-survey/data/counts.json", import.meta.url), "utf8"),
  );
  const psa: Record<number, number> = Object.fromEntries(scan["400"].counts.PSA.map((n: number, i: number) => [i + 1, n]));
  const std = Standard.load();
  const NIV: SyncVersion = { abbr: "NIV", bibleId: 111, map: buildVersionMap("NIV", 111).map };
  const synoOld: SyncVersion = { abbr: "SYNO", bibleId: 400, map: VersionMap.build("SYNO", std, { knownCounts: { PSA: psa } }) };
  const synoNew: SyncVersion = { ...synoOld, map: VersionMap.build("SYNO", std, { knownCounts: { PSA: psa }, label: "rso" }) };

  const run = async (versions: SyncVersion[]) => {
    const plan = planBook("PSA", versions, await readBook(api, versions, "PSA"), state);
    await applyPlan(api, versions, plan, state);
    return plan;
  };
  const syno = (r: string) => api.store[400][r] ?? null;

  beforeEach(() => {
    api.store[400] = {};
    api.hl("NIV", "PSA.91.1", "ffe066");
    api.hl("NIV", "PSA.92.1", "a3d9ff");
    api.hl("NIV", "PSA.99.1", "b2f2bb");
    api.store[400]["PSA.98.1"] = "b2f2bb"; // Hebrew 99:1, as NIV
  });

  it("is re-added rather than read as removals and recolours", async () => {
    expect(synoOld.map.toCanon.get("PSA.91.2")).not.toBe(synoNew.map.toCanon.get("PSA.91.2"));
    await run([NIV, synoOld]);
    expect(syno("PSA.91.1")).toBe("ffe066"); // the old mapping's fill, on the wrong psalm

    const plan = await run([NIV, synoNew]);
    expect(plan.remapped).toEqual([400]);
    expect(plan.actions.filter((a) => a.reason !== "fill")).toEqual([]);
    expect(api.color("NIV", "PSA.91.1")).toBe("ffe066");
    expect(api.color("NIV", "PSA.92.1")).toBe("a3d9ff");
    expect(api.color("NIV", "PSA.99.1")).toBe("b2f2bb");
    expect(syno("PSA.91.2")).toBe("a3d9ff"); // NIV 92:1 now lands on Synodal 91:2

    const again = await run([NIV, synoNew]);
    expect(again.remapped).toEqual([]);
    expect(again.actions).toEqual([]);

    // A real removal after the remap still propagates.
    delete api.store[400]["PSA.91.2"];
    const removal = await run([NIV, synoNew]);
    expect(actionsByName(removal)).toEqual([["NIV", "remove", "PSA.92.1"]]);
  });

  it("treats a snapshot without fingerprints as possibly remapped, once", async () => {
    await run([NIV, synoNew]);
    delete state.maps; // as saved before fingerprints existed
    api.hl("NIV", "PSA.99.1", "ff0000"); // would otherwise recolour Synodal 98:1
    const plan = await run([NIV, synoNew]);
    expect(plan.remapped.sort((a, b) => a - b)).toEqual([111, 400]);
    expect(plan.actions.filter((a) => a.reason !== "fill")).toEqual([]);

    api.hl("NIV", "PSA.99.1", "00ff00");
    const next = await run([NIV, synoNew]);
    expect(next.remapped).toEqual([]);
    delete api.store[111]["PSA.92.1"];
    const removal = await run([NIV, synoNew]);
    expect(actionsByName(removal)).toEqual([["SYNO", "remove", "PSA.91.2"]]);
  });

  it("retries a remapped version's fill that failed retryably", async () => {
    await run([NIV, synoOld]);
    api.store[111]["PSA.92.1"] = "a3d9ff";
    api.flakyWrites.add("400:PSA.91.2");
    await run([NIV, synoNew]); // the fill of Synodal 91:2 fails once
    expect(syno("PSA.91.2")).toBeNull();
    const retry = await run([NIV, synoNew]);
    expect(actionsByName(retry)).toEqual([["SYNO", "set", "PSA.91.2"]]);
    expect(syno("PSA.91.2")).toBe("a3d9ff");
  });

  it("drops the old snapshot for the whole book, and forgets fingerprints with the version", async () => {
    await run([NIV, synoOld]);
    await run([NIV, synoNew]);
    expect(state.maps?.[400]?.PSA).toBeTruthy();
    const stale = Object.entries(state.verses).filter(
      ([canon, colors]) => colors[400] && !synoNew.map.fromCanon.has(canon),
    );
    expect(stale).toEqual([]);
    forgetVersion(state, 400);
    expect(state.maps?.[400]).toBeUndefined();
  });
});

describe("a version moving from assumed numbering to bundled counts", () => {
  // Hfa (73) was assumed English before its counts were bundled; its Psalms
  // follow Hebrew numbering (titles are verse 1), so every titled psalm maps
  // differently once the counts are known.
  const std = Standard.load();
  const NIV: SyncVersion = { abbr: "NIV", bibleId: 111, map: buildVersionMap("NIV", 111).map };
  const assumed: SyncVersion = { abbr: "HFA", bibleId: 73, map: VersionMap.build("HFA", std) };
  const bundled = buildVersionMap("HFA", 73);
  const counted: SyncVersion = { ...assumed, map: bundled.map };

  const run = async (versions: SyncVersion[]) => {
    const plan = planBook("PSA", versions, await readBook(api, versions, "PSA"), state);
    await applyPlan(api, versions, plan, state);
    return plan;
  };

  it("only has blanks filled on the next sync", async () => {
    expect(bundled.source).toBe("scanned");
    expect(assumed.map.toCanon.get("PSA.51.3")).not.toBe(counted.map.toCanon.get("PSA.51.3"));
    api.store[73] = { "PSA.23.1": "a3d9ff" };
    api.hl("NIV", "PSA.51.1", "ffe066");
    api.hl("NIV", "PSA.51.2", "ffe066");
    await run([NIV, assumed]);
    expect(api.store[73]["PSA.51.1"]).toBe("ffe066"); // assumed English: a title, the wrong verse

    const plan = await run([NIV, counted]);
    expect(plan.remapped).toEqual([73]);
    expect(plan.actions.filter((a) => a.op === "remove" || a.reason !== "fill")).toEqual([]);
    expect(api.color("NIV", "PSA.51.1")).toBe("ffe066");
    expect(api.color("NIV", "PSA.51.2")).toBe("ffe066");
    expect(api.color("NIV", "PSA.23.1")).toBe("a3d9ff");
    expect(api.store[73]["PSA.51.3"]).toBe("ffe066"); // NIV 51:1, now in its place
  });
});

describe("a version whose numbering is unsupported", () => {
  const refused = (v: SyncVersion): SyncVersion => ({ ...v, map: VersionMap.unsupported(v.abbr) });
  const withNivRefused = VERSIONS.map((v) => (v.abbr === "NIV" ? refused(v) : v));
  const run = (versions: SyncVersion[], apply = true) =>
    runSync({ api, versions, scope: { kind: "books", books: ["JHN"] }, state, apply });

  beforeEach(async () => {
    api.hl("NIV", "JHN.3.16", "ffe066");
    api.hl("AMP", "JHN.1.1", "a3d9ff");
    await run(VERSIONS);
  });

  it("is neither read nor written, and none of its highlights read as removed", async () => {
    const niv = { ...api.store[IDS.NIV] };
    const snapshot = structuredClone(state);
    api.reads = [];
    api.writes = 0;
    // As if its highlights were gone: were it read, both would be removals.
    delete api.store[IDS.NIV]["JHN.3.16"];
    delete api.store[IDS.NIV]["JHN.1.1"];
    const summary = await run(withNivRefused);
    expect(summary.refused).toEqual([IDS.NIV]);
    expect(summary.removals).toBe(0);
    expect(summary.sets).toBe(0);
    expect(api.writes).toBe(0);
    expect(api.reads).not.toContain(IDS.NIV);
    expect(api.reads.length).toBeGreaterThan(0);
    expect(every("JHN.3.16")).toEqual({ AMP: "ffe066", NIV: null, LSG: "ffe066", S21: "ffe066" });
    expect(state).toEqual(snapshot);
    api.store[IDS.NIV] = niv;
  });

  it("isn't written when the others change, and keeps its snapshot", async () => {
    delete api.store[IDS.AMP]["JHN.3.16"];
    api.hl("LSG", "JHN.5.1", "b2f2bb");
    const niv = { ...api.store[IDS.NIV] };
    const summary = await run(withNivRefused);
    expect(summary.removals).toBe(2); // LSG's and S21's copies
    expect(api.store[IDS.NIV]).toEqual(niv);
    expect(named(state.verses["JHN.3.16"])).toEqual({ NIV: "ffe066" });
    expect(named(state.verses["JHN.5.1"])).toEqual({ AMP: "b2f2bb", LSG: "b2f2bb", S21: "b2f2bb" });
    expect(state.maps?.[IDS.NIV]?.JHN).toBeTruthy();
  });

  it("takes part again, from its snapshot, once it can be mapped", async () => {
    await run(withNivRefused);
    delete api.store[IDS.NIV]["JHN.3.16"]; // its own removal while it sat out
    const summary = await run(VERSIONS);
    expect(summary.refused).toEqual([]);
    expect(every("JHN.3.16")).toEqual({ AMP: null, NIV: null, LSG: null, S21: null });
  });

  it("is left out of planning even when passed to planBook directly", async () => {
    delete api.store[IDS.NIV]["JHN.3.16"];
    const current = await readBook(api, withNivRefused, "JHN");
    const plan = planBook("JHN", withNivRefused, current, state);
    expect(plan.actions).toEqual([]);
    expect(Object.keys(plan.maps)).not.toContain(String(IDS.NIV));
    expect(plan.remapped).toEqual([]);
  });

  it("does nothing when every version is refused", async () => {
    api.reads = [];
    const summary = await run(VERSIONS.map(refused));
    expect(summary.refused).toEqual(Object.values(IDS));
    expect(summary.books).toEqual([]);
    expect(api.reads).toEqual([]);
  });

  it("can be first in the list of a chapter sync", async () => {
    api.hl("AMP", "JHN.3.17", "ff9999");
    const versions = [refused(VERSIONS[1]), VERSIONS[0], VERSIONS[2], VERSIONS[3]];
    const summary = await runSync({ api, versions, scope: { kind: "chapter", book: "JHN", chapter: 3 }, state, apply: true });
    expect(summary.refused).toEqual([IDS.NIV]);
    expect(every("JHN.3.17")).toEqual({ AMP: "ff9999", NIV: null, LSG: "ff9999", S21: "ff9999" });
  });
});

describe("a snapshot saved when versions were keyed by name", () => {
  const ids = new Map(Object.entries(IDS));
  /** The snapshot as the app saved it before bible ids: every key a version's name. */
  const byName = (s: SyncState) => {
    const rename = <T>(o: Record<number, T>) => named(o) as Record<string, T>;
    return {
      verses: Object.fromEntries(Object.entries(s.verses).map(([k, colors]) => [k, rename(colors)])),
      members: Object.fromEntries(Object.entries(s.members).map(([k, list]) => [k, list.map((id) => NAMES[id])])),
      unwritable: rename(s.unwritable),
      maps: rename(s.maps ?? {}),
    } as unknown as SyncState;
  };

  beforeEach(async () => {
    api.hl("NIV", "JHN.3.16", "ffe066");
    api.hl("AMP", "JHN.1.1", "a3d9ff");
    api.rejectWrites.add(`${IDS.S21}:JHN.3.16`);
    await sync("JHN");
    delete state.keys;
  });

  it("carries over unchanged, so the next sync plans exactly as it would have", async () => {
    const saved = structuredClone(state);
    const migrated = migrateState(byName(state), ids);
    expect(migrated).toEqual({ ...saved, keys: "bibleId" });

    delete api.store[IDS.NIV]["JHN.3.16"]; // a real removal still propagates
    state = migrated;
    const plan = await sync("JHN", false);
    expect(actionsByName(plan).sort()).toEqual([["AMP", "remove", "JHN.3.16"], ["LSG", "remove", "JHN.3.16"]]);
  });

  it("is left alone once keyed by bible id", () => {
    const current = { ...structuredClone(state), keys: "bibleId" as const };
    expect(migrateState(current, new Map())).toEqual(current);
    expect(migrateState(undefined, ids)).toEqual(emptyState());
  });

  it("drops a version whose name it can't place, which then only has blanks filled", async () => {
    const withoutAmp = new Map([...ids].filter(([name]) => name !== "AMP"));
    state = migrateState(byName(state), withoutAmp);
    expect(Object.values(state.verses).some((colors) => IDS.AMP in colors)).toBe(false);
    expect(Object.values(state.members).some((list) => list.includes(IDS.AMP))).toBe(false);

    delete api.store[IDS.AMP]["JHN.3.16"]; // would be a removal if AMP's snapshot had carried over
    const plan = await sync("JHN", false);
    expect(plan.actions.filter((a) => a.reason !== "fill")).toEqual([]);
    expect(actionsByName(plan)).toEqual([["AMP", "set", "JHN.3.16"]]);
  });

  it("keeps fingerprints absent when they were never saved", () => {
    const old = byName(state);
    delete old.maps;
    expect(migrateState(old, ids).maps).toBeUndefined();
  });
});

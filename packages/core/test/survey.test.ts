import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOKS,
  MAX_UNFIT_CHAPTERS,
  Standard,
  VersionMap,
  buildVersionMap,
  builtinOverrides,
  isVerifiedVersion,
  parseRef,
  unfitChapters,
  versificationLabel,
  type ChapterCounts,
  type StdScheme,
} from "../src";

// The real engine over every chapter of the 54 versions scanned for
// docs/versification-survey.md, so what the survey measured stays true.
interface Scanned {
  abbr: string;
  vrs: StdScheme | null;
  counts: Record<string, number[]>;
}
const SCAN: Record<string, Scanned> = JSON.parse(
  readFileSync(new URL("../../../tools/versification-survey/data/counts.json", import.meta.url), "utf8"),
);

const knownCounts = (v: Scanned): ChapterCounts =>
  Object.fromEntries(Object.entries(v.counts).map(([b, cs]) => [b, Object.fromEntries(cs.map((n, i) => [i + 1, n]))]));

/** The scan as a /v1/bibles/{id}/index response, so buildVersionMap runs as in the app. */
const indexOf = (v: Scanned) => ({
  books: Object.entries(v.counts).map(([id, cs]) => ({
    id,
    chapters: cs.map((n, i) => ({ id: String(i + 1), verses: Array.from({ length: n }, (_, k) => k + 1) })),
  })),
});

/** Verses left unsynced, and verses mapped unlike the version's own label (see the survey's "Misplaced"). */
function measure(id: number, map: VersionMap) {
  const std = Standard.load();
  const v = SCAN[id];
  const known = knownCounts(v);
  const label = v.vrs ?? "eng";
  let skipped = 0;
  const offLabel: Record<string, number> = {};
  for (const b of BOOKS) {
    if (!known[b]) continue;
    for (const c of map.skippedChapters(b)) skipped += known[b][c];
    for (const [cs, n] of Object.entries(known[b])) {
      const c = Number(cs);
      // Only chapters whose count fits the label say what the label means there.
      if (n === 0 || std.count(label, b, c) !== n) continue;
      for (let verse = 1; verse <= n; verse++) {
        const local = `${b}.${c}.${verse}`;
        const got = map.toCanon.get(local);
        if (got !== undefined && got !== std.toCanon(label, local)) offLabel[`${b}.${c}`] = (offLabel[`${b}.${c}`] ?? 0) + 1;
      }
    }
  }
  return { skipped, offLabel };
}

// Verses skipped per version. Every version but SYNO, NRT and UBIO is
// eng/org, and was as in docs/versification-survey.md until the shared
// correction tables (data/overrides/shared/) mapped these chapters.
const SKIPPED: Record<number, number> = {
  1: 0, 13: 84, 21: 0, 27: 20, 46: 52, 48: 52, 51: 0, 59: 0, 73: 0, 75: 88, 81: 0, 83: 35, 88: 0, 89: 0,
  93: 0, 97: 55, 101: 22, 104: 0, 111: 0, 114: 0, 116: 0, 122: 25, 126: 0, 127: 0, 128: 0, 129: 0, 132: 350,
  133: 0, 141: 230, 142: 7, 144: 20, 149: 0, 151: 0, 152: 0, 157: 0, 164: 52, 188: 1000, 191: 0, 193: 172,
  212: 32, 306: 0, 319: 315, 399: 20, 463: 307, 1588: 0, 1608: 0, 1627: 0, 1628: 0, 1683: 0, 1840: 0,
  1990: 0,
  // Were 2,670, 3,052 and 2,329 with eng/org only.
  143: 0, 400: 0, 186: 0,
};

// Chapters where the engine deliberately departs from the label's table, each
// checked on the text (bible.com, Sept 2026):
const OFF_LABEL: Record<number, Record<string, number>> = {
  // NEH 7:68 (horses and mules) isn't in the Hebrew at all; rso/rsc fold it
  // into 7:67, eng into 7:68. The chapter uses eng, as NIV does, whose 7:68
  // is the same verse.
  143: { "NEH.7": 1 },
  400: { "NEH.7": 1 },
  // UBIO follows Hebrew order here; lxx's counts match by coincidence
  // (lxx Exodus 36:9ff is Hebrew 39:2ff, lxx Jeremiah 34 and 36 are Hebrew
  // 27 and 29). UBIO Jeremiah 36:1 is Jehoiakim's fourth year, the scroll.
  186: { "EXO.36": 27, "JER.34": 22, "JER.36": 32 },
};

describe("surveyed versions", () => {
  it("has a label for every scanned version", () => {
    for (const [id, v] of Object.entries(SCAN)) expect(versificationLabel(Number(id)), v.abbr).toBe(v.vrs);
  });

  it.each(Object.keys(SCAN).map(Number))("bible %i: skipped and off-label verses", (id) => {
    const v = SCAN[id];
    const { map } = buildVersionMap(v.abbr, id, indexOf(v));
    const { skipped, offLabel } = measure(id, map);
    expect(skipped, v.abbr).toBe(SKIPPED[id]);
    expect(offLabel, v.abbr).toEqual(OFF_LABEL[id] ?? {});
  });

  // What the app uses: the bundled exceptions, with no index to read.
  it.each(Object.keys(SCAN).map(Number))("bible %i: bundled counts map as the full scan does", (id) => {
    const v = SCAN[id];
    const bundled = buildVersionMap(v.abbr, id);
    expect(bundled.source, v.abbr).toBe(isVerifiedVersion(id) ? "verified" : "scanned");
    const full = buildVersionMap(v.abbr, id, indexOf(v)).map;
    // A book the version lacks (NABRE's Esther is the Greek ESG) is bundled
    // as chapters of 0 verses, so it isn't read. The scan leaves it out,
    // which the engine takes as unknown and fills in with assumed counts.
    const inScan = ([r]: [string, string]) => parseRef(r)[0] in v.counts;
    expect([...bundled.map.toCanon].filter(inScan), v.abbr).toEqual([...full.toCanon].filter(inScan));
    for (const b of BOOKS) {
      if (!(b in v.counts)) {
        expect(bundled.map.chapters(b), `${v.abbr} ${b}`).toEqual([]);
        continue;
      }
      expect(bundled.map.chapters(b), `${v.abbr} ${b}`).toEqual(full.chapters(b));
      expect(bundled.map.skippedChapters(b), `${v.abbr} ${b}`).toEqual(full.skippedChapters(b));
    }
    const { skipped, offLabel } = measure(id, bundled.map);
    expect(skipped, v.abbr).toBe(SKIPPED[id]);
    expect(offLabel, v.abbr).toEqual(OFF_LABEL[id] ?? {});
  });

  const ENG_ORG = Object.keys(SCAN).map(Number).filter((id) => SCAN[id].vrs === "eng" || SCAN[id].vrs === "org");

  it.each(ENG_ORG)("bible %i: maps exactly as without its label", (id) => {
    const v = SCAN[id];
    const std = Standard.load();
    const opts = { knownCounts: knownCounts(v), overrides: builtinOverrides(id) };
    const withLabel = VersionMap.build(v.abbr, std, { ...opts, label: v.vrs ?? undefined });
    const without = VersionMap.build(v.abbr, std, opts);
    expect([...withLabel.toCanon], v.abbr).toEqual([...without.toCanon]);
  });

  it("never mixes schemes on one canonical verse", () => {
    for (const id of [143, 186, 400]) {
      const m = buildVersionMap(SCAN[id].abbr, id, indexOf(SCAN[id])).map;
      for (const [canon, locals] of m.fromCanon) {
        const schemes = new Set(locals.map((l) => {
          const [b, c] = parseRef(l);
          return m.schemes[b][c];
        }));
        expect(schemes.size, `${SCAN[id].abbr} ${canon}`).toBe(1);
      }
    }
  });
});

describe("unsupported numbering", () => {
  const ids = Object.keys(SCAN).map(Number);
  const LABEL_ONLY = new Set(["rso", "rsc", "lxx", "vul"]);
  const unfit = (id: number) => unfitChapters(knownCounts(SCAN[id]), builtinOverrides(id));
  // A bible id with no label, correction table or bundled counts.
  const UNKNOWN = 999_999;

  it.each(ids)("bible %i: is never refused", (id) => {
    expect(buildVersionMap(SCAN[id].abbr, id).source).not.toBe("unsupported");
    expect(buildVersionMap(SCAN[id].abbr, id, indexOf(SCAN[id])).source).not.toBe("unsupported");
  });

  it("leaves every English or Hebrew numbered version well below the threshold, even unlabelled", () => {
    const worst = Math.max(...ids.filter((id) => !LABEL_ONLY.has(SCAN[id].vrs!)).map(unfit));
    expect(worst).toBe(35); // UKRK: 38 chapters, 3 of them described by shared correction tables
    expect(worst * 2).toBeLessThan(MAX_UNFIT_CHAPTERS + 1);
    for (const id of ids.filter((i) => !LABEL_ONLY.has(SCAN[i].vrs!))) {
      expect(buildVersionMap(SCAN[id].abbr, UNKNOWN, indexOf(SCAN[id])).source, SCAN[id].abbr).toBe("api-index");
    }
  });

  it.each([143, 186, 400])("bible %i: would be refused without its label", (id) => {
    expect(unfit(id)).toBeGreaterThan(MAX_UNFIT_CHAPTERS + 50);
    const unlabelled = buildVersionMap(SCAN[id].abbr, UNKNOWN, indexOf(SCAN[id]));
    expect(unlabelled.source).toBe("unsupported");
    expect(unlabelled.unfit).toBe(unfit(id));
    expect(unlabelled.map.unsupported).toBe(true);
    expect(BOOKS.flatMap((b) => unlabelled.map.chapters(b))).toEqual([]);
  });
});

describe("Synodal and Septuagint numbering", () => {
  const NIV = buildVersionMap("NIV", 111).map;
  const MAPS: Record<string, VersionMap> = Object.fromEntries(
    [400, 143, 186].map((id) => [SCAN[id].abbr, buildVersionMap(SCAN[id].abbr, id, indexOf(SCAN[id])).map]),
  );
  const across = (niv: string, abbr: string) => MAPS[abbr].fromCanon.get(NIV.toCanon.get(niv)!) ?? [];

  // Each pair was checked against the verse text on bible.com, Sept 2026.
  it.each([
    ["PSA.92.1", "SYNO", "PSA.91.2"], // "It is good to praise the LORD"
    ["PSA.92.1", "NRT", "PSA.91.2"],
    ["PSA.92.1", "UBIO", "PSA.91.2"],
    ["PSA.58.1", "SYNO", "PSA.57.2"], // "Do you rulers indeed speak justly?"
    ["PSA.58.1", "UBIO", "PSA.57.2"],
    ["PSA.63.1", "SYNO", "PSA.62.2"],
    ["PSA.99.1", "SYNO", "PSA.98.1"],
    ["PSA.112.1", "SYNO", "PSA.111.1"],
    ["PSA.116.1", "SYNO", "PSA.114.1"],
    ["PSA.116.1", "UBIO", "PSA.114.1"],
    ["PSA.130.1", "SYNO", "PSA.129.1"],
    ["PSA.134.1", "SYNO", "PSA.133.1"],
    ["DAN.5.31", "SYNO", "DAN.5.31"], // Darius receives the kingdom
    ["DAN.6.1", "SYNO", "DAN.6.1"], // 120 satraps
    ["DAN.6.1", "NRT", "DAN.6.1"],
    ["JER.34.1", "UBIO", "JER.34.1"],
    ["JER.36.1", "UBIO", "JER.36.1"],
    ["EXO.36.9", "UBIO", "EXO.36.9"],
    ["EXO.20.13", "UBIO", "EXO.20.13"], // "You shall not murder"
    ["DEU.5.17", "UBIO", "DEU.5.17"],
    ["EXO.21.16", "UBIO", "EXO.21.16"],
    ["NUM.26.1", "SYNO", "NUM.26.1"], // "After the plague"
    ["NUM.26.1", "NRT", "NUM.26.1"],
    ["REV.13.1", "SYNO", "REV.13.1"],
    ["1KI.22.43", "SYNO", "1KI.22.43"],
    ["1CH.12.4", "SYNO", "1CH.12.4"],
  ])("NIV %s -> %s %s", (niv, abbr, local) => {
    expect(across(niv, abbr)).toEqual([local]);
  });

  it("keeps NEH 7:68 with English versions", () => {
    // Horses and mules, missing from the Hebrew; eng folds 7:68-69 together,
    // and SYNO follows NIV there.
    expect(across("NEH.7.68", "SYNO")).toEqual(NIV.fromCanon.get(NIV.toCanon.get("NEH.7.68")!));
  });
});

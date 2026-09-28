import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOKS,
  Standard,
  VersionMap,
  buildVersionMap,
  builtinOverrides,
  isVerifiedVersion,
  parseRef,
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

// Verses skipped per version, as in docs/versification-survey.md. Every
// version but SYNO, NRT and UBIO is eng/org and must stay exactly as it was.
const SKIPPED: Record<number, number> = {
  1: 31, 13: 101, 21: 0, 27: 99, 46: 52, 48: 52, 51: 31, 59: 17, 73: 0, 75: 294, 81: 0, 83: 35, 88: 31, 89: 17,
  93: 0, 97: 86, 101: 39, 104: 0, 111: 0, 114: 31, 116: 0, 122: 97, 126: 0, 127: 0, 128: 17, 129: 17, 132: 412,
  133: 0, 141: 353, 142: 7, 144: 20, 149: 17, 151: 172, 152: 0, 157: 0, 164: 69, 188: 1065, 191: 31, 193: 485,
  212: 92, 306: 342, 319: 315, 399: 20, 463: 318, 1588: 0, 1608: 60, 1627: 17, 1628: 17, 1683: 17, 1840: 43,
  1990: 394,
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

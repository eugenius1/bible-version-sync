import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BOOKS,
  MAX_UNFIT_CHAPTERS,
  STD_SCHEMES,
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

// The real engine over every chapter of the versions scanned for
// docs/versification-survey.md, so what the survey measured stays true: the
// 54 widely used versions of the original survey and 54 more from the
// hand-made ranking (scripts/popular.mjs), all labelled, and 220 that
// YouVersion leaves unlabelled, scanned for label coverage: mostly a single
// Gospel, or Ruth and Jonah, plus 11 in languages where Synodal or Septuagint
// numbering is common.
interface Scanned {
  abbr: string;
  vrs: StdScheme | null;
  counts: Record<string, number[]>;
}
const SCAN: Record<string, Scanned> = JSON.parse(
  readFileSync(new URL("../../../tools/versification-survey/data/counts.json", import.meta.url), "utf8"),
);

/** The original survey's versions, all labelled. */
const SURVEYED = Object.keys(SCAN).map(Number).filter((id) => SCAN[id].vrs);
const UNLABELLED = Object.keys(SCAN).map(Number).filter((id) => !SCAN[id].vrs);
/**
 * Unlabelled versions whose counts no English or Hebrew numbering explains,
 * all Synodal or Septuagint numbered by their counts. In each, Psalm 22 is
 * "The Lord is my shepherd", Psalm 23 in English and Hebrew (bible.com, Sept
 * 2026). Mapped as English, their Psalms would land one psalm off.
 */
const REFUSED: Record<number, number> = {
  2419: 136, // BOTp, Bashkir Old Testament portions: rsc fits all 642 chapters
  2503: 187, // grcbrent, Brenton's Septuagint in Greek: lxx fits 901 of 907
  3918: 133, // AdyBBL, Adyghe: rsc fits 488 of 494
  4079: 132, // MAK2024PS, a Macedonian psalter: lxx fits all 151 psalms
};

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
  // The rest of the hand-made ranking (scripts/popular.mjs), scanned later
  // and given no correction tables: what they skip is the chapters that fit
  // no system, many of them ones a shared table describes in other versions.
  19: 0, 40: 49, 41: 317, 43: 0, 57: 31, 74: 0, 100: 17, 103: 17, 105: 0, 106: 300, 107: 0, 108: 0, 110: 17,
  123: 148, 138: 31, 139: 0, 140: 0, 146: 17, 165: 394, 167: 0, 177: 31, 195: 17, 197: 0, 199: 0, 205: 0,
  313: 0, 328: 394, 385: 0, 449: 31, 819: 100, 903: 31, 1276: 449, 1637: 17, 1638: 0, 1755: 108, 1818: 69,
  1819: 0, 1820: 0, 1930: 0, 1980: 0, 1996: 31, 2095: 0, 2195: 0, 2311: 0, 2645: 43, 2692: 17, 3269: 7,
  3368: 318, 3490: 206, 3803: 0, 4369: 17, 4639: 0, 4804: 118, 4869: 0,
};

// Chapters where the engine deliberately departs from the label's table, each
// checked on the text (bible.com, Sept 2026):
const OFF_LABEL: Record<number, Record<string, number>> = {
  // NEH 7:68 (horses and mules) isn't in the Hebrew at all; rso/rsc fold it
  // into 7:67, eng into 7:68. The chapter uses eng, as NIV does, whose 7:68
  // is the same verse.
  143: { "NEH.7": 1 },
  400: { "NEH.7": 1 },
  // The same verse in the other Synodal-numbered Russian versions: Synod
  // (167, rso), BTI (313, rsc) and CARS (385, rsc). Not read on the text:
  // the engine treats it as in SYNO and NRT, whose text was.
  167: { "NEH.7": 1 },
  313: { "NEH.7": 1 },
  385: { "NEH.7": 1 },
  // UBIO follows Hebrew order here; lxx's counts match by coincidence
  // (lxx Exodus 36:9ff is Hebrew 39:2ff, lxx Jeremiah 34 and 36 are Hebrew
  // 27 and 29). UBIO Jeremiah 36:1 is Jehoiakim's fourth year, the scroll.
  186: { "EXO.36": 27, "JER.34": 22, "JER.36": 32 },
};

describe("bundled labels", () => {
  it("unpack to exactly data/labels.json", () => {
    const labels: Record<string, StdScheme> = JSON.parse(
      readFileSync(new URL("../data/labels.json", import.meta.url), "utf8"),
    );
    expect(Object.keys(labels).length).toBeGreaterThan(3000);
    for (const [id, vrs] of Object.entries(labels)) expect(versificationLabel(Number(id)), id).toBe(vrs);
    for (let id = 1; id <= 5000; id++) if (!(id in labels)) expect(versificationLabel(id), String(id)).toBeUndefined();
  });
});

describe("surveyed versions", () => {
  it("has YouVersion's label, or none, for every scanned version", () => {
    for (const [id, v] of Object.entries(SCAN)) expect(versificationLabel(Number(id)), v.abbr).toBe(v.vrs ?? undefined);
  });

  it.each(SURVEYED)("bible %i: skipped and off-label verses", (id) => {
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
    expect(bundled.source, v.abbr).toBe(isVerifiedVersion(id) ? "verified" : id in REFUSED ? "unsupported" : "scanned");
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
    if (!v.vrs) return; // below
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

describe("unlabelled versions", () => {
  // Verses left unsynced, for those that leave any: chapters fitting neither
  // English nor Hebrew numbering, as in any version.
  const SKIPPED_UNLABELLED: Record<number, number> = {
    1374: 22, 1604: 88, 1611: 52, 1927: 66, 2056: 27, 2320: 72, 2404: 22, 2532: 213, 2598: 13, 2750: 26,
    3081: 36, 3479: 30, 3800: 116, 3807: 21, 3836: 26, 4175: 4, 4182: 22, 4221: 4, 4446: 22, 4490: 22,
    4720: 36, 4867: 26, 1706: 109, 2301: 150, 3275: 500, 3719: 85,
  };

  it("are refused only when Synodal or Septuagint numbered", () => {
    expect(UNLABELLED.length).toBe(220);
    for (const id of UNLABELLED) {
      const { source, unfit } = buildVersionMap(SCAN[id].abbr, id);
      if (id in REFUSED) {
        expect(source, SCAN[id].abbr).toBe("unsupported");
        expect(unfit, SCAN[id].abbr).toBe(REFUSED[id]);
      } else {
        expect(source, SCAN[id].abbr).toBe("scanned");
        expect(unfit!, SCAN[id].abbr).toBeLessThanOrEqual(23); // TMA-C (3275), Arabic selections from 23 books
      }
    }
  });

  it.each(UNLABELLED)("bible %i: skipped verses", (id) => {
    expect(measure(id, buildVersionMap(SCAN[id].abbr, id).map).skipped, SCAN[id].abbr).toBe(SKIPPED_UNLABELLED[id] ?? 0);
  });

  // With no label, which system a version follows is only known from its
  // counts. Where a chapter's count also fits another of the six systems that
  // would map it differently, and that system fits the version's chapters of
  // the book as well as the one the engine chose, the counts can't tell them
  // apart and verses could be misplaced. That happens only in Jonah 2 against
  // vul, and only because SIL's vul.vrs gives it 11 verses but maps it as
  // English's 10 (JON 2:1-10 = JON 2:2-11). Jonah 2:1 is the fish swallowing
  // Jonah in all four versions with Jonah (CAROS, DROT, ROT and Lontomba;
  // bible.com, Sept 2026): Hebrew numbering, which Synodal shares, as mapped.
  // (Also BurOTp and KabBBL, not read.) And Nehemiah 7 in KabBBL, which fits
  // rsc throughout: 7:68 is mapped as English on purpose, as in SYNO and NRT.
  // KabBBL (Kabardian) and AltBBL (Altai) are Synodal numbered as far as their
  // counts show, but in the books they have, Synodal numbers every chapter
  // either as English or Hebrew does or in a count neither has (those are
  // skipped), so neither is refused and neither has a verse misplaced.
  it("map every verse as any system their counts fit as well would", () => {
    const std = Standard.load();
    const ambiguous: string[] = [];
    for (const id of UNLABELLED) {
      const map = buildVersionMap(SCAN[id].abbr, id).map;
      for (const b of BOOKS) {
        const chapters = map.chapters(b);
        const fits = (s: StdScheme) => chapters.filter((c) => std.count(s, b, c) === map.counts[b][c]).length;
        for (const c of chapters) {
          const chosen = map.schemes[b][c];
          if (chosen === null || chosen === "custom") continue;
          const n = map.counts[b][c];
          for (const s of STD_SCHEMES) {
            if (s === chosen || std.count(s, b, c) !== n || fits(s) < fits(chosen)) continue;
            const verses = Array.from({ length: n }, (_, k) => `${b}.${c}.${k + 1}`);
            if (verses.some((l) => std.toCanon(s, l) !== map.toCanon.get(l))) ambiguous.push(`${SCAN[id].abbr} ${s} ${b}.${c}`);
          }
        }
      }
    }
    expect(ambiguous.sort()).toEqual([
      "BurOTp vul JON.2", "CAROS vul JON.2", "DROT vul JON.2", "KabBBL rsc NEH.7", "KabBBL rso NEH.7",
      "KabBBL vul JON.2", "ROT vul JON.2", "nto vul JON.2",
    ]);
  });
});

describe("unsupported numbering", () => {
  const ids = Object.keys(SCAN).map(Number);
  const LABEL_ONLY = new Set(["rso", "rsc", "lxx", "vul"]);
  const unfit = (id: number) => unfitChapters(knownCounts(SCAN[id]), builtinOverrides(id));
  // A bible id with no label, correction table or bundled counts.
  const UNKNOWN = 999_999;

  it.each(ids.filter((id) => !(id in REFUSED)))("bible %i: is never refused", (id) => {
    expect(buildVersionMap(SCAN[id].abbr, id).source).not.toBe("unsupported");
    expect(buildVersionMap(SCAN[id].abbr, id, indexOf(SCAN[id])).source).not.toBe("unsupported");
  });

  const engOrg = ids.filter((id) => !LABEL_ONLY.has(SCAN[id].vrs!) && !(id in REFUSED));

  it("leaves every English or Hebrew numbered version well below the threshold", () => {
    const worst = Math.max(...engOrg.map(unfit));
    expect(worst).toBe(35); // UKRK: 38 chapters, 3 of them described by shared correction tables
    expect(worst * 2).toBeLessThan(MAX_UNFIT_CHAPTERS + 1);
  });

  // One test per version: together they take several seconds on CI.
  it.each(engOrg)("bible %i: English or Hebrew numbered, not refused even unlabelled", (id) => {
    expect(buildVersionMap(SCAN[id].abbr, UNKNOWN, indexOf(SCAN[id])).source, SCAN[id].abbr).toBe("api-index");
  });

  it.each(Object.keys(REFUSED).map(Number))("bible %i: is refused, well above the threshold", (id) => {
    expect(unfit(id)).toBeGreaterThan(MAX_UNFIT_CHAPTERS + 50);
    expect(buildVersionMap(SCAN[id].abbr, id, indexOf(SCAN[id])).source).toBe("unsupported");
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

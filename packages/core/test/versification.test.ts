import { describe, expect, it } from "vitest";
import {
  BOOKS,
  Standard,
  assumedScheme,
  VersionMap,
  buildVersionMap,
  hasKnownCounts,
  isVerifiedVersion,
  parseRef,
  versificationLabel,
} from "../src";
import { KNOWN_COUNTS, OVERRIDES } from "../src/data.generated";

const MAPS: Record<string, VersionMap> = {
  NIV: buildVersionMap("NIV", 111).map,
  LSG: buildVersionMap("LSG", 93).map,
  S21: buildVersionMap("S21", 152).map,
};

function across(niv: string): Record<string, string[]> {
  const canon = MAPS.NIV.toCanon.get(niv)!;
  return Object.fromEntries(Object.entries(MAPS).map(([a, m]) => [a, m.fromCanon.get(canon) ?? []]));
}

describe("verse mapping", () => {
  // Each pair was checked against the verse text on bible.com.
  it.each([
    ["EXO.22.1", ["EXO.22.1"], ["EXO.21.37"]],
    ["1SA.24.1", ["1SA.24.2"], ["1SA.24.2"]],
    ["1SA.21.1", ["1SA.21.1"], ["1SA.21.2"]],
    ["MAL.4.5", ["MAL.4.5"], ["MAL.3.23"]],
    ["2CO.13.14", ["2CO.13.13"], ["2CO.13.13"]],
    ["PSA.51.1", ["PSA.51.3"], ["PSA.51.3"]],
    ["JHN.3.16", ["JHN.3.16"], ["JHN.3.16"]],
    ["NAM.1.15", ["NAM.2.1"], ["NAM.2.1"]],
  ])("NIV %s -> LSG %j, S21 %j", (niv, lsg, s21) => {
    expect(across(niv).LSG).toEqual(lsg);
    expect(across(niv).S21).toEqual(s21);
  });

  it.each([
    ["JOB.41.1", ["JOB.40.20"]],
    ["JOB.39.1", ["JOB.39.4"]],
    ["JOB.40.6", ["JOB.40.1"]],
    ["ECC.11.9", ["ECC.12.1"]],
    ["ECC.12.1", ["ECC.12.3"]],
    ["JOB.34.37", []], // merged into LSG 34:36
    ["MRK.9.50", ["MRK.9.50", "MRK.9.51"]],
  ])("LSG correction table: NIV %s -> %j", (niv, lsg) => {
    expect(across(niv).LSG).toEqual(lsg);
  });

  it("maps every chapter of every version", () => {
    for (const [abbr, m] of Object.entries(MAPS)) {
      for (const b of BOOKS) {
        expect(m.skippedChapters(b), `${abbr} ${b}`).toEqual([]);
        expect(m.chapters(b).length, `${abbr} ${b}`).toBeGreaterThan(0);
      }
    }
  });

  it("round-trips every verse", () => {
    for (const m of Object.values(MAPS)) {
      for (const [local, canon] of m.toCanon) expect(m.fromCanon.get(canon)).toContain(local);
    }
  });

  it("never mixes schemes on one canonical verse", () => {
    for (const [abbr, m] of Object.entries(MAPS)) {
      for (const [canon, locals] of m.fromCanon) {
        const schemes = new Set(locals.map((l) => {
          const [b, c] = parseRef(l);
          return m.schemes[b][c];
        }));
        expect(schemes.size, `${abbr} ${canon}`).toBe(1);
      }
    }
  });

  it("knows which chapters exist", () => {
    expect(MAPS.S21.chapters("JOL")).toEqual([1, 2, 3, 4]);
    expect(MAPS.S21.chapters("MAL")).toEqual([1, 2, 3]);
    expect(MAPS.LSG.chapters("MAL")).toEqual([1, 2, 3, 4]);
  });

});

describe("bundled counts", () => {
  it("rank verified, then scanned, then the API index, then an assumption", () => {
    for (const id of [1588, 111, 93, 152]) expect(buildVersionMap("X", id).source).toBe("verified");
    expect(buildVersionMap("KJV", 1).source).toBe("scanned");
    expect(buildVersionMap("SYNO", 400).source).toBe("scanned");
    expect(buildVersionMap("KJV", 1, { books: [] }).source).toBe("api-index");
    expect(buildVersionMap("X", 999999).source).toBe("assumed");
    expect(isVerifiedVersion(111)).toBe(true);
    expect(isVerifiedVersion(1)).toBe(false);
    expect(hasKnownCounts(1)).toBe(true);
    expect(hasKnownCounts(999999)).toBe(false);
  });

  it("are keyed by bible id, never by abbreviation", () => {
    // ARC is both 212 (scanned) and 3407 (not); NVI-S both 128 and 2664.
    expect(hasKnownCounts(212)).toBe(true);
    expect(hasKnownCounts(3407)).toBe(false);
    expect(hasKnownCounts(128)).toBe(true);
    expect(hasKnownCounts(2664)).toBe(false);
    for (const key of [...Object.keys(KNOWN_COUNTS), ...Object.keys(OVERRIDES)]) expect(key).toMatch(/^[1-9]\d*$/);
  });

  it("don't depend on the name a version is saved under", () => {
    // Settings keep the name the person chose; lookups go by id only.
    const named = (abbr: string, id: number) => [...buildVersionMap(abbr, id).map.toCanon];
    expect(named("MY-NIV", 111)).toEqual(named("NIV", 111));
    expect(named("LSG", 111)).toEqual(named("NIV", 111));
    expect(buildVersionMap("NIV", 93).map.chapters("MAL")).toEqual([1, 2, 3, 4]); // LSG's, not NIV's
  });
});

describe("six numbering systems", () => {
  const std = Standard.load();

  it("reads the Synodal, Septuagint and Vulgate tables", () => {
    expect(std.count("rso", "PSA", 9)).toBe(39); // Hebrew 9 and 10 as one psalm
    expect(std.toCanon("rso", "PSA.91.2")).toBe("PSA.92.2");
    expect(std.toCanon("rsc", "PSA.91.2")).toBe("PSA.92.2");
    expect(std.toCanon("lxx", "PSA.91.2")).toBe("PSA.92.2");
    expect(std.toCanon("vul", "PSA.91.2")).toBe("PSA.92.2");
  });

  it("drops mappings to a Psalm title", () => {
    // rso.vrs lists "PSA 9:22 = PSA 10:0" before "PSA 9:22-39 = PSA 10:1-18".
    expect(std.toCanon("rso", "PSA.9.22")).toBe("PSA.10.1");
  });

  it("drops mappings into another synced book", () => {
    // lxx numbers Nehemiah as Ezra 11-23; syncing Nehemiah wouldn't read Ezra.
    expect(std.toCanon("lxx", "EZR.11.1")).toBe("EZR.11.1");
  });

  it("maps a verse spanning two canonical verses as eng does", () => {
    // rso: "NUM 26:1 = NUM 25:19" and "NUM 26:1 = NUM 26:1".
    expect(std.toCanon("rso", "NUM.26.1")).toBe("NUM.26.1");
    expect(std.toCanon("rsc", "REV.13.1")).toBe("REV.13.1");
    expect(std.toCanon("rso", "1KI.22.43")).toBe(std.toCanon("eng", "1KI.22.43"));
  });

  it("applies the checked corrections to SIL's tables", () => {
    expect(std.toCanon("rso", "DAN.6.1")).toBe("DAN.6.2");
    expect(std.toCanon("lxx", "DEU.5.17")).toBe("DEU.5.17");
    expect(std.toCanon("lxx", "EXO.20.13")).toBe("EXO.20.13");
  });

  it("assumes a label-only system, else English", () => {
    expect(assumedScheme(400)).toBe("rso");
    expect(assumedScheme(186)).toBe("lxx");
    expect(assumedScheme(93)).toBe("eng"); // labelled org: counts decide, not the label
    expect(assumedScheme(999999)).toBe("eng");
  });

  it("knows YouVersion's labels by bible id", () => {
    expect(versificationLabel(400)).toBe("rso");
    expect(versificationLabel(143)).toBe("rsc");
    expect(versificationLabel(186)).toBe("lxx");
    expect(versificationLabel(93)).toBe("org");
    expect(versificationLabel(999999)).toBeUndefined();
  });
});

describe("choosing a system per chapter", () => {
  const std = Standard.load();
  // Synodal Psalms 9-11 fit only rso; Psalm 91 has 16 verses in every system
  // but holds Hebrew Psalm 92.
  const psalms = { PSA: { 9: 39, 10: 7, 11: 9, 91: 16 } };

  it("only considers rso when the version is labelled rso", () => {
    const labelled = VersionMap.build("X", std, { knownCounts: psalms, label: "rso" });
    const unlabelled = VersionMap.build("X", std, { knownCounts: psalms });
    expect(labelled.schemes.PSA[91]).toBe("rso");
    expect(labelled.toCanon.get("PSA.91.2")).toBe("PSA.92.2");
    expect(unlabelled.schemes.PSA[91]).toBe("eng");
  });

  it("ignores an eng or org label", () => {
    const counts = { MAL: { 3: 18, 4: 6 } };
    const org = VersionMap.build("X", std, { knownCounts: counts, label: "org" });
    const none = VersionMap.build("X", std, { knownCounts: counts });
    expect([...org.toCanon]).toEqual([...none.toCanon]);
  });

  it("lets the book's other chapters outrank the label", () => {
    // Jeremiah 25-33 fit eng/org and not lxx; 34 fits all three.
    const jer = { JER: { 25: 38, 26: 24, 27: 22, 28: 17, 29: 32, 30: 24, 31: 40, 32: 44, 33: 26, 34: 22 } };
    const m = VersionMap.build("X", std, { knownCounts: jer, label: "lxx" });
    expect(m.schemes.JER[34]).toBe("eng");
    expect(m.toCanon.get("JER.34.1")).toBe("JER.34.1");
  });

  it("breaks an even tie with the label over org", () => {
    // Psalm 57 (12 verses) fits rso and org; nothing else in the book is known.
    const m = VersionMap.build("X", std, { knownCounts: { PSA: { 57: 12 } }, label: "rso" });
    expect(m.schemes.PSA[57]).toBe("rso");
    expect(m.toCanon.get("PSA.57.1")).toBe("PSA.58.1");
  });

  it("keeps books a label system doesn't number separately", () => {
    // lxx has no Nehemiah (it's Ezra 11-23), Esther or Daniel of its own.
    const m = VersionMap.build("X", std, { label: "lxx" });
    expect(m.chapters("NEH")).toHaveLength(13);
    expect(m.chapters("EST")).toHaveLength(10);
    expect(m.chapters("DAN")).toHaveLength(12);
    expect(m.schemes.DAN[6]).toBe("org");
    expect(m.chapters("EZR")).toHaveLength(10);
    expect(m.schemes.PSA[91]).toBe("lxx");
    // 480 is labelled lxx and has no bundled counts. Hebrew numbering, as
    // UBIO (186), the lxx version whose counts are bundled, has.
    const assumed = buildVersionMap("X", 480);
    expect(assumed.source).toBe("assumed");
    expect(assumed.map.chapters("NEH")).toHaveLength(13);
    expect(assumed.map.toCanon.get("NEH.3.38")).toBe("NEH.3.38");
    const ubio = buildVersionMap("UBIO", 186);
    expect(ubio.source).toBe("scanned");
    expect(ubio.map.toCanon.get("NEH.3.38")).toBe("NEH.3.38");
  });

  it("assumes the label when nothing is known, without inventing chapters", () => {
    const m = VersionMap.build("X", std, { label: "rso" });
    expect(m.schemes.PSA[91]).toBe("rso");
    expect(m.chapters("PSA")).toHaveLength(150); // no Psalm 151
    expect(m.chapters("DAN")).toHaveLength(12); // no Susanna or Bel
    expect(buildVersionMap("SYNO", 400).map.toCanon.get("PSA.91.2")).toBe("PSA.92.2");
  });
});

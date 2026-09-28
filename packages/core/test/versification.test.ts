import { describe, expect, it } from "vitest";
import {
  BOOKS,
  Standard,
  assumedScheme,
  VersionMap,
  buildVersionMap,
  builtinOverrides,
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

describe("shared correction tables", () => {
  const maps = new Map<number, VersionMap>();
  const mapOf = (id: number) => maps.get(id) ?? maps.set(id, buildVersionMap(String(id), id).map).get(id)!;
  const fromNiv = (niv: string, id: number) => mapOf(id).fromCanon.get(MAPS.NIV.toCanon.get(niv)!) ?? [];

  const REV_12_17 = [1, 13, 51, 59, 88, 89, 97, 101, 111, 114, 128, 129, 132, 149, 164, 188, 191, 212, 1588, 1608, 1627, 1628, 1683];
  const JN3_14 = [1, 51, 97, 114, 132, 191];
  const SA1_20_43 = [75, 93, 122, 141, 151, 188, 193, 212, 306, 1608, 1840, 1990];
  const JOB_38_41 = [75, 93, 151, 193, 306, 1990];
  const DUTCH_INDONESIAN = [306, 1990];

  // Each pair was checked against the verse text on bible.com, Sept 2026:
  // NIV's verse on the left, the version's on the right.
  it.each([
    // Revelation 12:18 is the start of 13:1 (NIV, KJV) or the end of 12:17 (ESV).
    ...REV_12_17.flatMap((id) => [
      ["REV.12.17", id, ["REV.12.17"]],
      ["REV.13.1", id, ["REV.13.1"]],
    ]),
    // "Peace be to thee. Our friends salute thee" ends 3 John 14 (KJV).
    ...JN3_14.flatMap((id) => [
      ["3JN.1.14", id, ["3JN.1.14"]],
      ["3JN.1.15", id, []],
    ]),
    // "And he arose and departed: and Jonathan went into the city" (KJV) is 20:43.
    ...SA1_20_43.flatMap((id) => [
      ["1SA.20.42", id, ["1SA.20.43"]],
      ["1SA.21.1", id, ["1SA.21.1"]],
    ]),
    ...JOB_38_41.flatMap((id) => [
      ["JOB.38.39", id, ["JOB.39.1"]], // "Wilt thou hunt the prey for the lion?"
      ["JOB.39.1", id, ["JOB.39.4"]], // the wild goats
      ["JOB.40.1", id, ["JOB.39.34"]],
      ["JOB.40.6", id, ["JOB.40.1"]], // "out of the whirlwind"
      ["JOB.41.9", id, ["JOB.40.28"]],
      ["JOB.41.10", id, ["JOB.41.1"]], // "None is so fierce that dare stir him up"
    ]),
    ...[93, 122, 141].flatMap((id) => [
      ["ECC.11.9", id, ["ECC.12.1"]], // "Rejoice, O young man, in thy youth"
      ["ECC.12.1", id, ["ECC.12.3"]], // "Remember now thy Creator"
    ]),
    ...[93, 141, 193].map((id) => ["MRK.9.50", id, ["MRK.9.50", "MRK.9.51"]]), // "Have salt in yourselves"
    ...[93, 193].map((id) => ["MRK.10.52", id, ["MRK.10.52", "MRK.10.53"]]),
    ...[27, ...DUTCH_INDONESIAN].flatMap((id) => [
      ["EXO.6.1", id, ["EXO.5.24"]], // "Now shalt thou see what I will do to Pharaoh"
      ["EXO.6.2", id, ["EXO.6.1"]],
      ["EXO.6.30", id, ["EXO.6.29"]],
      ["ROM.7.25", id, ["ROM.7.25", "ROM.7.26"]], // "So then with the mind I myself serve"
    ]),
    ...DUTCH_INDONESIAN.flatMap((id) => [
      ["NEH.7.73", id, ["NEH.7.73", "NEH.8.1"]], // "and when the seventh month came"
      ["NEH.8.1", id, ["NEH.8.2"]], // "all the people gathered themselves together"
      ["NEH.8.18", id, ["NEH.8.19"]],
      ["HAG.1.15", id, ["HAG.2.1"]], // "In the four and twentieth day of the sixth month"
      ["HAG.2.1", id, ["HAG.2.2"]],
      ["HAG.2.23", id, ["HAG.2.24"]],
    ]),
    ...[75, ...DUTCH_INDONESIAN].flatMap((id) => [
      ["HOS.1.10", id, ["HOS.1.10"]],
      ["HOS.2.1", id, ["HOS.1.12"]], // "Say ye unto your brethren, Ammi"
      ["HOS.2.2", id, ["HOS.2.1"]], // "Plead with your mother"
      ["HOS.2.23", id, ["HOS.2.22"]],
    ]),
    ...[122, 141, 188].flatMap((id) => [
      ["PSA.13.1", id, ["PSA.13.1"]], // "How long wilt thou forget me"
      ["PSA.13.5", id, ["PSA.13.5"]], // "But I have trusted in thy mercy"
      ["PSA.13.6", id, ["PSA.13.5"]], // "I will sing unto the LORD"
    ]),
    // Tables of one version each.
    ["SNG.6.13", 88, ["SNG.6.13", "SNG.6.14"]], // KRV: "Return, return" / "What will ye see"
    ["SNG.7.1", 88, ["SNG.7.1"]],
    ["JER.29.30", 132, ["JER.29.30"]], // PBG runs 29:30-31 together
    ["JER.29.31", 132, []],
    ["JER.29.32", 132, ["JER.29.31"]], // "Behold, I will punish Shemaiah"
    ["1KI.6.37", 193, ["1KI.6.37"]], // VIE1925 6:37 has the eleventh year too
    ["1KI.6.38", 193, []],
    ["PSA.2.11", 463, ["PSA.2.11"]], // NABRE runs on to "Blessed are all"
    ["PSA.2.12", 463, []],
    ["JHN.1.38", 1990, ["JHN.1.38", "JHN.1.39"]], // HSV: "What seek ye?" starts 1:39
    ["JHN.1.39", 1990, ["JHN.1.40"]], // "Come and see"
    ["JHN.1.51", 1990, ["JHN.1.52"]],
  ] as [string, number, string[]][])("NIV %s -> bible %i %j", (niv, id, local) => {
    expect(fromNiv(niv, id)).toEqual(local);
  });

  it("map every chapter they touch", () => {
    for (const id of Object.keys(OVERRIDES).map(Number)) {
      for (const [local] of builtinOverrides(id)) {
        const [b, c] = parseRef(local);
        expect(mapOf(id).schemes[b][c], `${id} ${local}`).toBe("custom");
      }
    }
  });

  it("apply only to the versions that name them", () => {
    // Revelation 12 in 17 verses, with no table named: nothing says where 12:18 went.
    const index = { books: [{ id: "REV", chapters: [{ id: "12", verses: Array.from({ length: 17 }, (_, i) => i + 1) }] }] };
    expect(buildVersionMap("X", 999999, index).map.skippedChapters("REV")).toEqual([12]);
    expect(buildVersionMap("NIV", 111, index).map.chapters("REV")).toContain(12);
  });

  it("skip a chapter whose real count isn't the one the table was written for", () => {
    // NIV's API index, were Revelation 12 ever given 18 verses.
    const index = { books: [{ id: "REV", chapters: [{ id: "12", verses: Array.from({ length: 18 }, (_, i) => i + 1) }] }] };
    const m = buildVersionMap("NIV", 111, index).map;
    expect(m.skippedChapters("REV")).toEqual([12]);
    expect(m.toCanon.has("REV.12.1")).toBe(false);
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

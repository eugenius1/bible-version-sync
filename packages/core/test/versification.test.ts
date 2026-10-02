import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
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
  loadVersionNames,
  versionName,
  versionNamesLoaded,
  versionsInLanguages,
  versionRank,
  byPopularity,
  mostUsedVersions,
  searchVersions,
} from "../src";
import { KNOWN_COUNTS, OVERRIDES, VERIFIED_VERSIONS } from "../src/data.generated";

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

  const REV_12_17 = [1, 13, 51, 59, 88, 89, 97, 101, 111, 114, 128, 129, 132, 138, 149, 164, 177, 188, 191, 212, 819, 1588, 1608, 1627, 1628, 1683];
  const JN3_14 = [1, 42, 51, 55, 97, 114, 132, 138, 177, 191, 819];
  const SA1_20_43 = [75, 93, 122, 141, 151, 188, 193, 212, 306, 328, 1608, 1840, 1990, 4833];
  const JOB_38_41 = [75, 93, 151, 306, 328, 1990];
  const DUTCH_INDONESIAN = [306, 1990];
  const DUTCH = [306, 328, 1990]; // with NBG51, whose Nehemiah is its own

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
    ...[93, 122, 141, 4833].flatMap((id) => [
      ["ECC.11.9", id, ["ECC.12.1"]], // "Rejoice, O young man, in thy youth"
      ["ECC.12.1", id, ["ECC.12.3"]], // "Remember now thy Creator"
    ]),
    ...[93, 141, 193].map((id) => ["MRK.9.50", id, ["MRK.9.50", "MRK.9.51"]]), // "Have salt in yourselves"
    ...[93, 193].map((id) => ["MRK.10.52", id, ["MRK.10.52", "MRK.10.53"]]),
    ...[27, ...DUTCH].flatMap((id) => [
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
    ...[75, ...DUTCH].flatMap((id) => [
      ["HOS.1.10", id, ["HOS.1.10"]],
      ["HOS.2.1", id, ["HOS.1.12"]], // "Say ye unto your brethren, Ammi"
      ["HOS.2.2", id, ["HOS.2.1"]], // "Plead with your mother"
      ["HOS.2.23", id, ["HOS.2.22"]],
    ]),
    ...[122, 141, 188, 4833].flatMap((id) => [
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
    ...[328, 1990].flatMap((id) => [
      ["JHN.1.38", id, ["JHN.1.38", "JHN.1.39"]], // "What seek ye?" starts 1:39
      ["JHN.1.39", id, ["JHN.1.40"]], // "Come and see"
      ["JHN.1.51", id, ["JHN.1.52"]],
    ]),
    ["HAG.1.15", 328, ["HAG.2.1"]],
    ["HAG.2.23", 328, ["HAG.2.24"]],
    // Revelation 20 as the Synodal text divides it.
    ...[143, 167, 400].flatMap((id) => [
      ["REV.20.7", id, ["REV.20.7"]], // runs on through Gog and Magog
      ["REV.20.8", id, []],
      ["REV.20.9", id, ["REV.20.8", "REV.20.9"]], // "went up" / "fire came down"
    ]),
    // "Grace be with thee" a verse of its own.
    ...[13, 101].map((id) => ["1TI.6.21", id, ["1TI.6.21", "1TI.6.22"]]),
    // 7:53 opens 8:1.
    ...[46, 48, 164].flatMap((id) => [
      ["JHN.7.52", id, ["JHN.7.52"]],
      ["JHN.7.53", id, []],
      ["JHN.8.1", id, ["JHN.8.1"]],
    ]),
    ...[122, 4833].flatMap((id) => [
      ["2SA.20.25", id, ["2SA.20.25"]], // runs on through Ira the Jairite
      ["2SA.20.26", id, []],
    ]),
    // Psalm 47 with an unnumbered title in 10 verses, English 9 split in two.
    ...[149, 4869].flatMap((id) => [
      ["PSA.47.1", id, ["PSA.47.1"]], // "O clap your hands"
      ["PSA.47.9", id, ["PSA.47.9", "PSA.47.10"]],
    ]),
    ["NEH.7.72", 328, ["NEH.7.71"]], // NBG51: Hebrew Nehemiah 7, no horses and mules
    ["NEH.7.73", 328, ["NEH.7.72", "NEH.8.1"]], // "and when the seventh month came"
    ["NEH.8.1", 328, ["NEH.8.2"]],
    ["JDG.5.31", 212, ["JDG.5.31", "JDG.5.32"]], // ARC: "the land had rest forty years"
    ["EZK.15.7", 142, ["EZK.15.7"]], // RNKSV 15:7 runs on through 15:8
    ["EZK.15.8", 142, []],
    // SYNO: the Synodal text's own divisions, and rso.vrs's Isaiah 3 slip.
    ["EST.1.6", 400, ["EST.1.6", "EST.1.7"]], // the couches of gold and silver
    ["EST.1.7", 400, ["EST.1.8"]], // the vessels of gold
    ["EST.1.8", 400, []],
    ["ISA.3.21", 400, ["ISA.3.20"]], // the rings and nose jewels
    ["ISA.3.26", 400, ["ISA.3.25"]],
    ["PSA.116.10", 400, ["PSA.115.1"]], // "I believed, therefore have I spoken"
    ["PSA.116.19", 400, ["PSA.115.10"]],
    ["PSA.87.1", 400, ["PSA.86.1", "PSA.86.2"]], // the title, then "His foundation"
    ...[143, 201].flatMap((id) => [
      ["PSA.90.1", id, ["PSA.89.1", "PSA.89.2"]], // "A prayer of Moses", then "Lord, thou hast been"
      ["PSA.116.10", id, ["PSA.115.1"]],
      ["PSA.142.1", id, ["PSA.141.1"]],
    ]),
    ["2KI.8.5", 186, ["2KI.8.5", "2KI.8.6"]], // UBIO: Gehazi's words are 8:6
    ["2KI.8.6", 186, []], // the king asking the woman is missing
    // НПУ numbers three psalms' titles as verse 1.
    ["PSA.87.1", 3269, ["PSA.86.1", "PSA.86.2"]],
    ["PSA.90.1", 3269, ["PSA.89.1", "PSA.89.2"]], // "Lord, thou hast been our dwelling place"
    ["PSA.90.2", 3269, ["PSA.89.3"]],
    ["PSA.142.1", 3269, ["PSA.141.1"]], // "I cried unto the LORD with my voice"
    ["PSA.142.2", 3269, ["PSA.141.2"]], // "I poured out my complaint"
    ["2KI.4.44", 13, []], // AVD 4:43 runs on through 4:44
    ["PSA.72.20", 13, []], // "The prayers of David ... are ended" ends 72:19
    ["JDG.3.19", 101, ["JDG.3.19", "JDG.3.20"]], // KEH splits Ehud's errand
    ["JDG.3.20", 101, ["JDG.3.21"]],
    ["JDG.3.21", 101, []],
    ["JDG.10.1", 819, ["JDG.10.1", "JDG.10.19"]], // HHBD prints Judges 10 twice
    ["JER.29.32", 819, ["JER.29.32", "JER.29.33"]],
    ["MAT.1.6", 819, ["MAT.1.6", "MAT.1.7"]], // "Jesse begat David" / "David begat Solomon"
    ["MAT.1.7", 819, ["MAT.1.8"]],
    ["MAT.1.8", 819, []],
    ["ISA.38.21", 27, []], // BIMK tells the figs in 38:6
    ["JON.1.17", 3490, ["JON.2.1"]], // BW1975: the fish, Hebrew 2:1
    ["JON.2.9", 3490, ["JON.2.10"]],
    ["JON.2.10", 3490, []], // "the LORD spake unto the fish" ends 2:10
    ["JOL.3.1", 3490, ["JOL.3.6"]], // "in those days", Hebrew 4:1
    ["JOL.2.28", 3490, ["JOL.3.1"]],
    ["ECC.8.1", 3490, ["ECC.8.1", "ECC.8.2"]],
    ["ECC.8.2", 3490, ["ECC.8.3"]], // "keep the king's commandment"
    ["2SA.17.28", 3490, []], // 17:27 runs on through the bedding
    ["2SA.17.29", 3490, ["2SA.17.28"]], // honey and butter
    ["JOB.38.39", 193, ["JOB.39.2"]], // VIE1925 reverses 38:39-40
    ["JOB.38.40", 193, ["JOB.39.1"]],
    ["JOB.40.6", 193, ["JOB.40.1"]],
    ["EXO.12.51", 193, []],
    // DRC1752 keeps the Vulgate's own verse divisions.
    ["EXO.39.22", 55, ["EXO.39.20"]], // "the tunick of the ephod all of violet"
    ["EXO.39.39", 55, ["EXO.39.39"]],
    ["NEH.7.44", 55, ["NEH.7.45"]], // "The children of Asaph, a hundred forty-eight"
    ["NEH.7.68", 55, ["NEH.7.68", "NEH.7.69"]], // horses and mules, camels and asses, as in English
    ["SNG.1.2", 55, ["SNG.1.1"]], // "Let him kiss me with the kiss of his mouth"
    ["JON.1.17", 55, ["JON.2.1"]], // "the Lord prepared a great fish"
    ["JON.2.10", 55, ["JON.2.11"]], // "the Lord spoke to the fish"
    ["1TH.4.13", 55, ["1TH.4.12"]], // "we will not have you ignorant"
    ["2TI.4.10", 55, ["2TI.4.9", "2TI.4.10"]], // Demas / Crescens and Titus
    ["LUK.9.43", 55, ["LUK.9.44"]], // "all were astonished"
    ["PSA.16.1", 55, ["PSA.15.1"]], // "Preserve me, O Lord"
    ["PSA.109.17", 55, ["PSA.108.18"]], // "he loved cursing"
    ["REV.20.9", 55, ["REV.20.8", "REV.20.9"]],
    // CPDV: Esther in the Greek order, the additions out of the sync.
    ["EST.1.1", 42, ["EST.3.1"]], // "In the days of Artaxerxes"
    ["EST.3.14", 42, ["EST.6.8"]],
    ["EST.4.12", 42, []], // folded into 7:14
    ["EST.4.17", 42, ["EST.7.19"]], // not Mordecai's prayer after it
    ["EST.5.1", 42, ["EST.9.17"]], // "on the third day"
    ["EST.8.13", 42, ["EST.13.25"]],
    ["EST.10.3", 42, ["EST.15.3"]],
    ["SNG.6.1", 42, ["SNG.5.19"]], // "Where has your beloved gone"
    ["SNG.6.2", 42, ["SNG.6.1"]],
    ["SNG.6.13", 42, ["SNG.6.12", "SNG.7.1"]], // "Return, return, O Sulamitess"
    ["PSA.72.1", 42, ["PSA.71.1", "PSA.71.2"]], // the title, then "Give the king thy judgments"
    ["PSA.14.4", 42, ["PSA.13.7"]], // after the Romans 3 lines
    ["NEH.7.44", 42, ["NEH.7.45"]],
    ["EXO.39.35", 42, ["EXO.39.34"]],
  ] as [string, number, string[]][])("NIV %s -> bible %i %j", (niv, id, local) => {
    expect(fromNiv(niv, id)).toEqual(local);
  });

  it("leave no chapter of a verified version unmapped", () => {
    for (const { abbr, bibleId } of VERIFIED_VERSIONS) {
      const m = mapOf(bibleId);
      for (const b of BOOKS) expect(m.skippedChapters(b), `${abbr} (${bibleId}) ${b}`).toEqual([]);
    }
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
    for (const id of [1588, 111, 93, 152, 1, 400]) expect(buildVersionMap("X", id).source).toBe("verified");
    expect(buildVersionMap("ESV", 59).source).toBe("scanned");
    expect(buildVersionMap("BTI", 313).source).toBe("scanned");
    expect(buildVersionMap("KJV", 1, { books: [] }).source).toBe("api-index");
    expect(buildVersionMap("X", 999999).source).toBe("assumed");
    expect(isVerifiedVersion(111)).toBe(true);
    expect(isVerifiedVersion(59)).toBe(false);
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

  it("folds a title into the first verse when an uneven range starts at it", () => {
    // rso: "PSA 115:0-10 = PSA 116:10-19". SYNO 115:1 is "I believed,
    // therefore have I spoken" (Hebrew 116:10) and 115:10 "In the courts of
    // the LORD's house" (116:19); pairing from the start put each a verse late.
    expect(std.toCanon("rso", "PSA.115.1")).toBe("PSA.116.10");
    expect(std.toCanon("rso", "PSA.115.10")).toBe("PSA.116.19");
    // "PSA 86:0-1 = PSA 87:1": Synodal 86:1 is Psalm 87's title, not Psalm 86.
    expect(std.toCanon("rso", "PSA.86.1")).toBe("PSA.87.1");
    // A range that doesn't start at a title still pairs from the start:
    // "PSA 89:2-6 = PSA 90:1-6", Synodal 89:2 "Lord, thou hast been our
    // dwelling place".
    expect(std.toCanon("rso", "PSA.89.2")).toBe("PSA.90.1");
    expect(std.toCanon("rso", "PSA.89.6")).toBe("PSA.90.5");
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
    expect(std.toCanon("rso", "ISA.3.20")).toBe("ISA.3.21");
    expect(std.toCanon("rso", "ISA.3.25")).toBe("ISA.3.26");
    expect(std.toCanon("rsc", "PSA.89.1")).toBe("PSA.90.1");
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

describe("versificationLabel", () => {
  it("knows YouVersion's label beyond the surveyed languages", () => {
    expect(versificationLabel(111)).toBe("eng");
    expect(versificationLabel(93)).toBe("org");
    expect(versificationLabel(400)).toBe("rso");
    expect(versificationLabel(2202)).toBe("rsc"); // Georgian GEO02
    expect(versificationLabel(1558)).toBe("rso"); // Bulgarian СИ
    expect(versificationLabel(1723)).toBe("rsc"); // Belarusian ББЛ
    expect(versificationLabel(2860)).toBe("lxx"); // Armenian ՆԷԱ
    expect(versificationLabel(3830)).toBeUndefined(); // CAROS: YouVersion gives none
    expect(versificationLabel(999999)).toBeUndefined();
  });
});

describe("versionName", () => {
  it("knows no name until every name is loaded", async () => {
    expect(versionNamesLoaded()).toBe(false);
    expect(versionName(111)).toBeUndefined(); // in the names chunk
    await Promise.all([loadVersionNames(), loadVersionNames()]);
    expect(versionNamesLoaded()).toBe(true);
    expect(versionName(111)?.abbr).toBe("NIV");
  });

  describe("once loaded", () => {
    beforeAll(() => loadVersionNames());

    it("uses the abbreviation bible.com shows, not YouVersion's internal one", () => {
      // Internally NIV11, NRT, NAV, CUNP-Shen.
      expect(versionName(111)).toEqual({ abbr: "NIV", language: "en", title: "New International Version" });
      expect(versionName(143)?.abbr).toBe("НРП");
      expect(versionName(101)?.abbr).toBe("KEH");
      expect(versionName(46)?.abbr).toBe("CUNP-神");
      expect(versionName(93)?.title).toBe("La Sainte Bible par Louis Segond 1910");
    });

    it("names each verified version as the verified list does", () => {
      for (const v of VERIFIED_VERSIONS) expect(versionName(v.bibleId)?.abbr).toBe(v.abbr);
    });

    it("lists the versions in a language by its primary subtag", () => {
      const english = versionsInLanguages(["en-GB"]);
      expect(english).toContain(111);
      expect(english).not.toContain(93);
      expect(versionsInLanguages(["fr", "EN"])).toEqual(expect.arrayContaining([93, 152, 111]));
      expect(versionsInLanguages(["zh"])).toContain(46); // zh-TW
      expect(versionsInLanguages([])).toEqual([]);
    });

    it("searches versions by number, abbreviation and title, ignoring case and accents", () => {
      expect(searchVersions("111")[0]).toBe(111); // the id itself first
      expect(searchVersions("niv")).toContain(111);
      expect(searchVersions("louis segond").slice(0, 1)).toEqual([93]);
      expect(searchVersions("SEGOND 21")).toContain(152);
      expect(searchVersions("синодальный")).toContain(400);
      expect(searchVersions("amplified classic")).toEqual([8]);
      expect(searchVersions("  ")).toEqual([]);
      expect(searchVersions("no such version anywhere")).toEqual([]);
    });

    it("lists search results in the reader's languages first, in their order", () => {
      // NVI: Spanish (128, 1637) and Portuguese (129, 4360).
      const pt = searchVersions("nvi", ["pt", "es"]);
      const es = searchVersions("nvi", ["es", "pt"]);
      expect(pt.slice(0, 2).sort()).toEqual([129, 4360]);
      expect(es.slice(0, 2).sort()).toEqual([128, 1637]);
      // Within a language: exact abbreviation before one that merely contains it.
      const fr = searchVersions("lsg", ["fr"]);
      expect(fr[0]).toBe(93);
    });

    it("ranks the most used versions first, and each language's default before the rest", () => {
      expect(versionRank(111)).toBe(0); // NIV
      expect(versionRank(1)).toBe(1); // KJV
      expect(versionRank(4443)).toBe(0); // Arum's only version, its default
      expect(versionRank(3869)).toBe(5); // romanised Arabic's default, after the Arabic list
      expect(versionRank(400)).toBe(0); // Synodal
      expect(versionRank(193)).toBe(0); // Vietnamese 1925
      expect(versionRank(12)).toBe(Infinity); // ASV
      // Equal ranks go by the reader's languages, then oldest id first.
      expect(byPopularity([12, 152, 1, 93, 111, 8], ["en", "fr"])).toEqual([111, 93, 1, 152, 8, 12]);
      expect(versionsInLanguages(["fr"]).slice(0, 3)).toEqual([93, 152, 21]); // LSG, S21, BDS
      expect(versionsInLanguages(["en"])).toHaveLength(88);
    });

    it("picks the most used version of the reader's first three languages", () => {
      expect(mostUsedVersions(["en-GB", "en", "fr-FR", "es", "de"])).toEqual([111, 93, 149]); // NIV, LSG, RVR1960
      expect(mostUsedVersions(["pt-BR"])).toEqual([129]); // NVI
      expect(mostUsedVersions(["xx", "en"])).toEqual([111]);
      expect(mostUsedVersions([])).toEqual([]);
    });

    it("names versions in their own script, with a BCP 47 language", () => {
      expect(versionName(400)).toEqual({ abbr: "SYNO", language: "ru", title: "Синодальный перевод" });
      expect(versionName(13)?.language).toBe("ar");
      expect(versionName(46)?.language).toBe("zh-TW"); // zho_tw in the survey
      expect(versionName(83)).toEqual({ abbr: "JCB", language: "ja", title: "リビングバイブル" });
      expect(versionName(2202)?.language).toBe("ka");
    });

    it("names every version YouVersion lists, scanned or not", () => {
      expect(hasKnownCounts(12)).toBe(false);
      expect(versionName(12)).toEqual({ abbr: "ASV", language: "en", title: "American Standard Version" });
    });

    it("turns YouVersion's own tag suffixes into BCP 47 scripts and regions, or drops them", () => {
      expect(versionName(820)?.language).toBe("hi-Latn"); // hin_ro
      expect(versionName(2377)?.language).toBe("fuv-Arab"); // fuv_ar
      expect(versionName(1637)?.language).toBe("es-ES"); // spa_es
      expect(versionName(3173)?.language).toBe("gax"); // gax_ars, Arsi Oromo
    });

    it("keeps YouVersion's tag where CLDR's alias would lose precision", () => {
      expect(versionName(1866)?.language).toBe("gom"); // Goan Konkani, not the Konkani macrolanguage kok
      expect(versionName(3208)?.language).toBe("mnk"); // Mandinka, not the Mandingo macrolanguage man
    });

    // scripts/language-tags.mjs writes every tag out rather than asking Intl
    // for the canonical form, which changes with Node's ICU. So a tag this
    // runtime would write differently is either one of the two kept on
    // purpose or a sign that CLDR changed: look before accepting it.
    it("bundles only language tags this runtime's Intl.Locale keeps as they are", () => {
      const names: Record<string, { language: string }> = JSON.parse(
        readFileSync(new URL("../data/names.json", import.meta.url), "utf8"),
      );
      const kept = new Set(["gom", "mnk"]);
      const drift = [...new Set(Object.values(names).map((n) => n.language))]
        .filter((t) => !kept.has(t.split("-")[0]))
        .filter((t) => new Intl.Locale(t).toString() !== t)
        .map((t) => `${t} -> ${new Intl.Locale(t).toString()}`);
      expect(drift).toEqual([]);
    });

    it("has no name for a version YouVersion doesn't list", () => {
      expect(versionName(999999)).toBeUndefined();
      expect(versionName(0)).toBeUndefined();
    });

    it("names every version with bundled counts", () => {
      for (const id of Object.keys(KNOWN_COUNTS)) expect(versionName(Number(id)), id).toBeDefined();
    });
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
    expect(ubio.source).toBe("verified");
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

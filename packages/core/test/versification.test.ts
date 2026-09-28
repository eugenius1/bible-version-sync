import { describe, expect, it } from "vitest";
import { BOOKS, buildVersionMap, parseRef, type VersionMap } from "../src";

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

  it("uses built-in data for the four verified versions", () => {
    expect(buildVersionMap("AMP", 1588).source).toBe("builtin");
    expect(buildVersionMap("KJV", 1).source).toBe("assumed");
  });
});

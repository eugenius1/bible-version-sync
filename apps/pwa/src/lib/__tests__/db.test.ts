import { describe, expect, it } from "vitest";
import { defaultVersions, settingFor } from "../db";

describe("defaultVersions", () => {
  it("takes the most used version of the reader's first three languages, then AMP", async () => {
    expect(await defaultVersions(["en-GB", "fr", "es", "de"])).toEqual([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "LSG", bibleId: 93 },
      { abbr: "RVR1960", bibleId: 149 },
      { abbr: "AMP", bibleId: 1588 },
    ]);
  });

  it("falls back to the most used English version, so there are always two", async () => {
    const two = [
      { abbr: "NIV", bibleId: 111 },
      { abbr: "AMP", bibleId: 1588 },
    ];
    expect(await defaultVersions(["xx"])).toEqual(two);
    expect(await defaultVersions([])).toEqual(two);
    expect(await defaultVersions(["en-US", "en"])).toEqual(two);
  });

  it("names two versions with the same abbreviation apart", async () => {
    // Spanish and Portuguese both open on an NVI.
    expect(await defaultVersions(["pt", "es-419"])).toEqual([
      { abbr: "NVI", bibleId: 129 },
      { abbr: "RVR1960", bibleId: 149 },
      { abbr: "AMP", bibleId: 1588 },
    ]);
    expect(settingFor(128, [{ abbr: "NVI", bibleId: 129 }])).toEqual({ abbr: "NVI-128", bibleId: 128 });
  });
});

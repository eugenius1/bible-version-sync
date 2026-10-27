import { HIGHLIGHT_COLORS } from "@bvs/core";
import { describe, expect, it } from "vitest";
import { completeColorOrder, DEFAULT_SETTINGS, defaultVersions, formerNames, labelVersions } from "../db";

describe("defaultVersions", () => {
  it("takes the most used version of each of the reader's first seven languages", async () => {
    expect(await defaultVersions(["en-GB", "fr", "es", "de"])).toEqual([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "LSG", bibleId: 93 },
      { abbr: "RVR1960", bibleId: 149 },
      { abbr: "DELUT", bibleId: 51 },
    ]);
    const eight = await defaultVersions(["en", "fr", "es", "de", "pt", "it", "nl", "sw"]);
    expect(eight.map((v) => v.abbr)).toEqual(["NIV", "LSG", "RVR1960", "DELUT", "NVI", "NR06", "HSV"]);
  });

  it("adds the next most used version of a lone language, so there are two", async () => {
    expect(await defaultVersions(["en-US", "en"])).toEqual([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "KJV", bibleId: 1 },
    ]);
    expect((await defaultVersions(["fr"])).map((v) => v.abbr)).toEqual(["LSG", "S21"]);
  });

  it("adds NIV and AMP to a language with a single version", async () => {
    // Batak Toba (bbc) has one version on YouVersion.
    expect((await defaultVersions(["bbc"])).map((v) => v.bibleId)).toEqual([17, 111, 1588]);
  });

  it("falls back to NIV and AMP when none of the reader's languages is known", async () => {
    const two = [
      { abbr: "NIV", bibleId: 111 },
      { abbr: "AMP", bibleId: 1588 },
    ];
    expect(await defaultVersions(["xx"])).toEqual(two);
    expect(await defaultVersions([])).toEqual(two);
  });
});

describe("labelVersions", () => {
  it("names versions as bible.com does", async () => {
    await defaultVersions([]); // loads the names
    expect(labelVersions([111, 93, 999999])).toEqual([
      { abbr: "NIV", bibleId: 111 },
      { abbr: "LSG", bibleId: 93 },
      { abbr: "999999", bibleId: 999999 },
    ]);
  });

  it("tells versions sharing an abbreviation apart by language, else by number", async () => {
    await defaultVersions([]);
    // NVI: Spanish (128), Portuguese (129) and Castilian (1637).
    expect(labelVersions([128, 129, 1637, 111]).map((v) => v.abbr)).toEqual(["NVI (es)", "NVI (pt)", "NVI (es-ES)", "NIV"]);
    // ARC: 212 and 3407 are both Portuguese.
    expect(labelVersions([212, 3407]).map((v) => v.abbr)).toEqual(["ARC (212)", "ARC (3407)"]);
    expect(labelVersions([212]).map((v) => v.abbr)).toEqual(["ARC"]);
  });
});

describe("formerNames", () => {
  it("takes the names saved with each version, over the old rule's", async () => {
    await defaultVersions([]);
    // 93 was saved as MINE; the old rule would have called 1588 "AMP" too.
    const saved = [{ abbr: "MINE", bibleId: 93 }, { abbr: "AMP", bibleId: 1 }, { abbr: "NVI-128", bibleId: 128 }];
    const names = formerNames(saved, []);
    expect(names.get("MINE")).toBe(93);
    expect(names.get("NVI-128")).toBe(128);
    expect(names.get("AMP")).toBe(1);
  });

  it("names versions saved with ids only by the old rule", async () => {
    await defaultVersions([]);
    // Settings changed, and so saved as ids, before an old snapshot was converted.
    const names = formerNames([{ bibleId: 93 }, { bibleId: 149 }], []);
    expect(names.get("LSG")).toBe(93);
    expect(names.get("RVR1960")).toBe(149);
  });

  it("names the example versions by the old rule when nothing was saved", async () => {
    await defaultVersions([]);
    const names = formerNames(undefined, [111, 93, 1588]);
    for (const [name, id] of [["NIV", 111], ["LSG", 93], ["AMP", 1588], ["LSG-93", 93], ["93", 93]] as const) {
      expect(names.get(name), name).toBe(id);
    }
  });

  it("leaves out a name two versions could have had", async () => {
    await defaultVersions([]);
    const names = formerNames(undefined, [128, 129]); // both NVI
    expect(names.has("NVI")).toBe(false);
    expect(names.get("NVI-128")).toBe(128);
    expect(names.get("NVI-129")).toBe(129);
  });
});

describe("completeColorOrder", () => {
  it("starts with purple and pink when nothing is saved", () => {
    expect(completeColorOrder(undefined).slice(0, 3)).toEqual(["purple", "pink", "green"]);
  });

  it("keeps a saved order, drops unknown colors and appends ones it lacks", () => {
    const order = completeColorOrder(["pink", "teal", "yellow", "pink"]);
    expect(order.slice(0, 4)).toEqual(["pink", "yellow", "purple", "green"]);
    expect([...order].sort()).toEqual(completeColorOrder(undefined).sort());
    expect(order).toHaveLength(10);
  });

  it("is the default order when nothing is saved", () => {
    expect(completeColorOrder(undefined)).toEqual(DEFAULT_SETTINGS.colorOrder);
  });

  it("has every palette color in the default order", () => {
    expect([...DEFAULT_SETTINGS.colorOrder].sort()).toEqual(HIGHLIGHT_COLORS.map((c) => c.id).sort());
  });
});

import { describe, expect, it } from "vitest";
import { displayRef, parseVersionInput } from "../src";

describe("parseVersionInput", () => {
  it.each([
    ["https://www.bible.com/bible/111/JHN.3.NIV", { bibleId: 111, abbr: "NIV" }],
    ["bible.com/bible/152/PSA.51.3.S21", { bibleId: 152, abbr: "S21" }],
    ["https://www.bible.com/fr/bible/93/GEN.1.LSG", { bibleId: 93, abbr: "LSG" }],
    ["1 kjv", { bibleId: 1, abbr: "KJV" }],
    ["1588", { bibleId: 1588, abbr: undefined }],
  ])("%s", (input, want) => expect(parseVersionInput(input)).toEqual(want));

  it("rejects other text", () => expect(parseVersionInput("the NIV please")).toBeNull());
});

describe("displayRef", () => {
  it("formats references", () => {
    expect(displayRef("PSA.51.3")).toBe("Psalms 51:3");
    expect(displayRef("1CO.13")).toBe("1 Corinthians 13");
    expect(displayRef("ISA.53.5", "fr")).toBe("Ésaïe 53:5");
    expect(displayRef("REV.22.21", "fr")).toBe("Apocalypse 22:21");
  });
});

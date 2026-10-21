import type { SyncState } from "@bvs/core";
import { describe, expect, it } from "vitest";
import { demoState } from "../demo";
import { syncStats } from "../stats";

const state = (s: Partial<SyncState>): SyncState => ({ keys: "bibleId", verses: {}, members: {}, unwritable: {}, maps: {}, ...s });

describe("syncStats", () => {
  it("counts verses per version, colour, book and chapter", () => {
    const s = syncStats(
      state({
        members: { "JHN.3": [111, 1588], "PSA.23": [111, 1588] },
        verses: {
          "JHN.3.16": { 111: "fffe00", 1588: "fffe00" },
          "JHN.3.17": { 111: "fffe00", 1588: "00d6ff" },
          "PSA.23.1": { 111: "ff95ef" },
        },
        unwritable: { 1588: ["PSA.23.6"] },
      }),
      [1588, 111],
    );
    expect(s.verses).toBe(3);
    expect(s.versions.map((v) => v.bibleId)).toEqual([1588, 111]);
    expect(s.versions[1]).toMatchObject({ highlights: 3, colors: { yellow: 2, pink: 1, blue: 0 } });
    expect(s.versions[0]).toMatchObject({ highlights: 2, unwritable: 1 });
    expect({ everywhere: s.everywhere, some: s.some, one: s.one, differing: s.differing }).toEqual({
      everywhere: 2, some: 0, one: 1, differing: 1,
    });
    expect(s.books.find((b) => b.book === "JHN")).toEqual({ book: "JHN", verses: 2, chaptersSynced: 1, chapters: 21 });
    expect(s.chaptersSynced).toBe(2);
    expect(s.chapters).toBe(1189);
    expect(s.topChapters).toEqual([{ chapter: "JHN.3", verses: 2 }, { chapter: "PSA.23", verses: 1 }]);
  });

  it("matches a highlight to the nearest palette colour", () => {
    const s = syncStats(state({ verses: { "JHN.3.16": { 111: "fffd00" } } }));
    expect(s.versions[0].colors.yellow).toBe(1);
  });

  it("makes demo data the page can show", () => {
    const s = syncStats(demoState());
    expect(s.verses).toBeGreaterThan(100);
    expect(s.one + s.some).toBeGreaterThan(0);
    expect(s.differing).toBeGreaterThan(0);
  });
});

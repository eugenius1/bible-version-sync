import { describe, expect, it } from "vitest";
import {
  ASSUMED_MS_PER_READ,
  ASSUMED_MS_PER_WRITE,
  BOOKS,
  ASSUMED_HIGHLIGHT_SHARE,
  RunClock,
  VersionMap,
  WriteForecast,
  emptyState,
  highlightedByBook,
  buildVersionMap,
  estimateRun,
  type Progress,
  type SyncVersion,
} from "../src";

const version = (abbr: string, id: number): SyncVersion => ({ abbr, bibleId: id, map: buildVersionMap(abbr, id).map });
const NIV = version("NIV", 111);
const AMP = version("AMP", 1588);

const reading = (readDone: number, readTotal: number, book = "PSA"): Progress =>
  ({ phase: "reading", book, done: readDone, total: readTotal, readDone, readTotal });
const writing = (done: number, total: number, readDone: number, readTotal: number, book = "PSA"): Progress =>
  ({ phase: "writing", book, done, total, readDone, readTotal });

describe("estimateRun", () => {
  it("counts every chapter each version reads, and times them at the given rate", () => {
    expect(estimateRun([NIV, AMP], { kind: "books", books: ["PSA"] })).toEqual({ reads: 300, ms: 300 * ASSUMED_MS_PER_READ });
    expect(estimateRun([NIV, AMP], { kind: "books", books: BOOKS }).reads).toBe(2 * 1189);
    expect(estimateRun([NIV, AMP], { kind: "books", books: ["JHN"] }, 250).ms).toBe(42 * 250);
  });

  it("reads one chapter per version for a chapter", () => {
    expect(estimateRun([NIV, AMP], { kind: "chapter", book: "JHN", chapter: 3 }).reads).toBe(2);
  });

  it("leaves out versions whose numbering is unsupported, as the sync does", () => {
    const refused: SyncVersion = { ...AMP, map: VersionMap.unsupported("AMP") };
    expect(estimateRun([NIV, refused], { kind: "books", books: ["PSA"] }).reads).toBe(150);
  });
});

describe("RunClock", () => {
  it("starts from the prior rate and moves towards the measured one", () => {
    const clock = new RunClock(0);
    clock.tick(reading(1, 101), 400);
    // One read at 400 ms against eight at the assumed 100 ms.
    expect(clock.msPerRead).toBeCloseTo((400 + 8 * ASSUMED_MS_PER_READ) / 9);
    for (let i = 2; i <= 100; i++) clock.tick(reading(i, 101), i * 400);
    expect(clock.msPerRead).toBeGreaterThan(370);
    expect(clock.remainingMs()).toBeCloseTo(clock.msPerRead);
    expect(clock.readsTimed).toBe(100);
  });

  it("uses a rate remembered from an earlier run as the prior", () => {
    const clock = new RunClock(0, { msPerRead: 300 });
    clock.tick(reading(1, 11), 300);
    expect(clock.msPerRead).toBeCloseTo(300);
    expect(clock.remainingMs()).toBeCloseTo(3000);
  });

  it("times writes apart from reads, and counts the writes left in the book", () => {
    const clock = new RunClock(0);
    for (let i = 1; i <= 10; i++) clock.tick(reading(i, 20), i * 100);
    clock.tick(writing(1, 5, 10, 20), 1000 + ASSUMED_MS_PER_WRITE);
    expect(clock.msPerRead).toBeCloseTo(100);
    expect(clock.msPerWrite).toBeCloseTo(ASSUMED_MS_PER_WRITE);
    expect(clock.remainingMs()).toBeCloseTo(10 * 100 + 4 * ASSUMED_MS_PER_WRITE);
    expect([clock.readsTimed, clock.writesTimed]).toEqual([10, 1]);
  });

  it("doesn't count a failed book's unread chapters as read quickly", () => {
    const clock = new RunClock(0);
    clock.tick(reading(1, 100), 100);
    // Psalms failed after one chapter, so its other 58 were skipped; the next
    // book's first read reports readDone 60 but done 1.
    clock.tick({ phase: "reading", book: "PRO", done: 1, total: 41, readDone: 60, readTotal: 100 }, 200);
    expect(clock.readsTimed).toBe(2);
    expect(clock.msPerRead).toBeCloseTo((200 + 8 * ASSUMED_MS_PER_READ) / 10);
    // What's left counts only chapters still to read, not the skipped ones.
    expect(clock.remainingMs()).toBeCloseTo(40 * clock.msPerRead);
  });

  it("is long once the run looks like taking more than five seconds, and stays so", () => {
    const quick = new RunClock(0);
    quick.tick(reading(1, 10), 100);
    expect(quick.long).toBe(false);

    const slow = new RunClock(0, { expectedMs: 6000 });
    expect(slow.long).toBe(true);
    slow.tick(reading(59, 60), 5900);
    expect(slow.remainingMs()).toBeLessThan(1000);
    expect(slow.long).toBe(true);

    const slower = new RunClock(0, { expectedMs: 1000 });
    expect(slower.long).toBe(false);
    slower.tick(reading(1, 10), 3000);
    expect(slower.long).toBe(true);
  });
});

describe("WriteForecast", () => {
  // Ruth has 85 verses, Jonah 48 (Hebrew numbering).
  it("assumes a share of verses highlighted before reading any, and every one copied to every other version", () => {
    const f = new WriteForecast(["RUT", "JON"], 3);
    expect(f.maxWrites()).toBe(2 * (Math.round(ASSUMED_HIGHLIGHT_SHARE * 85) + Math.round(ASSUMED_HIGHLIGHT_SHARE * 48)));
    expect(f.maxWrites(1)).toBe(2 * Math.round(ASSUMED_HIGHLIGHT_SHARE * 48));
  });

  it("goes by the share in the books read, or the sync memory where that's more", () => {
    const f = new WriteForecast(["RUT", "JON"], 2, { JON: 30 });
    f.bookRead("RUT", 17); // a fifth
    expect(f.maxWrites(1)).toBe(30);
    const g = new WriteForecast(["RUT", "JON"], 2, { JON: 1 });
    g.bookRead("RUT", 17);
    expect(g.maxWrites(1)).toBe(Math.round(0.2 * 48));
  });

  it("needs no writes with one version", () => {
    expect(new WriteForecast(["RUT"], 1, { RUT: 50 }).maxWrites()).toBe(0);
  });

  it("counts the sync memory's highlighted verses per book", () => {
    const state = { ...emptyState(), verses: { "RUT.1.16": { 111: "fffe00" }, "RUT.1.17": {}, "JON.2.1": { 1588: "fffe00" } } };
    expect(highlightedByBook(state)).toEqual({ RUT: 1, JON: 1 });
  });

  it("adds the most the unread books may write to what's left", () => {
    const f = new WriteForecast(["RUT", "JON"], 2, { RUT: 10, JON: 20 });
    const clock = new RunClock(0, {}, f);
    clock.tick(reading(1, 8, "RUT"), 100);
    // Ruth is still being read, so its writes may come too.
    expect(clock.maxRemainingMs() - clock.remainingMs()).toBeCloseTo(f.maxWrites(0) * clock.msPerWrite);
    clock.tick(writing(1, 5, 4, 8, "RUT"), 100 + ASSUMED_MS_PER_WRITE);
    // Ruth's writes are known now: only Jonah's are a guess.
    expect(clock.maxRemainingMs() - clock.remainingMs()).toBeCloseTo(f.maxWrites(1) * clock.msPerWrite);
    expect(new RunClock(0).maxRemainingMs()).toBe(0);
  });
});

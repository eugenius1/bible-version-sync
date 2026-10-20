import { describe, expect, it } from "vitest";
import {
  ASSUMED_MS_PER_READ,
  ASSUMED_MS_PER_WRITE,
  BOOKS,
  RunClock,
  VersionMap,
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
    // The rest of the book was skipped; the next book's first read reports a jump.
    clock.tick(reading(60, 100, "PRO"), 200);
    expect(clock.readsTimed).toBe(60);
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

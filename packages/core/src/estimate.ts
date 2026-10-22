/**
 * How long a run will take, before it starts and while it goes.
 *
 * Reads go out four at a time and writes one at a time (see readBook and
 * applyPlan), so they're timed apart. Before a run nothing has been timed, so
 * the estimate uses a rate from an earlier run when the caller has one, else
 * the assumed one below. During a run the measured rate takes over, eased in
 * from that prior so the first few chapters, one slow request among them,
 * don't swing it. Writes in books not yet read can't be known, so a sync's
 * time left is a range: at least the reads, at most those plus a write for
 * every highlighted verse in every other version (see WriteForecast).
 */

import type { Progress, Scope } from "./runner";
import { chapterScope, chaptersToRead, supported, type BookPlan, type SyncState, type SyncVersion } from "./sync";
import { parseRef, Standard } from "./versification";

/** About 350 ms a request (the client's 50 ms pause included), four reads at a time. */
export const ASSUMED_MS_PER_READ = 100;
/** Writes go one at a time. */
export const ASSUMED_MS_PER_WRITE = 350;
/** Below this a run is quick enough that an estimate is just noise. */
export const ESTIMATE_THRESHOLD_MS = 5000;
/**
 * The share of verses taken to be highlighted where nothing says otherwise:
 * about what a keen highlighter has (one with a whole Bible synced had 8%).
 */
export const ASSUMED_HIGHLIGHT_SHARE = 0.1;
/** How many requests' worth of weight the prior rate carries against measured ones. */
const PRIOR_WEIGHT = 8;

/** The chapters a run over `scope` reads, across all versions the sync may touch. */
export function chaptersInScope(versions: SyncVersion[], scope: Scope): number {
  if (scope.kind === "chapter") {
    const only = chapterScope(supported(versions), scope.book, scope.chapter).chapters;
    return chaptersToRead(versions, scope.book, only).length;
  }
  return scope.books.reduce((n, b) => n + chaptersToRead(versions, b).length, 0);
}

export interface RunEstimate {
  reads: number;
  /** The reads alone: all a preview takes, and the least a sync does. */
  ms: number;
  /** The most a sync over books may take, writes included (see WriteForecast); `ms` otherwise. */
  maxMs: number;
  /** What maxMs was worked out from, for the run's RunClock to go on with. */
  forecast?: WriteForecast;
}

/**
 * What a run over `scope` reads and how long that takes, before any of it is
 * timed. Given `writes`, the most a sync may take too.
 */
export function estimateRun(
  versions: SyncVersion[],
  scope: Scope,
  msPerRead = ASSUMED_MS_PER_READ,
  writes?: { remembered: Readonly<Record<string, number>>; msPerWrite?: number },
): RunEstimate {
  const reads = chaptersInScope(versions, scope);
  const ms = reads * msPerRead;
  if (!writes || scope.kind !== "books") return { reads, ms, maxMs: ms };
  const forecast = new WriteForecast(scope.books, supported(versions).length, writes.remembered);
  return { reads, ms, maxMs: ms + forecast.maxWrites() * (writes.msPerWrite ?? ASSUMED_MS_PER_WRITE), forecast };
}

/** Canonical verses with a highlight in some version, per book, as the sync memory has them. */
export function highlightedByBook(state: SyncState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [canon, colors] of Object.entries(state.verses)) {
    if (Object.keys(colors).length === 0) continue;
    const [book] = parseRef(canon);
    out[book] = (out[book] ?? 0) + 1;
  }
  return out;
}

/**
 * The most a sync may still write in books it hasn't read: every highlighted
 * verse copied to every other version, as if nothing were in sync yet. A book's
 * highlighted verses are taken as the most of what the sync memory has for it,
 * the share highlighted in the books read so far and ASSUMED_HIGHLIGHT_SHARE,
 * so a lightly highlighted early book can't bring the bound down to nothing.
 */
export class WriteForecast {
  private readonly verses: ReadonlyMap<string, number>;
  private readonly read = new Set<string>();
  private versesRead = 0;
  private highlightedRead = 0;

  /** `versions`: how many the sync may write to. */
  constructor(
    books: readonly string[],
    private readonly versions: number,
    private readonly remembered: Readonly<Record<string, number>> = {},
  ) {
    const counts = Standard.load().counts.org;
    this.verses = new Map(books.map((b) => [b, (counts[b] ?? []).reduce((n, v) => n + v, 0)]));
  }

  /** Record a book read and planned: its writes are known from here on. */
  bookRead(plan: BookPlan): void {
    this.read.add(plan.book);
    this.versesRead += this.verses.get(plan.book) ?? 0;
    this.highlightedRead += Object.values(plan.newState).filter((c) => Object.keys(c).length).length;
  }

  /** The most writes the books not yet read may need, leaving out `except` (one being written). */
  maxWrites(except?: string): number {
    const share = Math.max(ASSUMED_HIGHLIGHT_SHARE, this.versesRead ? this.highlightedRead / this.versesRead : 0);
    let highlighted = 0;
    for (const [book, verses] of this.verses) {
      if (book === except || this.read.has(book)) continue;
      highlighted += Math.max(this.remembered[book] ?? 0, Math.round(share * verses));
    }
    return highlighted * Math.max(0, this.versions - 1);
  }
}

/**
 * Times a run from its progress reports. Feed it every report with the time
 * it arrived; the time since the previous report is put down to the phase
 * the new report is in, since that's the work that just finished.
 */
export class RunClock {
  private readonly start: number;
  private last: number;
  private readMs = 0;
  private reads = 0;
  private writeMs = 0;
  private writes = 0;
  private prev: Progress | null = null;
  private longest = 0;

  constructor(
    now: number,
    private readonly prior: { msPerRead?: number; msPerWrite?: number; expectedMs?: number } = {},
    /** For a sync over books: what it may write in those not yet read. A preview writes nothing. */
    private readonly forecast?: WriteForecast,
  ) {
    this.start = now;
    this.last = now;
    this.longest = prior.expectedMs ?? 0;
  }

  /** Record a progress report. */
  tick(p: Progress, now: number): void {
    const dt = Math.max(0, now - this.last);
    this.last = now;
    if (p.phase === "reading") {
      // Count by the book's own counter, not readDone: a book whose read
      // failed jumps readDone past chapters that were skipped, not read.
      const sameBook = this.prev?.phase === "reading" && this.prev.book === p.book;
      const n = Math.max(0, p.done - (sameBook ? this.prev!.done : 0));
      if (n) {
        this.readMs += dt;
        this.reads += n;
      }
    } else {
      const sameBook = this.prev?.phase === "writing" && this.prev.book === p.book;
      const n = Math.max(0, p.done - (sameBook ? this.prev!.done : 0));
      if (n) {
        this.writeMs += dt;
        this.writes += n;
      }
    }
    this.prev = p;
    this.longest = Math.max(this.longest, now - this.start + this.maxRemainingMs());
  }

  /** Milliseconds per chapter read, measured and eased in from the prior. */
  get msPerRead(): number {
    const prior = this.prior.msPerRead ?? ASSUMED_MS_PER_READ;
    return (this.readMs + prior * PRIOR_WEIGHT) / (this.reads + PRIOR_WEIGHT);
  }

  get msPerWrite(): number {
    const prior = this.prior.msPerWrite ?? ASSUMED_MS_PER_WRITE;
    return (this.writeMs + prior * PRIOR_WEIGHT) / (this.writes + PRIOR_WEIGHT);
  }

  /** Requests timed so far: a rate with none behind it is just the prior. */
  get readsTimed(): number {
    return this.reads;
  }

  get writesTimed(): number {
    return this.writes;
  }

  /** What's left: unread chapters, plus the writes left in the book being written. */
  remainingMs(): number {
    const p = this.prev;
    if (!p) return 0;
    const reads = Math.max(0, p.readTotal - p.readDone) * this.msPerRead;
    const writes = p.phase === "writing" ? Math.max(0, p.total - p.done) * this.msPerWrite : 0;
    return reads + writes;
  }

  /**
   * The most that's left: remainingMs plus the writes the books not yet read
   * may need (see WriteForecast). The same as remainingMs without a forecast.
   */
  maxRemainingMs(): number {
    // A book being written has its writes counted in remainingMs.
    const writing = this.prev?.phase === "writing" ? this.prev.book : undefined;
    return this.remainingMs() + (this.forecast?.maxWrites(writing) ?? 0) * this.msPerWrite;
  }

  /**
   * Whether the run has looked, at any point, like taking longer than the
   * threshold. Once it has, the estimate stays up to the end rather than
   * vanishing as the last few seconds count down.
   */
  get long(): boolean {
    return this.longest > ESTIMATE_THRESHOLD_MS;
  }
}

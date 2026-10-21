/**
 * How long a run will take, before it starts and while it goes.
 *
 * Reads go out four at a time and writes one at a time (see readBook and
 * applyPlan), so they're timed apart. Before a run nothing has been timed, so
 * the estimate uses a rate from an earlier run when the caller has one, else
 * the assumed one below. During a run the measured rate takes over, eased in
 * from that prior so the first few chapters, one slow request among them,
 * don't swing it. Writes in books not yet read can't be known, so they're
 * left out: a sync with many changes takes longer than its estimate.
 */

import type { Progress, Scope } from "./runner";
import { chapterScope, chaptersToRead, supported, type SyncVersion } from "./sync";

/** About 350 ms a request (the client's 50 ms pause included), four reads at a time. */
export const ASSUMED_MS_PER_READ = 100;
/** Writes go one at a time. */
export const ASSUMED_MS_PER_WRITE = 350;
/** Below this a run is quick enough that an estimate is just noise. */
export const ESTIMATE_THRESHOLD_MS = 5000;
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
  ms: number;
}

/** What a run over `scope` reads and how long that takes, before any of it is timed. */
export function estimateRun(
  versions: SyncVersion[],
  scope: Scope,
  msPerRead = ASSUMED_MS_PER_READ,
): RunEstimate {
  const reads = chaptersInScope(versions, scope);
  return { reads, ms: reads * msPerRead };
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
    this.longest = Math.max(this.longest, now - this.start + this.remainingMs());
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
   * Whether the run has looked, at any point, like taking longer than the
   * threshold. Once it has, the estimate stays up to the end rather than
   * vanishing as the last few seconds count down.
   */
  get long(): boolean {
    return this.longest > ESTIMATE_THRESHOLD_MS;
  }
}

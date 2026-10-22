/**
 * Runs a sync over a set of books (or one chapter), with progress callbacks.
 * Shared by the PWA and, later, the server.
 */

import { ApiError, type HighlightsApi } from "./api";
import {
  applyPlan,
  chapterScope,
  chaptersToRead,
  planBook,
  readBook,
  supported,
  type Action,
  type BookPlan,
  type PlanOptions,
  type SyncState,
  type SyncVersion,
} from "./sync";

export type Scope = { kind: "books"; books: string[] } | { kind: "chapter"; book: string; chapter: number };

export interface RunOptions extends PlanOptions {
  api: HighlightsApi;
  versions: SyncVersion[];
  scope: Scope;
  /** Mutated in place when applying; persist it after each book via onBookDone. */
  state: SyncState;
  apply: boolean;
  /** Refuse books that would push removals in this run above this number. */
  maxRemovals?: number;
  allowRemovals?: boolean;
  concurrency?: number;
  /**
   * The books of an earlier run of the same scope that stopped early. Books it
   * finished aren't read again: their results are carried into this run's
   * summary, and their removals count towards maxRemovals. Only pass the
   * results of a run with the same versions, colour order and `apply`.
   */
  resume?: BookResult[];
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  /** `books` is every result so far, with those kept from `resume`: what a later run would resume from. */
  onBookDone?: (r: BookResult, books: readonly BookResult[]) => void | Promise<void>;
}

export interface Progress {
  phase: "reading" | "writing";
  book: string;
  done: number;
  total: number;
  /** Chapters read so far across the whole run / total chapters to read. */
  readDone: number;
  readTotal: number;
}

export interface BookResult {
  book: string;
  plan?: BookPlan;
  /** Set when the book was skipped because highlights couldn't be read. */
  readError?: string;
  /** Set when applying was refused because of the removal limit. */
  blocked?: { removals: number; limit: number };
  writeErrors: string[];
  /** The actions that were written, each with the colour it replaced. */
  written?: Action[];
  /** Set when writing stopped partway (see RunSummary.fatal); a resumed run does the book again. */
  unfinished?: boolean;
}

export interface RunSummary {
  books: BookResult[];
  sets: number;
  removals: number;
  differences: number;
  failedBooks: number;
  blockedBooks: number;
  writeErrors: number;
  aborted: boolean;
  /**
   * Set when the run stopped early because YouVersion couldn't be used at all
   * (sign-in expired, offline or rate limited); the rest of the book being
   * written and later books were not attempted.
   */
  fatal?: {
    reason: "auth" | "network" | "rateLimited";
    message: string;
    /** For "rateLimited": seconds YouVersion asked to wait, when it said. */
    retryAfter?: number;
  };
  /**
   * Versions (bible ids) left out because their numbering is unsupported:
   * nothing was read or written for them, and their snapshot is untouched.
   */
  refused: number[];
}

/**
 * The results of a stopped run that a resumed one keeps rather than doing
 * again: books read and planned, and written in full when applying. A book
 * held back by the removal limit is done again once removals are allowed.
 */
export function finishedBooks(earlier: readonly BookResult[], allowRemovals = false): BookResult[] {
  return earlier.filter((r) => r.plan && !r.unfinished && !(allowRemovals && r.blocked));
}

/** What of `scope` a run resuming from `earlier` (see RunOptions.resume) still has to do. */
export function remainingScope(scope: Scope, earlier: readonly BookResult[] = [], allowRemovals = false): Scope {
  if (scope.kind === "chapter") return scope;
  const done = new Set(finishedBooks(earlier, allowRemovals).map((r) => r.book));
  return { kind: "books", books: scope.books.filter((b) => !done.has(b)) };
}

export async function runSync(o: RunOptions): Promise<RunSummary> {
  const books = o.scope.kind === "books" ? o.scope.books : [o.scope.book];
  const versions = supported(o.versions);
  const refused = o.versions.filter((v) => !versions.includes(v)).map((v) => v.bibleId);
  const summary: RunSummary = {
    books: [], sets: 0, removals: 0, differences: 0, failedBooks: 0, blockedBooks: 0, writeErrors: 0, aborted: false,
    refused,
  };
  if (versions.length === 0) return summary;
  const order = new Map(books.map((b, i) => [b, i]));
  const resume = o.scope.kind === "books" ? (o.resume ?? []).filter((r) => order.has(r.book)) : [];
  const kept = finishedBooks(resume, o.allowRemovals);
  for (const r of kept) count(summary, r, o.apply);
  // What a book cut off mid-write did write, so this run's report includes it.
  const partly = new Map(resume.filter((r) => r.unfinished).map((r) => [r.book, r.written ?? []]));
  const todo = books.filter((b) => !kept.some((r) => r.book === b));
  const scope = o.scope.kind === "chapter" ? chapterScope(versions, o.scope.book, o.scope.chapter) : undefined;
  const readTotal = todo.reduce((n, b) => n + chaptersToRead(versions, b, scope?.chapters).length, 0);
  const maxRemovals = o.maxRemovals ?? 25;
  let readDone = 0;
  let removalsSoFar = o.apply ? summary.removals : 0;

  for (const book of todo) {
    if (o.signal?.aborted) {
      summary.aborted = true;
      break;
    }
    const result: BookResult = { book, writeErrors: [] };
    const bookTotal = chaptersToRead(versions, book, scope?.chapters).length;
    let bookDone = 0;
    try {
      const current = await readBook(o.api, versions, book, {
        concurrency: o.concurrency,
        chapters: scope?.chapters,
        signal: o.signal,
        onChapter: () => {
          readDone++;
          bookDone++;
          o.onProgress?.({ phase: "reading", book, done: bookDone, total: bookTotal, readDone, readTotal });
        },
      });
      // All of them: planBook keeps the refused versions' snapshot.
      result.plan = planBook(book, o.versions, current, o.state, scope?.canon, { colorOrder: o.colorOrder });
    } catch (e) {
      // Stopped mid-read: nothing of this book was planned or written, and it
      // isn't reported, so a half-read book can never look like removals.
      if (o.signal?.aborted) {
        summary.aborted = true;
        break;
      }
      if (!(e instanceof ApiError)) throw e;
      result.readError = e.message;
      readDone += bookTotal - bookDone;
      count(summary, result, o.apply);
      await o.onBookDone?.(result, summary.books);
      if (e.stopsRun) {
        // Every other book would fail the same way; stop instead of hammering.
        summary.fatal = fatal(e);
        break;
      }
      continue;
    }

    const plan = result.plan;
    // A preview counts what it would do; a run that applies counts only what
    // it went on to write, so a book held back by the limit, or a write that
    // failed or never went out, isn't reported as done.
    if (o.apply) {
      const rems = plan.actions.filter((a) => a.op === "remove").length;
      if (rems && removalsSoFar + rems > maxRemovals && !o.allowRemovals) {
        result.blocked = { removals: rems, limit: maxRemovals };
      } else {
        removalsSoFar += rems;
        let done = 0;
        const applied = await applyPlan(o.api, versions, plan, o.state, () => {
          done++;
          o.onProgress?.({ phase: "writing", book, done, total: plan.actions.length, readDone, readTotal });
        });
        result.writeErrors = applied.errors;
        result.written = applied.written;
        if (applied.stoppedBy) {
          summary.fatal = fatal(applied.stoppedBy);
          result.unfinished = true;
        }
      }
      const before = partly.get(book);
      if (before?.length) {
        result.written = [...before, ...(result.written ?? [])];
        plan.actions = [...before, ...plan.actions];
      }
    }
    count(summary, result, o.apply);
    await o.onBookDone?.(result, summary.books);
    if (summary.fatal) break;
  }
  if (o.signal?.aborted) summary.aborted = true;
  // Books done again on resuming come after the ones kept: back in the scope's order.
  summary.books.sort((a, b) => order.get(a.book)! - order.get(b.book)!);
  return summary;
}

/** Adds a book's result to the summary's totals. */
function count(s: RunSummary, r: BookResult, apply: boolean): void {
  s.books.push(r);
  if (r.readError) s.failedBooks++;
  if (r.blocked) s.blockedBooks++;
  s.writeErrors += r.writeErrors.length;
  if (!r.plan) return;
  s.differences += r.plan.differences.length;
  for (const a of apply ? (r.written ?? []) : r.plan.actions) {
    if (a.op === "set") s.sets++;
    else s.removals++;
  }
}

function fatal(e: ApiError): NonNullable<RunSummary["fatal"]> {
  const reason = e.status === 401 ? "auth" : e.status === 429 ? "rateLimited" : "network";
  return { reason, message: e.message, retryAfter: e.retryAfter };
}

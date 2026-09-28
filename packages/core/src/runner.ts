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
  type BookPlan,
  type SyncState,
  type SyncVersion,
} from "./sync";

export type Scope = { kind: "books"; books: string[] } | { kind: "chapter"; book: string; chapter: number };

export interface RunOptions {
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
  signal?: AbortSignal;
  onProgress?: (p: Progress) => void;
  onBookDone?: (r: BookResult) => void | Promise<void>;
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
  blocked?: string;
  writeErrors: string[];
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
   * (sign-in expired or offline); later books were not attempted.
   */
  fatal?: { reason: "auth" | "network"; message: string };
}

export async function runSync(o: RunOptions): Promise<RunSummary> {
  const books = o.scope.kind === "books" ? o.scope.books : [o.scope.book];
  const scope = o.scope.kind === "chapter" ? chapterScope(o.versions, o.scope.book, o.scope.chapter) : undefined;
  const readTotal = books.reduce((n, b) => n + chaptersToRead(o.versions, b, scope?.chapters).length, 0);
  const maxRemovals = o.maxRemovals ?? 25;
  const summary: RunSummary = {
    books: [], sets: 0, removals: 0, differences: 0, failedBooks: 0, blockedBooks: 0, writeErrors: 0, aborted: false,
  };
  let readDone = 0;
  let removalsSoFar = 0;

  for (const book of books) {
    if (o.signal?.aborted) {
      summary.aborted = true;
      break;
    }
    const result: BookResult = { book, writeErrors: [] };
    const bookTotal = chaptersToRead(o.versions, book, scope?.chapters).length;
    let bookDone = 0;
    try {
      const current = await readBook(o.api, o.versions, book, {
        concurrency: o.concurrency,
        chapters: scope?.chapters,
        onChapter: () => {
          readDone++;
          bookDone++;
          o.onProgress?.({ phase: "reading", book, done: bookDone, total: bookTotal, readDone, readTotal });
        },
      });
      result.plan = planBook(book, o.versions, current, o.state, scope?.canon);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      result.readError = e.message;
      summary.failedBooks++;
      readDone += bookTotal - bookDone;
      summary.books.push(result);
      await o.onBookDone?.(result);
      if (e.status === 401 || e.status === 0) {
        // Every other book would fail the same way; stop instead of hammering.
        summary.fatal = { reason: e.status === 401 ? "auth" : "network", message: e.message };
        break;
      }
      continue;
    }

    const plan = result.plan;
    const sets = plan.actions.filter((a) => a.op === "set").length;
    const rems = plan.actions.length - sets;
    summary.sets += sets;
    summary.removals += rems;
    summary.differences += plan.differences.length;

    if (o.apply && !o.signal?.aborted) {
      if (rems && removalsSoFar + rems > maxRemovals && !o.allowRemovals) {
        result.blocked = `would remove ${rems} highlights (limit ${maxRemovals} per run)`;
        summary.blockedBooks++;
      } else {
        removalsSoFar += rems;
        let done = 0;
        result.writeErrors = await applyPlan(o.api, o.versions, plan, o.state, () => {
          done++;
          o.onProgress?.({ phase: "writing", book, done, total: plan.actions.length, readDone, readTotal });
        });
        summary.writeErrors += result.writeErrors.length;
      }
    }
    summary.books.push(result);
    await o.onBookDone?.(result);
  }
  return summary;
}

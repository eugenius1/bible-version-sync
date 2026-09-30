import { ApiError, type HighlightsApi } from "./api";

/**
 * Chapters people highlight most, in the order they're tried: most likely
 * first, since a version stops being asked about at its first hit.
 * YouVersion publishes a yearly most highlighted, shared and bookmarked verse:
 * Isaiah 41:10 five times since 2018, Philippians 4:6 twice. John 3:16 has
 * never been it there but is the best known verse of all. Each chapter costs
 * a request per version without highlights, so the list stays short. None is
 * a Psalm or has a chapter number or verse count that differs between
 * numbering systems, so the same passage id means the same text in every
 * version.
 */
export const PROBE_CHAPTERS = ["ISA.41", "PHP.4", "JHN.3"] as const;

export interface DiscoverOptions {
  api: Pick<HighlightsApi, "getHighlights">;
  bibleIds: number[];
  chapters?: readonly string[];
  /** Requests in flight at once; the client backs off on its own when rate limited. */
  concurrency?: number;
  signal?: AbortSignal;
  /** Called as each version is found to have highlights, and after every request. */
  onProgress?: (p: DiscoverProgress) => void;
}

export interface DiscoverProgress {
  done: number;
  total: number;
  /** Bible id -> highlighted verses seen in the first probed chapter that had any. */
  found: Map<number, number>;
}

/**
 * Which of these versions the signed-in person has highlighted in. The API
 * can only read highlights one version and one chapter at a time, and has no
 * "list my highlights", so this samples a few popular chapters per version
 * and stops at a version's first hit. A version with highlights only
 * elsewhere is missed; that's the price of a scan measured in seconds rather
 * than the ~1,200 requests a whole Bible costs per version.
 *
 * Read-only. A version the API refuses (not readable, a book it lacks) just
 * counts as not found; a network or sign-in failure stops the scan, since
 * every other request would fail the same way.
 */
export async function discoverVersions(o: DiscoverOptions): Promise<Map<number, number>> {
  const chapters = o.chapters ?? PROBE_CHAPTERS;
  const found = new Map<number, number>();
  const ids = [...new Set(o.bibleIds)];
  const total = ids.length * chapters.length;
  let done = 0;
  const report = () => o.onProgress?.({ done, total, found });

  // Chapter by chapter across all versions, so the first results come in
  // after one request per version rather than after the first few versions.
  const queue: [number, string][] = chapters.flatMap((c) => ids.map((id): [number, string] => [id, c]));
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      o.signal?.throwIfAborted();
      const [id, chapter] = job;
      if (found.has(id)) {
        done++;
        continue;
      }
      try {
        const verses = new Set((await o.api.getHighlights(id, chapter)).map((h) => h.passage_id));
        if (verses.size) found.set(id, verses.size);
      } catch (e) {
        if (!(e instanceof ApiError) || e.retryable || e.status === 401) {
          queue.length = 0; // stop the other workers too
          throw e;
        }
      }
      done++;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 4) }, worker));
  report();
  return found;
}

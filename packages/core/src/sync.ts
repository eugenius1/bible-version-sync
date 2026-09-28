/**
 * Highlight sync across Bible versions.
 *
 * The snapshot (SyncState) remembers, per canonical verse, the color each
 * version had after the last sync. For every verse we compare each version's
 * current color with its own snapshot:
 *
 *   - nothing changed              -> nothing to do
 *   - one or more versions changed -> that change is the "new value"
 *     (if they changed to different colors, the first listed version wins)
 *
 * The new value is then applied to the *other* versions, but existing
 * highlights are never overwritten with a different color:
 *
 *   - a version with no highlight on the verse gets it (fill in)
 *   - a version whose highlight is still the color the sync last left there
 *     follows a recolor or removal
 *   - a version with its own, different color keeps it
 *
 * On the first sync nothing is in the snapshot, so every highlight counts as
 * new: blanks are filled and nothing is removed or recolored.
 *
 * Safety: if reading any chapter of a book fails, the whole book is skipped,
 * so a failed read can never look like "highlight removed".
 */

import { ApiError, type HighlightsApi } from "./api";
import { parseRef, ref, type Ref, type VersionMap } from "./versification";

export interface SyncVersion {
  abbr: string;
  bibleId: number;
  map: VersionMap;
}

export interface SyncState {
  /** canonical ref -> {abbr: color} left by the last sync */
  verses: Record<Ref, Record<string, string>>;
  /**
   * canonical chapter ("PSA.51") -> versions that took part when it was last
   * synced. A version missing here (e.g. added later) has its blanks filled
   * rather than having them read as "highlight removed".
   */
  members: Record<string, string[]>;
  /** abbr -> canonical refs the API refused to write for that version */
  unwritable: Record<string, Ref[]>;
}

export const emptyState = (): SyncState => ({ verses: {}, members: {}, unwritable: {} });

const chapterKey = (canon: Ref) => canon.slice(0, canon.lastIndexOf("."));

/** Forget a version everywhere in the snapshot (call when it's removed from the list). */
export function forgetVersion(state: SyncState, abbr: string): void {
  for (const colors of Object.values(state.verses)) delete colors[abbr];
  for (const [k, list] of Object.entries(state.members)) state.members[k] = list.filter((a) => a !== abbr);
  delete state.unwritable[abbr];
}

export interface Action {
  version: string;
  op: "set" | "remove";
  local: Ref;
  color: string | null;
  canon: Ref;
  reason: "fill" | "recolor" | "remove";
}

export interface Difference {
  canon: Ref;
  /** The verse as numbered in the first listed version (for display). */
  ref: Ref;
  /** abbr -> its new color (null = removed) */
  colors: Record<string, string | null>;
  /** The version whose color blank versions get. */
  winner: string;
  color: string | null;
}

export interface BookPlan {
  book: string;
  actions: Action[];
  /** Verses changed to different colors in different versions (each keeps its own). */
  differences: Difference[];
  /** canonical ref -> {abbr: color} expected after the actions run */
  newState: Record<Ref, Record<string, string>>;
  /** canonical chapter -> versions taking part in this sync */
  members: Record<string, string[]>;
  /** Highlights currently present, per version (for display). */
  counts: Record<string, number>;
}

/** abbr -> local ref -> color */
export type BookHighlights = Record<string, Map<Ref, string>>;

const norm = (c: string | null | undefined) => (c ? c.toLowerCase().replace(/^#/, "") : null);

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Limit a sync to one chapter, numbered as in the first listed version.
 * Returns the canonical verses in it and which local chapters each version
 * must read (e.g. English Malachi 4 is chapter 3 in S21).
 */
export function chapterScope(versions: SyncVersion[], book: string, chapter: number): {
  canon: Set<Ref>;
  chapters: Record<string, Set<number>>;
} {
  const first = versions[0].map;
  const canon = new Set<Ref>();
  const n = first.counts[book]?.[chapter] ?? 0;
  for (let v = 1; v <= n; v++) {
    const c = first.toCanon.get(ref(book, chapter, v));
    if (c) canon.add(c);
  }
  const chapters: Record<string, Set<number>> = {};
  for (const ver of versions) {
    const set = new Set<number>();
    for (const c of canon) for (const l of ver.map.fromCanon.get(c) ?? []) set.add(parseRef(l)[1]);
    chapters[ver.abbr] = set;
  }
  return { canon, chapters };
}

/** Chapters that will be read for `book` (for progress reporting). */
export function chaptersToRead(versions: SyncVersion[], book: string, only?: Record<string, Set<number>>) {
  return versions.flatMap((v) =>
    v.map.chapters(book).filter((c) => !only || only[v.abbr]?.has(c)).map((c) => ({ version: v, chapter: c })),
  );
}

/** Fetch every highlight in `book` for each version. Throws if any chapter can't be read. */
export async function readBook(
  api: HighlightsApi,
  versions: SyncVersion[],
  book: string,
  opts: { concurrency?: number; chapters?: Record<string, Set<number>>; onChapter?: () => void } = {},
): Promise<BookHighlights> {
  const jobs = chaptersToRead(versions, book, opts.chapters);
  const out: BookHighlights = Object.fromEntries(versions.map((v) => [v.abbr, new Map()]));
  const results = await pool(jobs, opts.concurrency ?? 4, async (job) => {
    const items = await api.getHighlights(job.version.bibleId, `${book}.${job.chapter}`);
    opts.onChapter?.();
    return { abbr: job.version.abbr, items };
  });
  for (const { abbr, items } of results) {
    for (const h of items) {
      const color = norm(h.color);
      if (!h.passage_id || !color) continue;
      try {
        parseRef(h.passage_id);
      } catch {
        continue; // unexpected passage format
      }
      out[abbr].set(h.passage_id, color);
    }
  }
  return out;
}

export function planBook(
  book: string,
  versions: SyncVersion[],
  current: BookHighlights,
  state: SyncState,
  only?: Set<Ref>,
): BookPlan {
  const plan: BookPlan = { book, actions: [], differences: [], newState: {}, members: {}, counts: {} };
  const priority = versions.map((v) => v.abbr);

  // Canonical view per version. A canonical verse can cover several local
  // verses (e.g. 2 Cor 13:12-13 in English = 13:12 in French); any
  // highlighted one counts.
  const canonColors: Record<string, Map<Ref, string>> = {};
  for (const v of versions) {
    const cc = new Map<Ref, string>();
    for (const [local, color] of current[v.abbr] ?? []) {
      const canon = v.map.toCanon.get(local);
      if (canon && !cc.has(canon)) cc.set(canon, color);
    }
    canonColors[v.abbr] = cc;
    plan.counts[v.abbr] = current[v.abbr]?.size ?? 0;
  }

  const universe = new Set<Ref>();
  for (const cc of Object.values(canonColors)) for (const c of cc.keys()) universe.add(c);
  for (const k of Object.keys(state.verses)) if (k.startsWith(`${book}.`)) universe.add(k);
  const sorted = [...universe]
    .filter((c) => !only || only.has(c))
    .sort((a, b) => {
      const [, ca, va] = parseRef(a);
      const [, cb, vb] = parseRef(b);
      return ca - cb || va - vb;
    });

  for (const canon of sorted) {
    const prev = state.verses[canon] ?? {};
    const participants = versions.filter(
      (v) => (v.map.fromCanon.get(canon)?.length ?? 0) > 0 && !(state.unwritable[v.abbr] ?? []).includes(canon),
    );
    if (participants.length === 0) continue;
    const key = chapterKey(canon);
    const members = state.members[key];
    plan.members[key] = [...new Set([...(plan.members[key] ?? members ?? []), ...participants.map((v) => v.abbr)])];
    // Versions that weren't part of this chapter's last sync (e.g. just added).
    const newcomers = new Set(members ? participants.map((v) => v.abbr).filter((a) => !members.includes(a)) : []);

    const cur: Record<string, string | null> = {};
    for (const v of participants) cur[v.abbr] = canonColors[v.abbr].get(canon) ?? null;
    const result: Record<string, string> = {};
    for (const [a, c] of Object.entries(cur)) if (c) result[a] = c;
    const changed: Record<string, string | null> = {};
    for (const [a, c] of Object.entries(cur)) if (c !== (prev[a] ?? null)) changed[a] = c;

    const addActions = (v: SyncVersion, op: Action["op"], reason: Action["reason"], color: string | null) => {
      for (const local of v.map.fromCanon.get(canon)!) {
        const lhave = current[v.abbr]?.get(local) ?? null;
        if (op === "remove" && lhave !== null) {
          plan.actions.push({ version: v.abbr, op, local, color: null, canon, reason });
        } else if (op === "set" && lhave !== color) {
          plan.actions.push({ version: v.abbr, op, local, color, canon, reason });
        }
      }
      if (op === "remove") delete result[v.abbr];
      else result[v.abbr] = color!;
    };

    if (Object.keys(changed).length > 0) {
      const winner = priority.find((a) => a in changed)!;
      const target = changed[winner];
      const old = prev[winner] ?? null; // the color the sync last left in the winner
      if (new Set(Object.values(changed)).size > 1) {
        plan.differences.push({
          canon,
          ref: versions[0].map.fromCanon.get(canon)?.[0] ?? canon,
          colors: { ...changed },
          winner,
          color: target,
        });
      }
      for (const v of participants) {
        const a = v.abbr;
        if (a in changed || newcomers.has(a)) continue; // own changes are never overridden
        const have = cur[a];
        const synced = have !== null && have === (prev[a] ?? null) && have === old;
        if (target === null) {
          if (synced) addActions(v, "remove", "remove", null);
        } else if (have === null) {
          addActions(v, "set", "fill", target);
        } else if (synced && have !== target) {
          addActions(v, "set", "recolor", target);
        }
      }
    }

    // Newcomers with a blank get the verse's color (first listed version's).
    for (const v of participants) {
      if (!newcomers.has(v.abbr) || cur[v.abbr] !== null) continue;
      const color = priority.map((a) => result[a]).find(Boolean);
      if (color) addActions(v, "set", "fill", color);
    }

    if (Object.keys(result).length || canon in state.verses) plan.newState[canon] = result;
  }
  return plan;
}

/** Execute the plan and update `state` in place. Returns error messages. */
export async function applyPlan(
  api: HighlightsApi,
  versions: SyncVersion[],
  plan: BookPlan,
  state: SyncState,
  onAction?: () => void,
): Promise<string[]> {
  const byAbbr = new Map(versions.map((v) => [v.abbr, v]));
  const retry = new Set<Ref>(); // canonical refs to leave for next run
  const rejected = new Map<Ref, Set<string>>(); // canonical ref -> versions the API refused
  const errors: string[] = [];
  for (const a of plan.actions) {
    const v = byAbbr.get(a.version)!;
    try {
      if (a.op === "set") await api.setHighlight(v.bibleId, a.local, a.color!);
      else await api.deleteHighlight(v.bibleId, a.local);
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      errors.push(`${a.version} ${a.op} ${a.local}: ${e.message}`);
      if (e.retryable) {
        retry.add(a.canon);
      } else {
        // The API won't take this verse for this version (e.g. a verse the
        // translation omits). Stop including that version for this verse.
        if (!rejected.has(a.canon)) rejected.set(a.canon, new Set());
        rejected.get(a.canon)!.add(a.version);
        const list = (state.unwritable[a.version] ??= []);
        if (!list.includes(a.canon)) list.push(a.canon);
      }
    }
    onAction?.();
  }
  for (const [key, list] of Object.entries(plan.members)) state.members[key] = list;
  for (const [canon, colors] of Object.entries(plan.newState)) {
    if (retry.has(canon)) continue; // keep the old snapshot so the next run tries again
    const kept = Object.fromEntries(Object.entries(colors).filter(([a]) => !rejected.get(canon)?.has(a)));
    if (Object.keys(kept).length) state.verses[canon] = kept;
    else delete state.verses[canon];
  }
  return errors;
}

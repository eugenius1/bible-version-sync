import {
  BOOKS,
  chapterKey,
  HIGHLIGHT_COLORS,
  nearestColor,
  parseRef,
  Standard,
  type HighlightColorId,
  type SyncState,
} from "@bvs/core";

export interface VersionStats {
  bibleId: number;
  highlights: number;
  /** Highlights by the nearest palette colour, every colour present (0 when unused). */
  colors: Record<HighlightColorId, number>;
  /** Verses YouVersion refused to take in this version. */
  unwritable: number;
}

export interface BookStats {
  book: string;
  /** Canonical verses with a highlight in at least one version. */
  verses: number;
  chaptersSynced: number;
  chapters: number;
}

export interface Stats {
  /** Canonical verses with a highlight in at least one version. */
  verses: number;
  /** In every version that took part in the verse's chapter, in only some, or in just one. */
  everywhere: number;
  some: number;
  one: number;
  /** Highlighted in several versions, not all in the same palette colour. */
  differing: number;
  chaptersSynced: number;
  chapters: number;
  /** In the order of the person's list, then the most highlighted first. */
  versions: VersionStats[];
  /** Bible order, every book. */
  books: BookStats[];
  /** Most highlighted first, at most five. */
  topChapters: { chapter: string; verses: number }[];
}

const BOOK_INDEX = new Map(BOOKS.map((b, i) => [b, i]));

const noColors = () => Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c.id, 0])) as Record<HighlightColorId, number>;

/**
 * What the sync memory says about the person's highlights. It's the state
 * after the last sync of each chapter, not YouVersion as it is now, and it
 * can't tell a highlight the sync copied from one the person made.
 */
export function syncStats(state: SyncState, order: readonly number[] = []): Stats {
  const versions = new Map<number, VersionStats>();
  const version = (id: number) => {
    let v = versions.get(id);
    if (!v) versions.set(id, (v = { bibleId: id, highlights: 0, colors: noColors(), unwritable: 0 }));
    return v;
  };
  const counts = Standard.load().counts.org;
  const books = new Map<string, BookStats>(
    BOOKS.map((book) => [book, { book, verses: 0, chaptersSynced: 0, chapters: counts[book]?.length ?? 0 }]),
  );
  const byChapter = new Map<string, number>();
  // Only a few distinct colours are ever used, so each is matched once.
  const palette = new Map<string, HighlightColorId>();
  const paletteColor = (hex: string) => {
    let id = palette.get(hex);
    if (!id) palette.set(hex, (id = nearestColor(hex)));
    return id;
  };
  const stats: Stats = {
    verses: 0, everywhere: 0, some: 0, one: 0, differing: 0, chaptersSynced: 0, chapters: 0,
    versions: [], books: [], topChapters: [],
  };

  for (const [chapter, ids] of Object.entries(state.members)) {
    const b = books.get(chapter.split(".")[0]);
    if (!b || ids.length === 0) continue;
    b.chaptersSynced++;
    for (const id of ids) version(id);
  }

  for (const [canon, colors] of Object.entries(state.verses)) {
    const ids = Object.keys(colors).map(Number);
    if (ids.length === 0) continue;
    const [book] = parseRef(canon);
    const chapter = chapterKey(canon);
    stats.verses++;
    const b = books.get(book);
    if (b) b.verses++;
    byChapter.set(chapter, (byChapter.get(chapter) ?? 0) + 1);
    const used = new Set<HighlightColorId>();
    for (const id of ids) {
      const v = version(id);
      const color = paletteColor(colors[id]);
      v.highlights++;
      v.colors[color]++;
      used.add(color);
    }
    if (used.size > 1) stats.differing++;
    const members = state.members[chapter]?.length || ids.length;
    if (members > 1 && ids.length === 1) stats.one++;
    else if (ids.length >= members) stats.everywhere++;
    else stats.some++;
  }

  for (const [id, refs] of Object.entries(state.unwritable)) if (refs.length) version(Number(id)).unwritable = refs.length;

  const rank = (id: number) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  stats.versions = [...versions.values()].sort((a, b) => rank(a.bibleId) - rank(b.bibleId) || b.highlights - a.highlights);
  stats.books = [...books.values()];
  stats.chaptersSynced = stats.books.reduce((n, b) => n + b.chaptersSynced, 0);
  stats.chapters = stats.books.reduce((n, b) => n + b.chapters, 0);
  stats.topChapters = [...byChapter]
    .sort((a, b) => b[1] - a[1] || BOOK_INDEX.get(a[0].split(".")[0])! - BOOK_INDEX.get(b[0].split(".")[0])!)
    .slice(0, 5)
    .map(([chapter, verses]) => ({ chapter, verses }));
  return stats;
}

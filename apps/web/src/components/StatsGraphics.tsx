import { HIGHLIGHT_HEX, type HighlightColorId } from "@bvs/core";
import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import type { Cell } from "../lib/scene3d";
import type { BookStats, ColorCounts, Stats } from "../lib/stats";
import { Scene3D } from "./Scene3D";

/** A tower's slabs from the ground up: the person's first colour goes on top, where it shows most. */
const slabs = (colors: readonly HighlightColorId[], counts: ColorCounts) =>
  colors.filter((id) => counts[id]).reverse().map((id) => ({ value: counts[id] ?? 0, color: HIGHLIGHT_HEX[id] }));

/** Where the New Testament starts in a list of books. */
const newTestament = (books: readonly BookStats[]) => Math.max(books.findIndex((b) => b.book === "MAT"), 0);

interface BooksProps {
  stats: Stats;
  /** The person's colours, in their order. */
  colors: readonly HighlightColorId[];
  /** A book's figures as a sentence, for the pointer. */
  label: (book: BookStats) => string;
}

/**
 * The 66 books as a block of towers, in reading order from the far left to
 * the near right. The ground is a shade apart for the two testaments.
 */
export function BookSkyline({ stats, colors, label }: BooksProps) {
  const { t, book } = useI18n();
  const books = stats.books;
  const scene = useMemo(() => {
    // Wider than deep, as the card is: 66 books make 11 by 6 exactly.
    const cols = Math.ceil(Math.sqrt(books.length * 1.8));
    const split = newTestament(books);
    const cells: Cell[] = books.map((b, i) => ({
      col: i % cols,
      row: Math.floor(i / cols),
      parts: slabs(colors, b.colors),
      marked: b.chaptersSynced > 0,
      band: i < split ? 0 : 1,
      group: i,
    }));
    return { cells, cols, rows: Math.ceil(cells.length / cols) };
  }, [books, colors]);
  if (books.length === 0) return null;

  return (
    <Scene3D
      cols={scene.cols}
      rows={scene.rows}
      cells={scene.cells}
      describe={(i) => label(books[i])}
      label={t.stats.bookSkyline}
      aspect={0.64}
      ends={[book(books[0].book), book(books[books.length - 1].book)]}
    />
  );
}

interface SkylineProps {
  stats: Stats;
  /** The person's colours, in their order. */
  colors: readonly HighlightColorId[];
}

/**
 * The whole Bible as a block of towers, a chapter each, in reading order from
 * the far left to the near right: the chapters fill a rectangle row by row,
 * which keeps Psalms' 150 from making it a ribbon.
 */
export function Skyline({ stats, colors }: SkylineProps) {
  const { t, f, plural, ref, book } = useI18n();
  const scene = useMemo(() => {
    const highlighted = new Map(stats.highlighted.map((c) => [c.chapter, c]));
    // Wider than deep, as the card is: 1,189 chapters make 41 by 29 exactly.
    const cols = Math.ceil(Math.sqrt(stats.chapters * 1.4));
    const cells: Cell[] = [];
    /** What the pointer says about each cell. */
    const chapters: { key: string; verses: number; synced: boolean }[] = [];
    stats.books.forEach((b, group) => {
      for (let ch = 1; ch <= b.chapters; ch++) {
        const key = `${b.book}.${ch}`;
        const c = highlighted.get(key);
        const synced = stats.synced.has(key);
        const i = cells.length;
        cells.push({ col: i % cols, row: Math.floor(i / cols), parts: c ? slabs(colors, c.colors) : [], marked: synced, band: group, group });
        chapters.push({ key, verses: c?.verses ?? 0, synced });
      }
    });
    return { cells, chapters, cols, rows: Math.ceil(cells.length / cols) };
  }, [stats, colors]);
  if (scene.cells.length === 0) return null;

  const describe = (i: number) => {
    const c = scene.chapters[i];
    return c.verses > 0 || c.synced
      ? plural(t.stats.chapterRow, c.verses, { chapter: ref(c.key) })
      : f(t.stats.chapterNotSynced, { chapter: ref(c.key) });
  };
  return (
    <Scene3D
      cols={scene.cols}
      rows={scene.rows}
      cells={scene.cells}
      describe={describe}
      label={t.stats.skyline}
      aspect={0.78}
      ends={[book(stats.books[0].book), book(stats.books[stats.books.length - 1].book)]}
    />
  );
}

interface BookColorsProps {
  /** The books with highlights, in Bible order. */
  books: readonly BookStats[];
  /** The colours in use, the person's first. */
  colors: readonly HighlightColorId[];
}

/** A bar per book and colour: which colours the person reaches for where. */
export function BookColors({ books, colors }: BookColorsProps) {
  const { t, f, num, book } = useI18n();
  const cells = useMemo(
    () => books.flatMap((b, row) => colors.map((id, col): Cell => {
      const value = b.colors[id] ?? 0;
      return { col, row, parts: value ? [{ value, color: HIGHLIGHT_HEX[id] }] : [], marked: false, band: row, group: row };
    })),
    [books, colors],
  );

  const describe = (i: number) => {
    const b = books[Math.floor(i / colors.length)];
    const id = colors[i % colors.length];
    return `${book(b.book)} · ${f(t.stats.colorCount, { color: t.priority.names[id], n: num(b.colors[id] ?? 0) })}`;
  };
  return (
    <Scene3D
      cols={colors.length}
      rows={books.length}
      cells={cells}
      describe={describe}
      label={t.stats.colorsByBook}
      aspect={0.64}
      rowLabels={books.map((b) => book(b.book))}
      inset={0.2}
      yaw={-0.62}
    />
  );
}

/** Degrees left open at the top, where the wheel starts and closes, and between the testaments. */
const WHEEL_GAP = 7;
const RING = [46, 51];
const BAR = [56, 140];
const NAMES = 150;

/** A point on the wheel: `angle` in degrees clockwise from the top. */
const polar = (angle: number, r: number) => {
  const a = (angle * Math.PI) / 180;
  return `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
};

const arc = (from: number, to: number, r: number) => `M${polar(from, r)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${polar(to, r)}`;

/** A slice of a ring. */
const sector = (from: number, to: number, inner: number, outer: number) =>
  `${arc(from, to, outer)}L${polar(to, inner)}A${inner} ${inner} 0 ${to - from > 180 ? 1 : 0} 0 ${polar(from, inner)}Z`;


/**
 * All 66 books round a wheel, anticlockwise from 12 o'clock: Genesis sets off
 * to the left of the top and Revelation comes back to it from the right, so
 * the testaments' names read across the top like an arch. A book's spoke is
 * its verses highlighted, in their colours; the ring inside shows how much of
 * it is synced.
 */
export function BookWheel({ stats, colors, label }: BooksProps) {
  const { t, num, plural, book } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const books = stats.books;
  const split = newTestament(books);
  const slot = (360 - 2 * WHEEL_GAP) / books.length;
  // Angles grow clockwise, so a book's slot begins at its far edge: `slot` beyond where the book before it ended.
  const start = (i: number) => -(WHEEL_GAP / 2 + (i + 1) * slot + (i < split ? 0 : WHEEL_GAP));
  const most = Math.max(...books.map((b) => b.verses), 1);
  const shown = active === null ? null : books[active];
  // The names run up to the top on the left and away from it on the right, over their own books.
  const names = [
    { id: "wheel-old", text: t.stats.oldTestament, from: -100, to: -WHEEL_GAP, offset: "100%", anchor: "end" } as const,
    { id: "wheel-new", text: t.stats.newTestament, from: WHEEL_GAP, to: 100, offset: "0%", anchor: "start" } as const,
  ];

  return (
    <div className="relative mx-auto w-full max-w-80">
      <svg viewBox="-164 -164 328 328" role="img" aria-label={t.stats.byBook} className="block w-full"
        // A finger leaves the moment it lifts: the book it tapped stays named until another is.
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {names.map((n) => (
          <g key={n.id} aria-hidden>
            <path id={n.id} d={arc(n.from, n.to, NAMES)} fill="none" />
            <text className="fill-stone-500 text-[10px] font-medium tracking-wide uppercase dark:fill-stone-400">
              <textPath href={`#${n.id}`} startOffset={n.offset} textAnchor={n.anchor}>{n.text}</textPath>
            </text>
          </g>
        ))}
        {books.map((b, i) => {
          const from = start(i) + 0.45;
          const to = start(i) + slot - 0.45;
          const length = b.verses > 0 ? Math.max((b.verses / most) * (BAR[1] - BAR[0]), 4) : 0;
          let r = BAR[0];
          return (
            <g key={b.book} onPointerEnter={() => setActive(i)}>
              <path
                d={sector(from, to, BAR[0], BAR[1])}
                className={active === i ? "fill-stone-300 dark:fill-stone-600" : "fill-stone-100 dark:fill-stone-800"}
              />
              <path
                d={sector(from, to, RING[0], RING[1])}
                className={b.chaptersSynced > 0 ? "fill-amber-600 dark:fill-amber-500" : "fill-stone-200 dark:fill-stone-700"}
                fillOpacity={b.chaptersSynced > 0 ? 0.3 + 0.7 * (b.chaptersSynced / (b.chapters || 1)) : 1}
              />
              {colors.filter((id) => b.colors[id]).map((id) => {
                const inner = r;
                r += ((b.colors[id] ?? 0) / b.verses) * length;
                return <path key={id} d={sector(from, to, inner, r)} fill={`#${HIGHLIGHT_HEX[id]}`} stroke="#000" strokeOpacity={0.18} strokeWidth={0.5} />;
              })}
              {/* The whole slot answers the pointer, not just the drawn part. */}
              <path d={sector(start(i), start(i) + slot, RING[0], BAR[1] + 4)} fill="transparent">
                <title>{label(b)}</title>
              </path>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <p className="w-[26%] text-center text-xs leading-tight text-balance text-stone-600 dark:text-stone-400">
          <span className="block text-xl font-semibold text-stone-900 tabular-nums dark:text-stone-100">
            {num(shown ? shown.verses : stats.verses)}
          </span>
          {shown ? book(shown.book) : plural(t.stats.verses, stats.verses)}
        </p>
      </div>
    </div>
  );
}

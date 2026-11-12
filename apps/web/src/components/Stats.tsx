import { HIGHLIGHT_HEX, type HighlightColorId, type SyncState } from "@bvs/core";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { store, type VersionSetting } from "../lib/db";
import { storedPace } from "../lib/pace";
import { syncStats, type BookStats, type Stats, type VersionStats } from "../lib/stats";
import { BookColors, BookSkyline, BookWheel, Skyline } from "./StatsGraphics";

interface Props {
  /** The person's versions, in their order. */
  versions: VersionSetting[];
  /** The person's colour priority, which the colours are listed in. */
  colorOrder: readonly HighlightColorId[];
  /** Show made-up data instead (development only). */
  demo?: boolean;
}

const muted = "text-stone-600 dark:text-stone-400";

export function StatsPage({ versions: chosen, colorOrder, demo }: Props) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<{ state: SyncState; versions: VersionSetting[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Checked here too, so the demo module is left out of production builds.
      const next = import.meta.env.DEV && demo
        ? await (await import("../lib/demo")).demoData()
        : { state: await store.getState(), versions: chosen };
      if (!cancelled) setLoaded(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, chosen]);
  const versions = loaded?.versions ?? chosen;
  const stats = useMemo(() => loaded && syncStats(loaded.state, loaded.versions.map((v) => v.bibleId)), [loaded]);
  return (
    <section className="card space-y-6" aria-labelledby="stats-title">
      <div className="space-y-2">
        <a href="#" className="btn-ghost -ml-2 min-h-8">
          <ArrowLeft size={16} aria-hidden />
          {t.app.back}
        </a>
        <h2 id="stats-title" className="text-lg font-semibold">{t.stats.title}</h2>
        <p className={`text-sm ${muted}`}>{t.stats.note}</p>
        {demo && (
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
            {t.stats.demo}
          </p>
        )}
      </div>
      {stats && (stats.verses === 0 && stats.chaptersSynced === 0 ? (
        <p className={`text-sm ${muted}`}>{t.stats.empty}</p>
      ) : (
        <Body stats={stats} versions={versions} colorOrder={colorOrder} />
      ))}
    </section>
  );
}

interface BodyProps {
  stats: Stats;
  versions: VersionSetting[];
  colorOrder: readonly HighlightColorId[];
}

// Memoised because a render repaints three canvases, and the app re-renders for reasons the stats don't share.
const Body = memo(function Body({ stats: s, versions, colorOrder }: BodyProps) {
  const { t, f, num, plural, book, ref } = useI18n();
  const percent = new Intl.NumberFormat(t.meta.localeTag, { style: "percent", maximumFractionDigits: 1 });
  const names = new Map(versions.map((v) => [v.bibleId, v.abbr]));
  const books = useMemo(() => s.books.filter((b) => b.verses > 0), [s]);
  const usedColors = useMemo(() => colorOrder.filter((id) => s.books.some((b) => b.colors[id])), [colorOrder, s]);
  const bookLabel = (b: BookStats) =>
    plural(t.stats.bookRow, b.verses, { book: book(b.book), synced: num(b.chaptersSynced), chapters: num(b.chapters) });
  const syncedShare = s.chaptersSynced / (s.chapters || 1);
  const most = Math.max(...books.map((b) => b.verses), 1);
  const pace = storedPace();
  const seconds = new Intl.NumberFormat(t.meta.localeTag, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const time = (ms: number) => f(t.stats.seconds, { n: seconds.format(ms / 1000) });

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Tile value={num(s.verses)} label={plural(t.stats.verses, s.verses)} />
        <Tile
          value={num(s.chaptersSynced)}
          label={t.stats.chapters}
          sub={f(t.stats.chaptersOf, { total: num(s.chapters), percent: percent.format(syncedShare) })}
          meter={syncedShare}
        />
        <Tile value={num(s.versions.length)} label={plural(t.stats.versions, s.versions.length)} />
      </div>

      <Section title={t.stats.bookSkyline} note={`${t.stats.bookSkylineNote} ${t.stats.turn}`}>
        <BookSkyline stats={s} colors={colorOrder} label={bookLabel} />
      </Section>

      <Section title={t.stats.perVersion}>
        {s.versions.some((v) => v.added > 0) && <AddedChart versions={s.versions} names={names} />}
        <ul className="space-y-4">
          {s.versions.map((v) => {
            const used = colorOrder.filter((id) => v.colors[id]);
            return (
              <li key={v.bibleId} className="space-y-1.5">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{names.get(v.bibleId) ?? v.bibleId}</span>
                  <span className={muted}>
                    {plural(t.stats.highlights, v.highlights)}
                    {v.added > 0 && ` · ${plural(t.stats.added, v.added)}`}
                  </span>
                </p>
                <ColorBar colors={v.colors} used={used} />
                <ColorLegend colors={v.colors} used={used} />
                {v.unwritable > 0 && <p className={`text-xs ${muted}`}>{plural(t.stats.unwritable, v.unwritable)}</p>}
              </li>
            );
          })}
        </ul>
      </Section>

      {s.versions.length > 1 && (
        <Section title={t.stats.overlap}>
          <div className="flex h-3 gap-0.5" aria-hidden>
            {OVERLAP.map(({ key, fill }) => s[key] > 0 && (
              <span key={key} className={`h-full rounded ring-1 ring-black/10 ring-inset ${fill}`} style={{ flexGrow: s[key], flexBasis: 0, minWidth: 4 }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {OVERLAP.map(({ key, fill }) => <Tile key={key} value={num(s[key])} label={t.stats[key]} swatch={fill} />)}
          </div>
          {s.differing > 0 && <p className={`text-sm ${muted}`}>{plural(t.stats.differing, s.differing)}</p>}
        </Section>
      )}

      {books.length > 0 && (
        <Section title={t.stats.byBook}>
          <BookWheel stats={s} colors={colorOrder} label={bookLabel} />
          <ul className="space-y-1">
            {books.map((b) => {
              const label = bookLabel(b);
              return (
                <li key={b.book} title={label} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 rounded-md text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                  <span className="truncate">{book(b.book)}</span>
                  <span className="h-3">
                    <span className="flex h-full gap-px" style={{ width: `${Math.max((b.verses / most) * 100, 2)}%` }}>
                      {usedColors.filter((id) => b.colors[id]).map((id) => (
                        <span
                          key={id}
                          className="h-full ring-1 ring-black/10 ring-inset first:rounded-l last:rounded-r"
                          style={{ flexGrow: b.colors[id], flexBasis: 0, background: `#${HIGHLIGHT_HEX[id]}` }}
                        />
                      ))}
                    </span>
                  </span>
                  <span className={`tabular-nums ${muted}`}>{num(b.verses)}</span>
                  <span className="sr-only">{label}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {books.length > 1 && usedColors.length > 1 && (
        <Section title={t.stats.colorsByBook} note={`${t.stats.colorsByBookNote} ${t.stats.turn}`}>
          <BookColors books={books} colors={usedColors} />
        </Section>
      )}

      <Section title={t.stats.skyline} note={`${t.stats.skylineNote} ${t.stats.turn}`}>
        <Skyline stats={s} colors={colorOrder} />
      </Section>

      {s.topShare.length > 0 && (
        <Section title={t.stats.topShare}>
          <ol className="space-y-1 text-sm">
            {s.topShare.map((c, i) => (
              <li key={c.chapter} className="flex items-baseline gap-3">
                <span className={`w-4 tabular-nums ${muted}`}>{num(i + 1)}</span>
                <span className="flex-1">{ref(c.chapter)}</span>
                <span className={`tabular-nums ${muted}`}>{f(t.stats.versesOf, { n: num(c.verses), total: num(c.of) })}</span>
                <span className="w-14 text-right tabular-nums">{percent.format(c.verses / c.of)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {s.topChapters.length > 0 && (
        <Section title={t.stats.topChapters}>
          <ol className="space-y-1 text-sm">
            {s.topChapters.map((c, i) => (
              <li key={c.chapter} className="flex items-baseline gap-3">
                <span className={`w-4 tabular-nums ${muted}`}>{num(i + 1)}</span>
                <span className="flex-1">{ref(c.chapter)}</span>
                <span className={`tabular-nums ${muted}`}>{num(c.verses)}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section title={t.stats.pace}>
        {pace.msPerRead || pace.msPerWrite ? (
          <ul className={`space-y-1 text-sm ${muted}`}>
            {pace.msPerRead && <li>{f(t.stats.perRead, { time: time(pace.msPerRead) })}</li>}
            {pace.msPerWrite && <li>{f(t.stats.perWrite, { time: time(pace.msPerWrite) })}</li>}
          </ul>
        ) : (
          <p className={`text-sm ${muted}`}>{t.stats.noPace}</p>
        )}
      </Section>
    </>
  );
});

/** The three ways a verse is spread over the versions, widest first, from the strongest tint to the faintest. */
const OVERLAP = [
  { key: "everywhere", fill: "bg-amber-700 dark:bg-amber-400" },
  { key: "some", fill: "bg-amber-500 dark:bg-amber-600" },
  { key: "one", fill: "bg-amber-300 dark:bg-amber-800" },
] as const;

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="label">{title}</h3>
      {note && <p className={`text-xs ${muted}`}>{note}</p>}
      {children}
    </div>
  );
}

interface TileProps {
  value: string;
  label: string;
  sub?: string;
  /** A share from 0 to 1, drawn as a bar under the figures. */
  meter?: number;
  /** The colour (a background class) that stands for this figure in a chart nearby. */
  swatch?: string;
}

function Tile({ value, label, sub, meter, swatch }: TileProps) {
  return (
    <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className={`text-xs ${muted}`}>
        {swatch && <span className={`mr-1.5 inline-block size-2.5 rounded-sm ring-1 ring-black/10 ring-inset ${swatch}`} aria-hidden />}
        {label}
      </p>
      {sub && <p className={`text-xs ${muted}`}>{sub}</p>}
      {meter !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-300 dark:bg-stone-700" aria-hidden>
          <div className="h-full rounded-full bg-amber-700 dark:bg-amber-500" style={{ width: `${Math.min(meter, 1) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

/** A version's highlights, in two: the person's own, and what syncing added. */
const ADDED = { own: "bg-stone-500", added: "bg-amber-600 dark:bg-amber-400" };

/**
 * Every version's highlights on one scale, with what syncing added marked
 * off: how far it has brought the versions level. Decoration for screen
 * readers, which get the same figures from the rows under it.
 */
function AddedChart({ versions, names }: { versions: VersionStats[]; names: Map<number, string> }) {
  const { t, plural } = useI18n();
  const signed = new Intl.NumberFormat(t.meta.localeTag, { signDisplay: "exceptZero" });
  const most = Math.max(...versions.map((v) => v.highlights), 1);
  const swatch = "inline-block size-3 rounded-sm ring-1 ring-black/10 ring-inset";
  return (
    <div className="space-y-2" aria-hidden>
      <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${muted}`}>
        <li className="inline-flex items-center gap-1.5"><span className={`${swatch} ${ADDED.own}`} />{t.stats.ownHighlights}</li>
        <li className="inline-flex items-center gap-1.5"><span className={`${swatch} ${ADDED.added}`} />{t.stats.addedBySync}</li>
      </ul>
      <div className="space-y-1.5 text-sm">
        {versions.map((v) => {
          const name = names.get(v.bibleId) ?? v.bibleId;
          return (
            <div
              key={v.bibleId}
              title={`${name}: ${plural(t.stats.highlights, v.highlights)} · ${plural(t.stats.added, v.added)}`}
              className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3"
            >
              <span className="truncate">{name}</span>
              <span className="h-3">
                <span className="flex h-full gap-0.5" style={{ width: `${Math.max((v.highlights / most) * 100, 2)}%` }}>
                  {v.highlights > v.added && <span className={`h-full rounded ${ADDED.own}`} style={{ flexGrow: v.highlights - v.added, flexBasis: 0, minWidth: 3 }} />}
                  {v.added > 0 && <span className={`h-full rounded ${ADDED.added}`} style={{ flexGrow: v.added, flexBasis: 0, minWidth: 3 }} />}
                </span>
              </span>
              <span className={`text-right tabular-nums ${muted}`}>{signed.format(v.added)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Colors = Stats["versions"][number]["colors"];

/** `used`: the colours with highlights, in the person's colour order. */
function ColorBar({ colors, used }: { colors: Colors; used: HighlightColorId[] }) {
  const { t, num, f } = useI18n();
  return (
    <div className="flex h-3 gap-0.5" aria-hidden>
      {used.map((id) => (
        <span
          key={id}
          title={f(t.stats.colorCount, { color: t.priority.names[id], n: num(colors[id]) })}
          className="h-full rounded ring-1 ring-black/10 ring-inset"
          style={{ flexGrow: colors[id], flexBasis: 0, minWidth: 4, background: `#${HIGHLIGHT_HEX[id]}` }}
        />
      ))}
    </div>
  );
}

function ColorLegend({ colors, used }: { colors: Colors; used: HighlightColorId[] }) {
  const { t, num } = useI18n();
  return (
    <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${muted}`}>
      {used.map((id) => (
        <li key={id} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm ring-1 ring-black/10" style={{ background: `#${HIGHLIGHT_HEX[id]}` }} />
          {t.priority.names[id]} <span className="tabular-nums">{num(colors[id])}</span>
        </li>
      ))}
    </ul>
  );
}

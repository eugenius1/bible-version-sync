import { HIGHLIGHT_HEX, type HighlightColorId, type SyncState } from "@bvs/core";
import { ArrowLeft, CircleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { store, type VersionSetting } from "../lib/db";
import { storedPace } from "../lib/pace";
import { syncStats, type Stats } from "../lib/stats";

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

function Body({ stats: s, versions, colorOrder }: { stats: Stats; versions: VersionSetting[]; colorOrder: readonly HighlightColorId[] }) {
  const { t, f, num, plural, book, ref } = useI18n();
  const percent = new Intl.NumberFormat(t.meta.localeTag, { style: "percent", maximumFractionDigits: 1 });
  const names = new Map(versions.map((v) => [v.bibleId, v.abbr]));
  const books = s.books.filter((b) => b.verses > 0);
  const most = Math.max(...books.map((b) => b.verses), 1);
  const pace = storedPace();

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Tile value={num(s.verses)} label={plural(t.stats.verses, s.verses)} />
        <Tile
          value={num(s.chaptersSynced)}
          label={t.stats.chapters}
          sub={f(t.stats.chaptersOf, { total: num(s.chapters), percent: percent.format(s.chaptersSynced / (s.chapters || 1)) })}
        />
        <Tile value={num(s.versions.length)} label={plural(t.stats.versions, s.versions.length)} />
      </div>

      <Section title={t.stats.perVersion}>
        <ul className="space-y-4">
          {s.versions.map((v) => {
            const used = colorOrder.filter((id) => v.colors[id]);
            return (
              <li key={v.bibleId} className="space-y-1.5">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{names.get(v.bibleId) ?? v.bibleId}</span>
                  <span className={muted}>{plural(t.stats.highlights, v.highlights)}</span>
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
          <div className="grid grid-cols-3 gap-2">
            <Tile value={num(s.everywhere)} label={t.stats.everywhere} />
            <Tile value={num(s.some)} label={t.stats.some} />
            <Tile value={num(s.one)} label={t.stats.one} />
          </div>
          {s.differing > 0 && <p className={`text-sm ${muted}`}>{plural(t.stats.differing, s.differing)}</p>}
        </Section>
      )}

      {books.length > 0 && (
        <Section title={t.stats.byBook}>
          <ul className="space-y-1">
            {books.map((b) => {
              const label = plural(t.stats.bookRow, b.verses, {
                book: book(b.book), synced: num(b.chaptersSynced), chapters: num(b.chapters),
              });
              return (
                <li key={b.book} title={label} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 rounded-md text-sm hover:bg-stone-100 dark:hover:bg-stone-800">
                  <span className="truncate">{book(b.book)}</span>
                  <span className="h-3">
                    <span
                      className="block h-full rounded-r bg-amber-600 dark:bg-amber-500"
                      style={{ width: `${Math.max((b.verses / most) * 100, 2)}%` }}
                    />
                  </span>
                  <span className={`tabular-nums ${muted}`}>{num(b.verses)}</span>
                  <span className="sr-only">{label}</span>
                </li>
              );
            })}
          </ul>
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
            {pace.msPerRead && <li>{f(t.stats.perRead, { ms: num(Math.round(pace.msPerRead)) })}</li>}
            {pace.msPerWrite && <li>{f(t.stats.perWrite, { ms: num(Math.round(pace.msPerWrite)) })}</li>}
          </ul>
        ) : (
          <p className={`text-sm ${muted}`}>{t.stats.noPace}</p>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="label">{title}</h3>
      {children}
    </div>
  );
}

function Tile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className={`text-xs ${muted}`}>{label}</p>
      {sub && <p className={`text-xs ${muted}`}>{sub}</p>}
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

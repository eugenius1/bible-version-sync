import { assumedScheme, loadVersionNames, versionNamesLoaded } from "@bvs/core";
import { ArrowDown, ArrowUp, BadgeCheck, Ban, CircleAlert, Hash, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { FindVersions } from "./FindVersions";
import type { VersionSetting } from "../lib/db";
import { versionName, type ResolvedVersion } from "../lib/versions";
import { AddVersion } from "./AddVersion";

const SOURCE_STYLE: Record<ResolvedVersion["source"], { tone: string; Icon: typeof BadgeCheck }> = {
  verified: { tone: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200", Icon: BadgeCheck },
  // Scanned counts and the API index are equally trustworthy: real counts, no hand check.
  scanned: { tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", Icon: Hash },
  "api-index": { tone: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", Icon: Info },
  assumed: { tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", Icon: CircleAlert },
  unsupported: { tone: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200", Icon: Ban },
};

interface Props {
  settings: VersionSetting[];
  resolved: ResolvedVersion[] | null;
  disabled: boolean;
  /** Nothing chosen or synced yet, so the list is the app's example. */
  fresh?: boolean;
  /** The new list, as bible ids, and the one removed, if any. */
  onChange: (next: number[], removed?: number) => void | Promise<void>;
}

export function VersionsCard({ settings, resolved, disabled, fresh = false, onChange }: Props) {
  const { t, f, num } = useI18n();
  const tv = t.versions;
  // Names are a chunk of their own (100 KB gzipped); re-render once they're in.
  const [, setNamesLoaded] = useState(false);
  useEffect(() => {
    loadVersionNames().then(
      () => setNamesLoaded(true),
      () => undefined, // offline before the app was cached: "Version {id}" until next time
    );
  }, []);

  const ids = settings.map((s) => s.bibleId);
  const move = (i: number, d: -1 | 1) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    void onChange(next);
  };

  return (
    <section className="card space-y-4" aria-labelledby="versions-title">
      <div>
        <h2 id="versions-title" className="font-semibold">{tv.title}</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{tv.help}</p>
      </div>

      <ol className="divide-y divide-stone-200 dark:divide-stone-800">
        {settings.map((v, i) => {
          const r = resolved?.find((x) => x.bibleId === v.bibleId);
          const source = r ? tv.source[r.source] : null;
          const src = source && {
            ...source,
            hint: f(source.hint, { system: tv.systems[assumedScheme(v.bibleId)], n: num(r?.unfit ?? 0) }),
          };
          const style = r ? SOURCE_STYLE[r.source] : null;
          const name = versionName(v.bibleId);
          return (
            <li key={v.bibleId} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-right text-sm tabular-nums text-stone-500 dark:text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{v.abbr}</span>
                  {/* Titles are in the version's own script; lang picks the right
                      glyphs (Japanese, not Chinese) and dir lets Arabic run right to left. */}
                  <span
                    className="truncate text-sm text-stone-600 dark:text-stone-400"
                    lang={name?.language}
                    dir={name ? "auto" : undefined}
                  >
                    {name?.title ?? (versionNamesLoaded() ? f(tv.unnamed, { id: v.bibleId }) : null)}
                  </span>
                </div>
                {src && style ? (
                  <span
                    title={src.hint}
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${style.tone}`}
                  >
                    <style.Icon size={12} aria-hidden />
                    {src.text}
                  </span>
                ) : (
                  <span className="mt-1 inline-block text-xs text-stone-600 dark:text-stone-400">{tv.checking}</span>
                )}
                {r?.source === "assumed" && <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">{src!.hint}</p>}
                {r?.source === "unsupported" && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{src!.hint}</p>}
              </div>
              <div className="flex shrink-0 items-center">
                <button
                  className="btn-ghost"
                  disabled={disabled || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={f(tv.moveUp, { abbr: v.abbr })}
                  title={f(tv.moveUp, { abbr: v.abbr })}
                >
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button
                  className="btn-ghost"
                  disabled={disabled || i === settings.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={f(tv.moveDown, { abbr: v.abbr })}
                  title={f(tv.moveDown, { abbr: v.abbr })}
                >
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button
                  className="btn-ghost"
                  disabled={disabled || settings.length <= 2}
                  onClick={() => {
                    if (confirm(f(tv.confirmRemove, { abbr: v.abbr }))) {
                      void onChange(ids.filter((id) => id !== v.bibleId), v.bibleId);
                    }
                  }}
                  aria-label={f(tv.remove, { abbr: v.abbr })}
                  title={f(tv.remove, { abbr: v.abbr })}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <FindVersions settings={settings} disabled={disabled} fresh={fresh} onChange={onChange} />

      <AddVersion added={ids} disabled={disabled} onAdd={(id) => onChange([...ids, id])} />
    </section>
  );
}

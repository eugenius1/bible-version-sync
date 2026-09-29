import { byPopularity, discoverVersions, loadVersionNames, versionName, versionsInLanguages } from "@bvs/core";
import { Check, Plus, Search, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { client } from "../lib/auth";
import { settingFor, type VersionSetting } from "../lib/db";
import { problemText, resolveVersion } from "../lib/versions";

interface Found {
  bibleId: number;
  /** Highlighted verses in the first sampled chapter that had any. */
  verses: number;
}

/** Whether the sync could take a found version; "checking" until its numbering is resolved. */
type Numbering = "checking" | "ok" | "unsupported";

type Scan =
  | { status: "idle" }
  | { status: "running"; done: number; total: number; found: Found[] }
  | { status: "done"; found: Found[] }
  | { status: "error"; message: string };

interface Props {
  settings: VersionSetting[];
  disabled: boolean;
  /** Nothing chosen or synced yet: the list is the app's example, so look straight away. */
  fresh: boolean;
  onChange: (next: VersionSetting[]) => void | Promise<void>;
}

/** The languages a person reads in, as best the browser can tell. */
function readerLanguages(appLocale: string): string[] {
  const nav = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  return [...nav, appLocale].filter(Boolean);
}

/**
 * Suggest versions by sampling the person's highlights in every version in
 * their languages (see discoverVersions). Read-only: adding one is up to them.
 */
export function FindVersions({ settings, disabled, fresh, onChange }: Props) {
  const { t, f, num, plural } = useI18n();
  const tf = t.versions.find;
  const [scan, setScan] = useState<Scan>({ status: "idle" });
  const [numbering, setNumbering] = useState<ReadonlyMap<number, Numbering>>(new Map());
  const checked = useRef(new Set<number>());
  const abort = useRef<AbortController | null>(null);
  const localeTag = t.meta.localeTag;

  const start = useCallback(async () => {
    const controller = new AbortController();
    abort.current = controller;
    setScan({ status: "running", done: 0, total: 0, found: [] });
    // Each version's numbering is checked as soon as it's found, not after the
    // scan, so it can be added while the rest are still being asked about.
    const check = (bibleId: number) => {
      if (checked.current.has(bibleId)) return;
      checked.current.add(bibleId);
      const settle = (n: Numbering) => setNumbering((m) => new Map(m).set(bibleId, n));
      settle("checking");
      // Resolving is cheap: bundled counts, or an API index that's cached
      // afterwards. If it fails, offer the version anyway; adding it goes
      // through the sync's own refusal.
      resolveVersion({ bibleId, abbr: String(bibleId) }).then(
        (r) => settle(r.source === "unsupported" ? "unsupported" : "ok"),
        () => settle("ok"),
      );
    };
    try {
      await loadVersionNames();
      // Most used first, both to ask about them first and to list them in that
      // order, which is also the order "use these" keeps.
      const languages = readerLanguages(localeTag);
      const ids = byPopularity([...new Set([...settings.map((s) => s.bibleId), ...versionsInLanguages(languages)])], languages);
      const toFound = (m: Map<number, number>) => ids.filter((id) => m.has(id)).map((bibleId) => ({ bibleId, verses: m.get(bibleId)! }));
      const counts = await discoverVersions({
        api: client,
        bibleIds: ids,
        signal: controller.signal,
        onProgress: (p) => {
          for (const id of p.found.keys()) check(id);
          setScan({ status: "running", done: p.done, total: p.total, found: toFound(p.found) });
        },
      });
      setScan({ status: "done", found: toFound(counts) });
    } catch (e) {
      if (controller.signal.aborted) setScan({ status: "idle" });
      else setScan({ status: "error", message: problemText(e) });
    } finally {
      abort.current = null;
    }
  }, [settings, localeTag]);

  // Look straight away on a first visit. Once only: settings change as soon
  // as a suggestion is taken, and that mustn't start another scan.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!fresh || autoStarted.current) return;
    autoStarted.current = true;
    void start();
  }, [fresh, start]);
  useEffect(() => () => abort.current?.abort(), []);

  const add = (bibleId: number) => void onChange([...settings, settingFor(bibleId, settings)]);
  const replaceWith = (found: Found[]) => {
    const next: VersionSetting[] = [];
    for (const v of found) next.push(settingFor(v.bibleId, next));
    void onChange(next);
  };

  const running = scan.status === "running";
  const found = scan.status === "running" || scan.status === "done" ? scan.found : [];
  const usable = found.filter((v) => numbering.get(v.bibleId) === "ok");
  const checking = found.some((v) => numbering.get(v.bibleId) === "checking");
  const missing = scan.status === "done" ? settings.filter((s) => !found.some((v) => v.bibleId === s.bibleId)) : [];
  const pct = scan.status === "running" && scan.total ? Math.round((scan.done / scan.total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
      {fresh && <p className="text-sm">{tf.examples}</p>}

      {running ? (
        <div className="space-y-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <Search size={14} className="shrink-0" aria-hidden />
              {scan.total ? f(tf.progress, { done: num(scan.done), total: num(scan.total) }) : tf.starting}
            </span>
            <button className="btn-ghost shrink-0" onClick={() => abort.current?.abort()}>
              <Square size={14} aria-hidden />
              {tf.stop}
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
            <progress className="sr-only" max={100} value={pct} />
            <div className="h-full rounded-full bg-amber-700 transition-[width] dark:bg-amber-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" disabled={disabled} onClick={() => void start()}>
            <Search size={16} aria-hidden />
            {scan.status === "idle" ? tf.button : tf.again}
          </button>
          <span className="text-xs text-stone-600 dark:text-stone-400">{tf.help}</span>
        </div>
      )}

      {scan.status === "error" && <p className="text-sm text-red-700 dark:text-red-300">{f(tf.failed, { problem: scan.message })}</p>}
      {scan.status === "done" && !found.length && <p className="text-sm text-stone-600 dark:text-stone-400">{tf.none}</p>}

      {found.length > 0 && (
        <>
          <p className="text-sm font-medium">{tf.foundTitle}</p>
          <ul className="divide-y divide-stone-200 dark:divide-stone-800">
            {found.map((v) => {
              const name = versionName(v.bibleId);
              const inList = settings.some((s) => s.bibleId === v.bibleId);
              const unsupported = numbering.get(v.bibleId) === "unsupported";
              return (
                <li key={v.bibleId} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{name?.abbr ?? v.bibleId}</span>
                      <span className="truncate text-sm text-stone-600 dark:text-stone-400" lang={name?.language} dir="auto">
                        {name?.title}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400">
                      {unsupported ? tf.unsupported : plural(tf.verses, v.verses)}
                    </p>
                  </div>
                  {inList ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
                      <Check size={14} aria-hidden />
                      {tf.inList}
                    </span>
                  ) : (
                    !unsupported && (
                      <button
                        className="btn-ghost shrink-0"
                        disabled={disabled || numbering.get(v.bibleId) !== "ok"}
                        onClick={() => add(v.bibleId)}
                        aria-label={f(tf.add, { abbr: name?.abbr ?? String(v.bibleId) })}
                      >
                        <Plus size={16} aria-hidden />
                        {t.versions.add}
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {missing.length > 0 && (
        <p className="text-xs text-stone-600 dark:text-stone-400">
          {f(tf.notFound, { list: new Intl.ListFormat(localeTag).format(missing.map((s) => s.abbr)) })}
        </p>
      )}

      {/* Only before the first sync: replacing a synced list would drop its snapshots. */}
      {fresh && scan.status === "done" && usable.length >= 2 && (
        <button className="btn-primary" disabled={disabled || checking} onClick={() => replaceWith(usable)}>
          {plural(tf.useThese, usable.length)}
        </button>
      )}
    </div>
  );
}

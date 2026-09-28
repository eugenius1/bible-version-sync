import { useState } from "react";
import { useI18n } from "../i18n";
import type { VersionSetting } from "../lib/db";
import { canReadHighlights, parseVersionInput, titleOf, type ResolvedVersion } from "../lib/versions";

const SOURCE_TONE: Record<ResolvedVersion["source"], string> = {
  builtin: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  "api-index": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  assumed: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
};

interface Props {
  settings: VersionSetting[];
  resolved: ResolvedVersion[] | null;
  disabled: boolean;
  onChange: (next: VersionSetting[], removedAbbr?: string) => void | Promise<void>;
}

export function VersionsCard({ settings, resolved, disabled, onChange }: Props) {
  const { t } = useI18n();
  const tv = t.versions;
  const [input, setInput] = useState("");
  const [abbr, setAbbr] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const move = (i: number, d: -1 | 1) => {
    const next = [...settings];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    void onChange(next);
  };

  const add = async () => {
    setError(null);
    const parsed = parseVersionInput(input);
    if (!parsed) return setError(tv.errors.unparseable);
    const name = (abbr || parsed.abbr || "").trim().toUpperCase();
    if (!name) return setError(tv.errors.needName);
    if (settings.some((s) => s.bibleId === parsed.bibleId)) return setError(tv.errors.duplicateVersion);
    if (settings.some((s) => s.abbr === name)) return setError(tv.errors.duplicateName(name));
    setAdding(true);
    const problem = await canReadHighlights(parsed.bibleId);
    setAdding(false);
    if (problem) return setError(tv.errors.cantRead(parsed.bibleId, problem));
    setInput("");
    setAbbr("");
    await onChange([...settings, { bibleId: parsed.bibleId, abbr: name }]);
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
          const src = r ? tv.source[r.source] : null;
          return (
            <li key={v.bibleId} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-right text-sm tabular-nums text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{v.abbr}</span>
                  <span className="truncate text-sm text-stone-500">{titleOf(v.bibleId) ?? tv.fallbackTitle(v.bibleId)}</span>
                </div>
                {r && src ? (
                  <span title={src.hint} className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${SOURCE_TONE[r.source]}`}>
                    {src.text}
                  </span>
                ) : (
                  <span className="mt-1 inline-block text-xs text-stone-400">{tv.checking}</span>
                )}
                {r?.source === "assumed" && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{src!.hint}</p>}
              </div>
              <div className="flex shrink-0 items-center">
                <button className="btn-ghost" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={tv.moveUp(v.abbr)}>
                  ↑
                </button>
                <button
                  className="btn-ghost"
                  disabled={disabled || i === settings.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={tv.moveDown(v.abbr)}
                >
                  ↓
                </button>
                <button
                  className="btn-ghost"
                  disabled={disabled || settings.length <= 2}
                  onClick={() => {
                    if (confirm(tv.confirmRemove(v.abbr))) {
                      void onChange(settings.filter((s) => s.bibleId !== v.bibleId), v.abbr);
                    }
                  }}
                  aria-label={tv.remove(v.abbr)}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <label className="label" htmlFor="add-version">{tv.addLabel}</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="add-version"
            className="input flex-1"
            placeholder={tv.addPlaceholder}
            value={input}
            disabled={disabled || adding}
            onChange={(e) => setInput(e.target.value)}
          />
          <input
            className="input sm:w-24"
            placeholder={tv.namePlaceholder}
            aria-label={tv.nameLabel}
            value={abbr}
            disabled={disabled || adding}
            onChange={(e) => setAbbr(e.target.value)}
          />
          <button className="btn-secondary" disabled={disabled || adding || !input.trim()}>
            {adding ? tv.adding : tv.add}
          </button>
        </div>
        <p className="text-xs text-stone-500">
          {tv.addHelp} <span className="font-mono">bible.com/bible/<b>1</b>/JHN.3.<b>KJV</b></span>
        </p>
        {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      </form>
    </section>
  );
}

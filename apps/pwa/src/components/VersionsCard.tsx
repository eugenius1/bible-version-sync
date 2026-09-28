import { useState } from "react";
import type { VersionSetting } from "../lib/db";
import { canReadHighlights, parseVersionInput, titleOf, type ResolvedVersion } from "../lib/versions";

const SOURCE_LABEL: Record<ResolvedVersion["source"], { text: string; tone: string; hint: string }> = {
  builtin: {
    text: "Verified numbering",
    tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    hint: "Verse numbering checked chapter by chapter for this version.",
  },
  "api-index": {
    text: "Numbering from YouVersion",
    tone: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    hint: "Verse counts come from the YouVersion API. Chapters that follow neither standard system are skipped.",
  },
  assumed: {
    text: "Numbering assumed",
    tone: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
    hint: "Couldn't read this version's verse counts, so English numbering is assumed. Highlights in Psalms and some Old Testament chapters may land on the wrong verse.",
  },
};

interface Props {
  settings: VersionSetting[];
  resolved: ResolvedVersion[] | null;
  disabled: boolean;
  onChange: (next: VersionSetting[], removedAbbr?: string) => void | Promise<void>;
}

export function VersionsCard({ settings, resolved, disabled, onChange }: Props) {
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
    if (!parsed) return setError("Paste a bible.com link like bible.com/bible/111/JHN.3.NIV, or type the number (111).");
    const name = (abbr || parsed.abbr || "").trim().toUpperCase();
    if (!name) return setError("Add a short name for this version, e.g. KJV.");
    if (settings.some((s) => s.bibleId === parsed.bibleId)) return setError("That version is already in the list.");
    if (settings.some((s) => s.abbr === name)) return setError(`The name ${name} is already used.`);
    setAdding(true);
    const problem = await canReadHighlights(parsed.bibleId);
    setAdding(false);
    if (problem) return setError(`Couldn't read highlights for version ${parsed.bibleId}: ${problem}`);
    setInput("");
    setAbbr("");
    await onChange([...settings, { bibleId: parsed.bibleId, abbr: name }]);
  };

  return (
    <section className="card space-y-4" aria-labelledby="versions-title">
      <div>
        <h2 id="versions-title" className="font-semibold">Your versions</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          When a verse has different colors, each version keeps its own. Versions without a highlight get the color from
          the one listed first.
        </p>
      </div>

      <ol className="divide-y divide-stone-200 dark:divide-stone-800">
        {settings.map((v, i) => {
          const r = resolved?.find((x) => x.bibleId === v.bibleId);
          const src = r ? SOURCE_LABEL[r.source] : null;
          return (
            <li key={v.bibleId} className="flex items-center gap-3 py-2.5">
              <span className="w-5 text-right text-sm tabular-nums text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium">{v.abbr}</span>
                  <span className="truncate text-sm text-stone-500">{titleOf(v.bibleId) ?? `Version ${v.bibleId}`}</span>
                </div>
                {src ? (
                  <span title={src.hint} className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${src.tone}`}>
                    {src.text}
                  </span>
                ) : (
                  <span className="mt-1 inline-block text-xs text-stone-400">Checking numbering…</span>
                )}
                {r?.source === "assumed" && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{src!.hint}</p>}
              </div>
              <div className="flex shrink-0 items-center">
                <button className="btn-ghost" disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${v.abbr} up`}>
                  ↑
                </button>
                <button
                  className="btn-ghost"
                  disabled={disabled || i === settings.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move ${v.abbr} down`}
                >
                  ↓
                </button>
                <button
                  className="btn-ghost"
                  disabled={disabled || settings.length <= 2}
                  onClick={() => {
                    if (confirm(`Remove ${v.abbr} from syncing? Its highlights stay in YouVersion.`)) {
                      void onChange(settings.filter((s) => s.bibleId !== v.bibleId), v.abbr);
                    }
                  }}
                  aria-label={`Remove ${v.abbr}`}
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
        <label className="label" htmlFor="add-version">Add a version</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="add-version"
            className="input flex-1"
            placeholder="bible.com link or version number"
            value={input}
            disabled={disabled || adding}
            onChange={(e) => setInput(e.target.value)}
          />
          <input
            className="input sm:w-24"
            placeholder="Name"
            aria-label="Short name"
            value={abbr}
            disabled={disabled || adding}
            onChange={(e) => setAbbr(e.target.value)}
          />
          <button className="btn-secondary" disabled={disabled || adding || !input.trim()}>
            {adding ? "Checking…" : "Add"}
          </button>
        </div>
        <p className="text-xs text-stone-500">
          Open the version on bible.com and copy the address, e.g. bible.com/bible/<b>1</b>/JHN.3.<b>KJV</b>.
        </p>
        {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      </form>
    </section>
  );
}

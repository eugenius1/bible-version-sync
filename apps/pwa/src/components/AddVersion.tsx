import { parseVersionInput, searchVersions, versionName } from "@bvs/core";
import { Check, Plus, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { canReadHighlights, problemText, readerLanguages, resolveVersion } from "../lib/versions";

/** Results listed at once; typing more narrows the rest down. */
const MAX_RESULTS = 50;

interface Props {
  /** Bible ids already in the list. */
  added: readonly number[];
  disabled: boolean;
  onAdd: (bibleId: number) => void | Promise<void>;
}

/** The language's name in the app's language ("anglais"), or its tag if the browser doesn't know it. */
function languageName(tag: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * Search every YouVersion version by number, abbreviation or title, the
 * reader's languages first, and add one from the results. A pasted bible.com
 * link finds its version by number. A number bible.com doesn't name is still
 * offered, as "Version {id}", since the names can lag behind YouVersion.
 */
export function AddVersion({ added, disabled, onAdd }: Props) {
  const { t, f, num } = useI18n();
  const tv = t.versions;
  const localeTag = t.meta.localeTag;
  const listId = useId();
  const [query, setQuery] = useState("");
  /** The result Enter adds; -1 until the arrows move it, meaning the first that can be added. */
  const [active, setActive] = useState(-1);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    // A link, or a number with an abbreviation after it, names one version.
    const parsed = q.includes("/") || /^\d+\s/.test(q) ? parseVersionInput(q) : null;
    const ids = parsed ? [parsed.bibleId] : searchVersions(q, readerLanguages(localeTag));
    const exact = parsed?.bibleId ?? (/^\d+$/.test(q) ? Number(q) : undefined);
    return exact !== undefined && !ids.includes(exact) ? [exact, ...ids] : ids;
  }, [query, localeTag]);
  const shown = results.slice(0, MAX_RESULTS);
  const selectable = (id: number) => !added.includes(id) && adding === null && !disabled;
  const current = active >= 0 ? Math.min(active, shown.length - 1) : Math.max(0, shown.findIndex((id) => !added.includes(id)));

  const add = async (bibleId: number) => {
    if (!selectable(bibleId)) return;
    setError(null);
    setAdding(bibleId);
    let problem = await canReadHighlights(bibleId);
    // A version whose numbering can't be mapped would only ever be left out.
    let resolved = null;
    if (!problem) {
      try {
        resolved = await resolveVersion({ bibleId, abbr: versionName(bibleId)?.abbr ?? String(bibleId) });
      } catch (e) {
        problem = problemText(e); // e.g. rate limited: nothing cached, so adding it again retries
      }
    }
    setAdding(null);
    if (problem) return setError(f(tv.errors.cantRead, { id: bibleId, problem }));
    if (resolved?.source === "unsupported") {
      return setError(f(tv.errors.unsupported, { id: bibleId, n: num(resolved.unfit ?? 0) }));
    }
    setQuery("");
    await onAdd(bibleId);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void add(shown[current]);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  const optionId = (i: number) => `${listId}-${i}`;
  const open = query.trim() !== "";

  return (
    <div className="space-y-2">
      <label className="label" htmlFor={`${listId}-input`}>{tv.addLabel}</label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone-500 dark:text-stone-400"
          aria-hidden
        />
        <input
          id={`${listId}-input`}
          className="input w-full pl-9"
          type="search"
          role="combobox"
          aria-expanded={open && shown.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown.length ? optionId(current) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={tv.addPlaceholder}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(-1);
            setError(null);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && shown.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label={tv.addLabel}
          className="max-h-80 divide-y divide-stone-200 overflow-y-auto rounded-lg border border-stone-200 dark:divide-stone-800 dark:border-stone-800"
        >
          {shown.map((id, i) => {
            const name = versionName(id);
            const inList = added.includes(id);
            const isActive = i === current;
            return (
              <li
                key={id}
                id={optionId(i)}
                role="option"
                aria-selected={isActive}
                aria-disabled={!selectable(id)}
                className={`flex items-center gap-3 px-3 py-2 ${
                  inList ? "" : "cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800/60"
                } ${isActive && !inList ? "bg-stone-100 dark:bg-stone-800/60" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the field
                onClick={() => void add(id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{name?.abbr ?? f(tv.unnamed, { id })}</span>
                    {name && (
                      <span className="truncate text-sm text-stone-600 dark:text-stone-400" lang={name.language} dir="auto">
                        {name.title}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    {name && `${languageName(name.language, localeTag)} · `}
                    {f(tv.number, { id })}
                  </p>
                </div>
                {inList ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
                    <Check size={14} aria-hidden />
                    {tv.alreadyAdded}
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-stone-700 dark:text-stone-300">
                    <Plus size={14} aria-hidden />
                    {adding === id ? tv.adding : tv.add}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open && results.length > MAX_RESULTS && (
        <p className="text-xs text-stone-600 dark:text-stone-400">
          {f(tv.moreResults, { shown: num(MAX_RESULTS), total: num(results.length) })}
        </p>
      )}
      {open && results.length === 0 && (
        <p className="text-sm text-stone-600 dark:text-stone-400">{f(tv.noResults, { query: query.trim() })}</p>
      )}
      {!open && (
        <p className="text-xs text-stone-600 dark:text-stone-400">
          {tv.addHelp} <span className="font-mono">bible.com/bible/<b>1</b>/JHN.3.<b>KJV</b></span>
        </p>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

import { BOOKS, type Scope } from "@bvs/core";
import { Eye, RefreshCw, Square } from "lucide-react";
import { useState } from "react";
import type { RunState } from "../App";
import { useI18n } from "../i18n";
import type { ResolvedVersion } from "../lib/versions";
import { Select } from "./Select";

type Kind = "bible" | "book" | "chapter";

interface Props {
  versions: ResolvedVersion[] | null;
  run: RunState;
  onRun: (scope: Scope, apply: boolean) => void;
  onCancel: () => void;
}

export function SyncCard({ versions, run, onRun, onCancel }: Props) {
  const { t, f, plural, num, book: bookName } = useI18n();
  const ts = t.sync;
  const [kind, setKind] = useState<Kind>("chapter");
  const [book, setBook] = useState("JHN");
  const [chapter, setChapter] = useState(3);

  const chapters = versions?.[0]?.map.chapters(book) ?? [];
  const validChapter = chapters.includes(chapter);
  const scope: Scope =
    kind === "bible" ? { kind: "books", books: BOOKS }
    : kind === "book" ? { kind: "books", books: [book] }
    : { kind: "chapter", book, chapter };
  const running = run.status === "running";
  const ready = !!versions && !running && (kind !== "chapter" || validChapter);

  return (
    <section className="card space-y-4" aria-labelledby="sync-title">
      <h2 id="sync-title" className="font-semibold">{ts.title}</h2>

      <fieldset className="space-y-3" disabled={running}>
        <legend className="sr-only">{ts.scopeLegend}</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          {(["chapter", "book", "bible"] as const).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-lg px-1 py-2 text-center text-sm font-medium transition has-focus-visible:outline-2 has-focus-visible:outline-amber-600 dark:has-focus-visible:outline-amber-500 ${
                kind === k ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"
              }`}
            >
              <input type="radio" name="scope" value={k} className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
              {ts[k]}
            </label>
          ))}
        </div>

        {kind !== "bible" && (
          <div className="flex gap-2">
            <Select className="flex-1" aria-label={ts.book} value={book} onChange={(e) => setBook(e.target.value)}>
              {BOOKS.map((b) => (
                <option key={b} value={b}>{bookName(b)}</option>
              ))}
            </Select>
            {kind === "chapter" && (
              <input
                className="input w-24"
                type="number"
                inputMode="numeric"
                min={1}
                max={chapters.at(-1)}
                aria-label={ts.chapter}
                value={chapter}
                onChange={(e) => setChapter(Number(e.target.value))}
              />
            )}
          </div>
        )}
        {kind === "chapter" && !validChapter && versions && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {plural(ts.chapterCount, chapters.length, { book: bookName(book), abbr: versions[0].abbr })}
          </p>
        )}
        {kind === "bible" && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {f(ts.bibleNote, { n: num(1189 * (versions?.length ?? 4)) })}
          </p>
        )}
      </fieldset>

      {running ? (
        <ProgressView run={run} onCancel={onCancel} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-primary" disabled={!ready} onClick={() => onRun(scope, false)}>
            <Eye size={16} aria-hidden />
            {ts.preview}
          </button>
          <button
            className="btn-secondary"
            disabled={!ready}
            onClick={() => {
              if (kind === "bible" && !confirm(ts.confirmBible)) return;
              onRun(scope, true);
            }}
          >
            <RefreshCw size={16} aria-hidden />
            {ts.syncNow}
          </button>
        </div>
      )}
    </section>
  );
}

function ProgressView({ run, onCancel }: { run: Extract<RunState, { status: "running" }>; onCancel: () => void }) {
  const { t, f, num, book } = useI18n();
  const ts = t.sync;
  const p = run.progress;
  const pct = p && p.readTotal ? Math.round((p.readDone / p.readTotal) * 100) : 0;
  const text = !p
    ? ts.starting
    : p.phase === "reading"
      ? f(ts.reading, { book: book(p.book), done: num(p.readDone), total: num(p.readTotal) })
      : f(ts.writing, { book: book(p.book), done: num(p.done), total: num(p.total) });
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2">
          <RefreshCw size={14} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
          {run.apply ? ts.syncing : ts.previewing} — {text}
        </span>
        <button className="btn-ghost shrink-0" onClick={onCancel}>
          <Square size={14} aria-hidden />
          {ts.stop}
        </button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <progress className="sr-only" max={100} value={pct} />
        <div className="h-full rounded-full bg-amber-700 transition-[width] dark:bg-amber-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-stone-600 dark:text-stone-400">{ts.stopNote}</p>
    </div>
  );
}

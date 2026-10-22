import { BOOKS, ESTIMATE_THRESHOLD_MS, estimateRun, type Scope } from "@bvs/core";
import { Eye, RefreshCw, RotateCcw, Square } from "lucide-react";
import { useMemo, useState } from "react";
import type { RunState } from "../App";
import { useI18n } from "../i18n";
import { storedPace } from "../lib/pace";
import type { ResolvedVersion } from "../lib/versions";
import { Select } from "./Select";
import { Step } from "./Step";

type Kind = "bible" | "book" | "chapter";

interface Props {
  /** The versions that can be synced: those with unsupported numbering are left out. */
  versions: ResolvedVersion[] | null;
  run: RunState;
  /** Stop was asked for; the run is winding down to a safe point. */
  stopping: boolean;
  /** The sync memory's highlighted verses per book, for the most a sync may take. */
  remembered?: Readonly<Record<string, number>>;
  onRun: (scope: Scope, apply: boolean) => void;
  /** The book a preview or sync of this scope would pick up at, after an earlier one stopped. */
  resumesAt?: (scope: Scope, apply: boolean) => string | undefined;
  onStartOver?: () => void;
  onCancel: () => void;
}

export function SyncCard({ versions, run, stopping, remembered, onRun, resumesAt, onStartOver, onCancel }: Props) {
  const { t, f, plural, duration, durationRange, book: bookName } = useI18n();
  const ts = t.sync;
  const [kind, setKind] = useState<Kind>("chapter");
  const [book, setBook] = useState("JHN");
  const [chapter, setChapter] = useState(3);

  const chapters = versions?.[0]?.map.chapters(book) ?? [];
  const validChapter = chapters.includes(chapter);
  const scope: Scope = useMemo(
    () =>
      kind === "bible" ? { kind: "books", books: BOOKS }
      : kind === "book" ? { kind: "books", books: [book] }
      : { kind: "chapter", book, chapter },
    [kind, book, chapter],
  );
  const running = run.status === "running";
  const tooFew = !!versions && versions.length < 2;
  const ready = !!versions && !tooFew && !running && (kind !== "chapter" || validChapter);
  // A whole-Bible estimate walks every chapter of every version: not on every keystroke.
  const estimate = useMemo(
    () => {
      if (!versions || tooFew || running) return null;
      const pace = storedPace();
      return estimateRun(versions, scope, pace.msPerRead, { remembered: remembered ?? {}, msPerWrite: pace.msPerWrite });
    },
    [versions, tooFew, running, scope, remembered],
  );

  const previewAt = running ? undefined : resumesAt?.(scope, false);
  const syncAt = running ? undefined : resumesAt?.(scope, true);

  return (
    <section className="card space-y-4" aria-labelledby="sync-title">
      <h2 id="sync-title" className="flex items-center gap-2 font-semibold">
        <Step n={3} />
        {ts.title}
      </h2>

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
        {tooFew && <p className="text-sm text-red-700 dark:text-red-300">{ts.tooFew}</p>}
        {kind === "chapter" && !validChapter && versions && !tooFew && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {plural(ts.chapterCount, chapters.length, { book: bookName(book), abbr: versions[0].abbr })}
          </p>
        )}
        {estimate && estimate.maxMs > ESTIMATE_THRESHOLD_MS && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            {plural(ts.estimate, estimate.reads, { preview: duration(estimate.ms), sync: durationRange(estimate.ms, estimate.maxMs) })}
          </p>
        )}
        {(previewAt || syncAt) && (
          <div className="flex flex-wrap items-center gap-x-2 text-sm text-stone-600 dark:text-stone-400">
            {previewAt && <p>{f(ts.resumePreview, { book: bookName(previewAt) })}</p>}
            {syncAt && <p>{f(ts.resumeSync, { book: bookName(syncAt) })}</p>}
            <button className="btn-ghost min-h-0 gap-1 px-1 py-0.5 text-sm" onClick={onStartOver}>
              <RotateCcw size={14} aria-hidden />
              {ts.startOver}
            </button>
          </div>
        )}
      </fieldset>

      {running ? (
        <ProgressView run={run} stopping={stopping} onCancel={onCancel} />
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

function ProgressView({ run, stopping, onCancel }: {
  run: Extract<RunState, { status: "running" }>;
  stopping: boolean;
  onCancel: () => void;
}) {
  const { t, f, book, duration, durationRange, percent } = useI18n();
  const ts = t.sync;
  const p = run.progress;
  // The bar counts chapters read; the last book's writes come after them, so
  // it holds short of 100% until the run is over.
  const done = p && p.readTotal ? Math.min(p.readDone / p.readTotal, 0.999) : 0;
  const doing = p && f(p.phase === "reading" ? ts.reading : ts.writing, { book: book(p.book) });
  // Over several books, how far into this one: the bar is the whole run.
  const severalBooks = run.scope.kind === "books" && run.scope.books.length > 1;
  const now = stopping
    ? run.apply && p?.phase === "writing" ? f(ts.stoppingWriting, { book: book(p.book) }) : ts.stopping
    : !p || !doing
    ? ts.starting
    : severalBooks && p.total ? f(ts.bookProgress, { doing, percent: percent(p.done / p.total) })
    : doing;
  const r = run.remaining;
  const left = stopping || !r ? null
    : duration(r.minMs) === duration(r.maxMs) ? f(ts.remaining, { time: duration(r.minMs) })
    : f(ts.remainingRange, { time: durationRange(r.minMs, r.maxMs) });
  const label = percent(done, 1);
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium">
        <RefreshCw size={14} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        {run.apply ? ts.syncing : ts.previewing}
        {left && ` — ${left}`}
      </p>
      <p className="text-sm text-stone-600 dark:text-stone-400">{now}</p>
      <div className="relative h-6 overflow-hidden rounded-full bg-stone-200 text-xs font-semibold tabular-nums dark:bg-stone-800">
        <progress className="sr-only" max={100} value={done * 100} />
        <div className="h-full rounded-full bg-amber-700 transition-[width] dark:bg-amber-500" style={{ width: `${done * 100}%` }} />
        {/* The label twice, each clipped to its side of the fill's edge, so it reads on both. */}
        <span className="absolute inset-0 flex items-center justify-center text-stone-900 dark:text-stone-100" aria-hidden>
          {label}
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center text-white transition-[clip-path] dark:text-stone-950"
          style={{ clipPath: `inset(0 ${100 - done * 100}% 0 0)` }}
          aria-hidden
        >
          {label}
        </span>
      </div>
      <button
        className="btn w-full bg-red-700 text-white hover:bg-red-800 sm:w-auto"
        disabled={stopping}
        onClick={onCancel}
      >
        <Square size={14} aria-hidden />
        {stopping ? ts.stoppingButton : ts.stop}
      </button>
      {run.apply && <p className="text-xs text-stone-600 dark:text-stone-400">{ts.stopNote}</p>}
    </div>
  );
}

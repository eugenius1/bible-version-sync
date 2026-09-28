import { BOOK_NAMES, BOOKS, type Scope } from "@bvs/core";
import { useState } from "react";
import type { RunState } from "../App";
import type { ResolvedVersion } from "../lib/versions";

type Kind = "bible" | "book" | "chapter";

interface Props {
  versions: ResolvedVersion[] | null;
  run: RunState;
  onRun: (scope: Scope, apply: boolean) => void;
  onCancel: () => void;
}

export function SyncCard({ versions, run, onRun, onCancel }: Props) {
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
      <h2 id="sync-title" className="font-semibold">Sync</h2>

      <fieldset className="space-y-3" disabled={running}>
        <legend className="sr-only">What to sync</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
          {(["chapter", "book", "bible"] as const).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-lg py-2 text-center text-sm font-medium transition has-focus-visible:outline-2 has-focus-visible:outline-amber-500 ${
                kind === k ? "bg-white shadow-sm dark:bg-stone-950" : "text-stone-600 dark:text-stone-400"
              }`}
            >
              <input type="radio" name="scope" value={k} className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
              {k === "chapter" ? "Chapter" : k === "book" ? "Book" : "Whole Bible"}
            </label>
          ))}
        </div>

        {kind !== "bible" && (
          <div className="flex gap-2">
            <select className="input flex-1" aria-label="Book" value={book} onChange={(e) => setBook(e.target.value)}>
              {BOOKS.map((b) => (
                <option key={b} value={b}>{BOOK_NAMES[b]}</option>
              ))}
            </select>
            {kind === "chapter" && (
              <input
                className="input w-24"
                type="number"
                inputMode="numeric"
                min={1}
                max={chapters.at(-1)}
                aria-label="Chapter"
                value={chapter}
                onChange={(e) => setChapter(Number(e.target.value))}
              />
            )}
          </div>
        )}
        {kind === "chapter" && !validChapter && versions && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {BOOK_NAMES[book]} has {chapters.length} chapters in {versions[0].abbr}.
          </p>
        )}
        {kind === "bible" && (
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Reads about {(1189 * (versions?.length ?? 4)).toLocaleString()} chapters. This can take a while; keep this
            page open.
          </p>
        )}
      </fieldset>

      {running ? (
        <ProgressView run={run} onCancel={onCancel} />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-primary" disabled={!ready} onClick={() => onRun(scope, false)}>
            Preview changes
          </button>
          <button
            className="btn-secondary"
            disabled={!ready}
            onClick={() => {
              if (kind === "bible" && !confirm("Sync the whole Bible now, without a preview?")) return;
              onRun(scope, true);
            }}
          >
            Sync now
          </button>
        </div>
      )}
    </section>
  );
}

function ProgressView({ run, onCancel }: { run: Extract<RunState, { status: "running" }>; onCancel: () => void }) {
  const p = run.progress;
  const pct = p && p.readTotal ? Math.round((p.readDone / p.readTotal) * 100) : 0;
  const text = !p
    ? "Starting…"
    : p.phase === "reading"
      ? `Reading ${BOOK_NAMES[p.book]} · ${p.readDone.toLocaleString()} of ${p.readTotal.toLocaleString()} chapters`
      : `Writing ${BOOK_NAMES[p.book]} · ${p.done} of ${p.total} changes`;
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{run.apply ? "Syncing" : "Previewing"} — {text}</span>
        <button className="btn-ghost shrink-0" onClick={onCancel}>Stop</button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <progress className="sr-only" max={100} value={pct} />
        <div className="h-full rounded-full bg-amber-400 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-stone-500">Stopping finishes the current book first, so nothing is left half-done.</p>
    </div>
  );
}

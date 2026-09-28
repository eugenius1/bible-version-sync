import type { Action, BookResult, Difference } from "@bvs/core";
import type { RunState } from "../App";
import { useI18n } from "../i18n";

const MAX_ROWS = 300;

interface Props {
  run: Extract<RunState, { status: "done" }>;
  onApply: () => void;
  onApplyAllowingRemovals: () => void;
  onSignInAgain: () => void;
}

function tally(actions: Action[], op: Action["op"]): string {
  const by = new Map<string, number>();
  for (const a of actions) if (a.op === op) by.set(a.version, (by.get(a.version) ?? 0) + 1);
  return [...by].map(([v, n]) => `${v} ${op === "set" ? "+" : "−"}${n}`).join(", ");
}

function Swatch({ color }: { color: string | null }) {
  return color ? (
    <span className="inline-block size-3.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: `#${color}` }} />
  ) : (
    <span className="inline-block size-3.5 shrink-0 rounded-sm ring-1 ring-stone-400 ring-inset" />
  );
}

export function Results({ run, onApply, onApplyAllowingRemovals, onSignInAgain }: Props) {
  const { t } = useI18n();
  const tr = t.results;
  const s = run.summary;
  const changed = s.books.filter(
    (b) => b.readError || b.blocked || b.writeErrors.length || b.plan?.actions.length || b.plan?.differences.length,
  );
  const authExpired = s.fatal?.reason === "auth" || s.books.some((b) => b.writeErrors.some((e) => /HTTP 401/.test(e)));
  const total = s.sets + s.removals;

  return (
    <section className="card space-y-4" aria-labelledby="results-title">
      <div className="space-y-1">
        <h2 id="results-title" className="font-semibold">
          {run.apply ? tr.doneTitle : tr.previewTitle}
          {s.aborted && ` ${tr.stopped}`}
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {total === 0 && !s.failedBooks ? (run.apply ? tr.inSyncDone : tr.inSyncPreview) : tr.counts(run.apply, s.sets, s.removals)}
          {s.differences > 0 && ` ${tr.differences(s.differences)}`}
        </p>
        {s.failedBooks > 0 && <p className="text-sm text-red-700 dark:text-red-300">{tr.booksSkipped(s.failedBooks)}</p>}
        {s.writeErrors > 0 && <p className="text-sm text-red-700 dark:text-red-300">{tr.writeErrors(s.writeErrors)}</p>}
      </div>

      {(authExpired || s.fatal?.reason === "network") && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p>{authExpired ? tr.authExpired : tr.network}</p>
          <button className="btn-secondary" onClick={onSignInAgain}>{tr.signInAgain}</button>
        </div>
      )}

      {!run.apply && total > 0 && (
        <button className="btn-primary w-full sm:w-auto" onClick={onApply}>{tr.apply(total)}</button>
      )}
      {run.apply && s.blockedBooks > 0 && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p>{tr.blocked(s.blockedBooks)}</p>
          <button className="btn-secondary" onClick={onApplyAllowingRemovals}>{tr.applyWithRemovals}</button>
        </div>
      )}

      {changed.length > 0 && (
        <ul className="space-y-2">
          {changed.map((b) => <BookRow key={b.book} result={b} />)}
        </ul>
      )}
    </section>
  );
}

function DifferenceRow({ d }: { d: Difference }) {
  const { t, ref } = useI18n();
  return (
    <div className="space-y-1">
      <p>
        <span className="font-medium">{t.results.differentColors}</span> · {ref(d.ref)}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {Object.entries(d.colors).map(([abbr, color]) => (
          <span key={abbr} className="inline-flex items-center gap-1.5">
            <Swatch color={color} />
            {abbr}
            {!color && <span className="text-stone-500">({t.results.removed})</span>}
          </span>
        ))}
      </p>
      <p className="text-stone-600 dark:text-stone-400">{t.results.differenceNote(d.winner)}</p>
    </div>
  );
}

function BookRow({ result: b }: { result: BookResult }) {
  const { t, book, ref } = useI18n();
  const tr = t.results;
  const actions = b.plan?.actions ?? [];
  const adds = tally(actions, "set");
  const rems = tally(actions, "remove");
  return (
    <li className="rounded-xl border border-stone-200 dark:border-stone-800">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-3">
          <span className="font-medium">{book(b.book)}</span>
          {adds && <span className="text-sm text-stone-600 dark:text-stone-400">{adds}</span>}
          {rems && <span className="text-sm text-stone-600 dark:text-stone-400">{rems}</span>}
          {b.readError && <span className="text-sm text-red-700 dark:text-red-300">{tr.skippedRead}</span>}
          {b.blocked && (
            <span className="text-sm text-amber-800 dark:text-amber-300">{tr.notApplied(b.blocked.removals, b.blocked.limit)}</span>
          )}
        </summary>
        <div className="space-y-3 border-t border-stone-200 p-3 text-sm dark:border-stone-800">
          {b.readError && <p className="text-red-700 dark:text-red-300">{b.readError}</p>}
          {b.writeErrors.map((e) => (
            <p key={e} className="text-red-700 dark:text-red-300">{e}</p>
          ))}
          {b.plan?.differences.map((d) => <DifferenceRow key={d.canon} d={d} />)}
          {actions.length > 0 && (
            <ul className="grid gap-1">
              {actions.slice(0, MAX_ROWS).map((a) => (
                <li key={`${a.version}:${a.local}`} className="flex items-center gap-2">
                  <span className="w-10 font-medium">{a.version}</span>
                  <Swatch color={a.color} />
                  <span>{ref(a.local)}</span>
                  <span className="text-stone-500">{tr.action[a.reason]}</span>
                </li>
              ))}
              {actions.length > MAX_ROWS && <li className="text-stone-500">{tr.more(actions.length - MAX_ROWS)}</li>}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

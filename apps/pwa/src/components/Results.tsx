import { BOOK_NAMES, displayRef, type Action, type BookResult } from "@bvs/core";
import type { RunState } from "../App";

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

export function Results({ run, onApply, onApplyAllowingRemovals, onSignInAgain }: Props) {
  const s = run.summary;
  const changed = s.books.filter(
    (b) => b.readError || b.blocked || b.writeErrors.length || b.plan?.actions.length || b.plan?.differences.length,
  );
  const authExpired = s.fatal?.reason === "auth" || s.books.some((b) => b.writeErrors.some((e) => /HTTP 401/.test(e)));
  const total = s.sets + s.removals;
  const verb = run.apply ? { set: "added", rem: "removed" } : { set: "to add", rem: "to remove" };

  return (
    <section className="card space-y-4" aria-labelledby="results-title">
      <div className="space-y-1">
        <h2 id="results-title" className="font-semibold">
          {run.apply ? "Sync finished" : "Preview"}
          {s.aborted && " (stopped)"}
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          {total === 0 && !s.failedBooks
            ? run.apply ? "Everything was already in sync." : "Nothing to change — everything is in sync."
            : `${s.sets.toLocaleString()} highlights ${verb.set}, ${s.removals.toLocaleString()} ${verb.rem}.`}
          {s.differences > 0 && ` ${s.differences} verses have different colors; each version keeps its own.`}
        </p>
        {s.failedBooks > 0 && (
          <p className="text-sm text-red-700 dark:text-red-300">
            {s.failedBooks} book{s.failedBooks > 1 ? "s" : ""} skipped because highlights couldn't be read. Nothing was
            changed in {s.failedBooks > 1 ? "them" : "it"}.
          </p>
        )}
        {s.writeErrors > 0 && (
          <p className="text-sm text-red-700 dark:text-red-300">{s.writeErrors} changes failed; the next sync retries them.</p>
        )}
      </div>

      {authExpired && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
          Stopped: your YouVersion sign-in has expired. Nothing more was changed.{" "}
          <button className="font-medium underline" onClick={onSignInAgain}>Sign in again</button>
        </div>
      )}
      {s.fatal?.reason === "network" && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
          Stopped: couldn't reach YouVersion. Check your connection and try again; if it keeps happening,{" "}
          <button className="font-medium underline" onClick={onSignInAgain}>sign in again</button>.
        </div>
      )}

      {!run.apply && total > 0 && (
        <button className="btn-primary w-full sm:w-auto" onClick={onApply}>
          Apply {total.toLocaleString()} changes
        </button>
      )}
      {run.apply && s.blockedBooks > 0 && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p>
            {s.blockedBooks} book{s.blockedBooks > 1 ? "s were" : " was"} not changed because the sync would remove a lot
            of highlights at once. If you meant to remove them, continue:
          </p>
          <button className="btn-secondary" onClick={onApplyAllowingRemovals}>Apply, including removals</button>
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

function BookRow({ result: b }: { result: BookResult }) {
  const actions = b.plan?.actions ?? [];
  const adds = tally(actions, "set");
  const rems = tally(actions, "remove");
  return (
    <li className="rounded-xl border border-stone-200 dark:border-stone-800">
      <details>
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-3">
          <span className="font-medium">{BOOK_NAMES[b.book]}</span>
          {adds && <span className="text-sm text-stone-600 dark:text-stone-400">{adds}</span>}
          {rems && <span className="text-sm text-stone-600 dark:text-stone-400">{rems}</span>}
          {b.readError && <span className="text-sm text-red-700 dark:text-red-300">skipped: couldn't read</span>}
          {b.blocked && <span className="text-sm text-amber-800 dark:text-amber-300">not applied: {b.blocked}</span>}
        </summary>
        <div className="space-y-3 border-t border-stone-200 p-3 text-sm dark:border-stone-800">
          {b.readError && <p className="text-red-700 dark:text-red-300">{b.readError}</p>}
          {b.writeErrors.map((e) => (
            <p key={e} className="text-red-700 dark:text-red-300">{e}</p>
          ))}
          {b.plan?.differences.map((d) => (
            <p key={d} className="text-stone-600 dark:text-stone-400">Different colors: {d}</p>
          ))}
          {actions.length > 0 && (
            <ul className="grid gap-1">
              {actions.slice(0, MAX_ROWS).map((a) => (
                <li key={`${a.version}:${a.local}`} className="flex items-center gap-2">
                  <span className="w-10 font-medium">{a.version}</span>
                  {a.color ? (
                    <span className="size-3.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: `#${a.color}` }} />
                  ) : (
                    <span className="size-3.5 shrink-0 rounded-sm ring-1 ring-stone-400 ring-inset" />
                  )}
                  <span>{displayRef(a.local)}</span>
                  <span className="text-stone-500">
                    {a.reason === "fill" ? "add" : a.reason === "recolor" ? "change color" : "remove"}
                  </span>
                </li>
              ))}
              {actions.length > MAX_ROWS && (
                <li className="text-stone-500">…and {(actions.length - MAX_ROWS).toLocaleString()} more</li>
              )}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

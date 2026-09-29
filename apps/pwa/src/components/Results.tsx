import type { Action, BookResult, Difference } from "@bvs/core";
import { Check, ChevronRight, CircleAlert, LogIn, TriangleAlert } from "lucide-react";
import { createContext, useContext } from "react";
import type { RunState } from "../App";
import { useI18n } from "../i18n";

/** Bible id -> the name shown for it, in the order of the person's list. */
type Names = ReadonlyMap<number, string>;
const NamesContext = createContext<Names>(new Map());
const nameOf = (names: Names, id: number) => names.get(id) ?? String(id);

const MAX_ROWS = 300;

interface Props {
  run: Extract<RunState, { status: "done" }>;
  names: Names;
  onApply: () => void;
  onApplyAllowingRemovals: () => void;
  onSignInAgain: () => void;
}

function tally(actions: Action[], op: Action["op"], num: (n: number) => string, names: Names): string {
  const by = new Map<number, number>();
  for (const a of actions) if (a.op === op) by.set(a.version, (by.get(a.version) ?? 0) + 1);
  return [...by].map(([v, n]) => `${nameOf(names, v)} ${op === "set" ? "+" : "−"}${num(n)}`).join(", ");
}

function Swatch({ color }: { color: string | null }) {
  return color ? (
    <span className="inline-block size-3.5 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: `#${color}` }} />
  ) : (
    <span className="inline-block size-3.5 shrink-0 rounded-sm ring-1 ring-stone-400 ring-inset" />
  );
}

function Notice({ tone, children }: { tone: "warn" | "error"; children: React.ReactNode }) {
  const Icon = tone === "warn" ? TriangleAlert : CircleAlert;
  return (
    <div
      className={`flex gap-2 rounded-xl p-3 text-sm ${
        tone === "warn" ? "bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
      }`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Results({ run, names, onApply, onApplyAllowingRemovals, onSignInAgain }: Props) {
  const { t, f, plural } = useI18n();
  const tr = t.results;
  const s = run.summary;
  const changed = s.books.filter(
    (b) => b.readError || b.blocked || b.writeErrors.length || b.plan?.actions.length || b.plan?.differences.length,
  );
  const authExpired = s.fatal?.reason === "auth" || s.books.some((b) => b.writeErrors.some((e) => /HTTP 401/.test(e)));
  const total = s.sets + s.removals;
  const inSync = total === 0 && !s.failedBooks;

  return (
    <NamesContext.Provider value={names}>
      <section className="card space-y-4" aria-labelledby="results-title">
        <div className="space-y-1">
          <h2 id="results-title" className="font-semibold">
            {run.apply ? tr.doneTitle : tr.previewTitle}
            {s.aborted && ` ${tr.stopped}`}
          </h2>
          <p className="flex items-start gap-1.5 text-sm text-stone-600 dark:text-stone-400">
            {inSync && <Check size={16} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />}
            <span>
              {inSync
                ? run.apply ? tr.inSyncDone : tr.inSyncPreview
                : run.apply
                  ? `${plural(tr.added, s.sets)}, ${plural(tr.removedCount, s.removals)}.`
                  : `${plural(tr.toAdd, s.sets)}, ${plural(tr.toRemove, s.removals)}.`}
              {s.differences > 0 && ` ${plural(tr.differences, s.differences)}`}
            </span>
          </p>
        </div>

        {s.refused.length > 0 && <Notice tone="warn">{f(tr.refused, { names: s.refused.map((id) => nameOf(names, id)).join(", ") })}</Notice>}
        {s.failedBooks > 0 && <Notice tone="error">{plural(tr.booksSkipped, s.failedBooks)}</Notice>}
        {s.writeErrors > 0 && <Notice tone="error">{plural(tr.writeErrors, s.writeErrors)}</Notice>}

        {(authExpired || s.fatal?.reason === "network") && (
          <Notice tone="warn">
            <p>{authExpired ? tr.authExpired : tr.network}</p>
            <button className="btn-secondary" onClick={onSignInAgain}>
              <LogIn size={16} aria-hidden />
              {tr.signInAgain}
            </button>
          </Notice>
        )}

        {!run.apply && total > 0 && (
          <button className="btn-primary w-full sm:w-auto" onClick={onApply}>
            <Check size={16} aria-hidden />
            {plural(tr.apply, total)}
          </button>
        )}
        {run.apply && s.blockedBooks > 0 && (
          <Notice tone="warn">
            <p>{plural(tr.blocked, s.blockedBooks)}</p>
            <button className="btn-secondary" onClick={onApplyAllowingRemovals}>{tr.applyWithRemovals}</button>
          </Notice>
        )}

        {changed.length > 0 && (
          <ul className="space-y-2">
            {changed.map((b) => <BookRow key={b.book} result={b} />)}
          </ul>
        )}
      </section>
    </NamesContext.Provider>
  );
}

function DifferenceRow({ d }: { d: Difference }) {
  const { t, f, ref } = useI18n();
  const names = useContext(NamesContext);
  // In the list's order: object keys that are numbers come back sorted.
  const order = [...names.keys()];
  const colors = Object.entries(d.colors)
    .map(([id, color]) => [Number(id), color] as const)
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
  return (
    <div className="space-y-1">
      <p>
        <span className="font-medium">{t.results.differentColors}</span> · {ref(d.ref)}
      </p>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {colors.map(([id, color]) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            <Swatch color={color} />
            {nameOf(names, id)}
            {!color && <span className="text-stone-600 dark:text-stone-400">({t.results.removed})</span>}
          </span>
        ))}
      </p>
      <p className="text-stone-600 dark:text-stone-400">{f(t.results.differenceNote, { winner: nameOf(names, d.winner) })}</p>
    </div>
  );
}

function BookRow({ result: b }: { result: BookResult }) {
  const { t, f, num, book, ref } = useI18n();
  const names = useContext(NamesContext);
  const tr = t.results;
  const actions = b.plan?.actions ?? [];
  const adds = tally(actions, "set", num, names);
  const rems = tally(actions, "remove", num, names);
  return (
    <li className="rounded-xl border border-stone-200 dark:border-stone-800">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-3">
          <ChevronRight size={16} className="shrink-0 transition group-open:rotate-90" aria-hidden />
          <span className="font-medium">{book(b.book)}</span>
          {adds && <span className="text-sm text-stone-600 dark:text-stone-400">{adds}</span>}
          {rems && <span className="text-sm text-stone-600 dark:text-stone-400">{rems}</span>}
          {b.readError && <span className="text-sm text-red-700 dark:text-red-300">{tr.skippedRead}</span>}
          {b.blocked && (
            <span className="text-sm text-amber-900 dark:text-amber-200">
              {f(tr.notApplied, { removals: num(b.blocked.removals), limit: num(b.blocked.limit) })}
            </span>
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
                  <span className="w-10 font-medium">{nameOf(names, a.version)}</span>
                  <Swatch color={a.color} />
                  <span>{ref(a.local)}</span>
                  <span className="text-stone-600 dark:text-stone-400">{tr.action[a.reason]}</span>
                </li>
              ))}
              {actions.length > MAX_ROWS && (
                <li className="text-stone-600 dark:text-stone-400">{f(tr.more, { n: num(actions.length - MAX_ROWS) })}</li>
              )}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

import {
  emptyState,
  ESTIMATE_THRESHOLD_MS,
  estimateRun,
  forgetVersion,
  highlightedByBook,
  remainingScope,
  RunClock,
  runSync,
  type BookResult,
  type HighlightColorId,
  type Progress,
  type RunSummary,
  type SyncState,
  type Scope,
} from "@bvs/core";
import { ChartColumn, LogIn, LogOut, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher, ThemeSwitcher } from "./components/Pickers";
import { Priority } from "./components/Priority";
import { Results } from "./components/Results";
import { StatsPage } from "./components/Stats";
import { DEFAULT_SELECTION, SyncCard } from "./components/SyncCard";
import { VersionsCard } from "./components/VersionsCard";
import { useI18n } from "./i18n";
import { copyrightYears } from "./lib/copyright";
import { APP_KEY, client, completeSignIn, isCallback, SignInError, signOut, startSignIn } from "./lib/auth";
import { labelVersions, runKey, runKind, store, tokenStore, type Settings, type Unfinished } from "./lib/db";
import { persistPace, storedPace } from "./lib/pace";
import { resolveVersions, type ResolvedVersion } from "./lib/versions";

type Auth = "loading" | "signed-out" | "signed-in";

export type RunState =
  | { status: "idle" }
  | {
      status: "running";
      apply: boolean;
      scope: Scope;
      progress: Progress | null;
      /**
       * Time left, while the run looks like taking more than a few seconds:
       * at least the reads, at most those and every write they could lead to.
       */
      remaining: { minMs: number; maxMs: number } | null;
    }
  | { status: "done"; apply: boolean; scope: Scope; summary: RunSummary }
  | { status: "error"; message: string };

/**
 * The address's hash, which picks the page: "#stats" is the stats page.
 * A hash rather than a path, since GitHub Pages has no SPA fallback.
 */
function useHash(): string {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return hash;
}

const REPO_URL = "https://github.com/eugenius1/bible-version-sync";
const FOOTER_LINK = "underline underline-offset-2 hover:text-stone-900 dark:hover:text-stone-100";
export function App() {
  if (isCallback()) return <Callback />;
  return <Main />;
}

function Shell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  const { t, f } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 bg-stone-50/90 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9" />
          <h1 className="text-lg font-semibold">Bible Version Sync</h1>
          <div className="ml-auto flex items-center">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-1 pb-6 sm:pb-10">
        {children}
        <footer className="mt-auto space-y-3 pt-6 text-xs text-stone-600 dark:text-stone-400">
          {account && <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">{account}</div>}
          <p className="text-center">
            {f(t.app.copyright, { years: copyrightYears() })}{" "}
            <a href="https://eusebius.tech/" target="_blank" rel="noreferrer" className={FOOTER_LINK}>
              Eusebius Ngemera
            </a>{" "}
            ·{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              title={t.app.licenceTitle}
              className={FOOTER_LINK}
            >
              {t.app.licence}
            </a>{" "}
            · {t.app.notAffiliated}
          </p>
        </footer>
      </div>
    </div>
  );
}

function Callback() {
  const { t, f } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    completeSignIn()
      .then((r) => {
        if (r === "done") location.replace(import.meta.env.BASE_URL);
      })
      .catch(setError);
  }, []);

  let message = "";
  if (error instanceof SignInError) {
    message =
      error.code === "state-mismatch" ? t.callback.stateMismatch
      : error.code === "no-permission" ? t.callback.noPermission
      : f(t.callback.provider, { detail: error.detail });
  } else if (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  return (
    <Shell>
      <div className="card">
        {error ? (
          <div className="space-y-4">
            <p className="font-medium">{t.callback.failed}</p>
            <p className="text-sm text-stone-600 dark:text-stone-400">{message}</p>
            <a href={import.meta.env.BASE_URL} className="btn-primary">{t.app.back}</a>
          </div>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.callback.finishing}</p>
        )}
      </div>
    </Shell>
  );
}

function Main() {
  const { t, plural } = useI18n();
  const [auth, setAuth] = useState<Auth>("loading");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [versions, setVersions] = useState<ResolvedVersion[] | null>(null);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  /** The sync memory's size, and its highlighted verses per book for the estimates. */
  const [memory, setMemory] = useState<{ verses: number; byBook: Record<string, number> }>({ verses: 0, byBook: {} });
  const remember = (state: SyncState) => setMemory({ verses: Object.keys(state.verses).length, byBook: highlightedByBook(state) });
  const [customised, setCustomised] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const [stopping, setStopping] = useState(false);
  const [selection, setSelection] = useState(DEFAULT_SELECTION);
  const [unfinished, setUnfinished] = useState<Partial<Record<"preview" | "sync", Unfinished>>>({});
  const [page, query] = useHash().slice(1).split("?");

  useEffect(() => {
    void (async () => {
      setAuth((await tokenStore.get()) ? "signed-in" : "signed-out");
      setSettings(await store.getSettings());
      setCustomised(await store.hasSettings());
      remember(await store.getState());
      const [preview, sync] = await Promise.all([store.getUnfinished(false), store.getUnfinished(true)]);
      setUnfinished({ preview, sync });
    })();
  }, []);

  // Memoised: the sync card's whole-Bible estimate is worked out again whenever this changes.
  const syncable = useMemo(() => versions?.filter((v) => v.source !== "unsupported") ?? null, [versions]);

  // Only the versions: reordering colors shouldn't check every version's numbering again.
  const chosen = settings?.versions;
  useEffect(() => {
    if (!chosen || auth !== "signed-in") return;
    let cancelled = false;
    setVersions(null);
    resolveVersions(chosen)
      .then((v) => !cancelled && setVersions(v))
      .catch((e: unknown) => !cancelled && setRun({ status: "error", message: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [chosen, auth]);

  const saveUnfinished = useCallback(async (apply: boolean, u: Unfinished | null) => {
    await store.setUnfinished(apply, u);
    setUnfinished((prev) => ({ ...prev, [runKind(apply)]: u ?? undefined }));
  }, []);

  const forgetUnfinished = useCallback(async () => {
    await saveUnfinished(false, null);
    await saveUnfinished(true, null);
  }, [saveUnfinished]);

  const saveVersions = useCallback(
    async (next: number[], removed?: number) => {
      if (removed !== undefined) {
        const state = await store.getState();
        forgetVersion(state, removed);
        await store.setState(state);
        remember(state);
        // Its snapshot is gone, so what a stopped run planned with it no longer holds.
        await forgetUnfinished();
      }
      const s = { ...settings!, versions: labelVersions(next) };
      await store.setSettings(s);
      setSettings(s);
      setCustomised(true);
      setRun({ status: "idle" });
    },
    [settings, forgetUnfinished],
  );

  const saveColors = useCallback(
    async (byColor: boolean, colorOrder: HighlightColorId[]) => {
      const s = { ...settings!, byColor, colorOrder };
      await store.setSettings(s);
      setSettings(s);
      setCustomised(true);
      setRun({ status: "idle" }); // a preview made under the old order no longer holds
    },
    [settings],
  );

  /** The books an earlier preview or sync of this scope finished before it stopped, to pick up after. */
  const earlierRun = useCallback(
    (scope: Scope, apply: boolean): BookResult[] => {
      const u = unfinished[runKind(apply)];
      return u && settings && scope.kind === "books" && u.key === runKey(settings, scope.books) ? u.results : [];
    },
    [unfinished, settings],
  );

  const startRun = useCallback(
    async (scope: Scope, apply: boolean, { allowRemovals = false, fresh = false } = {}) => {
      if (!versions || !settings) return;
      const controller = new AbortController();
      abort.current = controller;
      setStopping(false);
      const earlier = fresh ? [] : earlierRun(scope, apply);
      // Only several books are worth picking up after; one book is the smallest
      // step anyway, and a run of one leaves a stopped whole-Bible run alone.
      const resumable = scope.kind === "books" && scope.books.length > 1;
      const saveProgress = async (results: readonly BookResult[]) => {
        if (!resumable || scope.kind !== "books") return;
        // Nothing planned, or nothing left: starting over is the same as picking up.
        const worth = results.some((r) => r.plan || r.written?.length) && remainingScope(scope, results).books.length > 0;
        await store.setUnfinished(apply, worth ? { key: runKey(settings, scope.books), results: [...results] } : null);
      };
      const pace = storedPace();
      const todo = remainingScope(scope, earlier, allowRemovals);
      setRun({ status: "running", apply, scope, progress: null, remaining: null });
      let wakeLock: { release(): Promise<void> } | null = null;
      let clock: RunClock | null = null;
      try {
        wakeLock = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
        // A sync changes the snapshot, so a stopped preview's books no longer hold.
        if (apply) await saveUnfinished(false, null);
        const state = await store.getState();
        const writes = apply ? { remembered: highlightedByBook(state), msPerWrite: pace.msPerWrite } : undefined;
        const expected = estimateRun(versions, todo, pace.msPerRead, writes);
        const { forecast } = expected;
        // Started only now, so neither the wake lock nor loading the snapshot
        // is timed as the first read and saved as this browser's pace.
        const timer = (clock = new RunClock(performance.now(), { ...pace, expectedMs: expected.maxMs }, expected.forecast));
        const left = () => (timer.long ? { minMs: timer.remainingMs(), maxMs: timer.maxRemainingMs() } : null);
        if (timer.long) setRun({ status: "running", apply, scope, progress: null, remaining: { minMs: expected.ms, maxMs: expected.maxMs } });
        const summary = await runSync({
          api: client,
          // Unsupported ones too: the sync leaves them out but keeps their snapshot.
          versions,
          scope,
          state,
          apply,
          resume: earlier,
          maxRemovals: settings.maxRemovals,
          allowRemovals,
          colorOrder: settings.byColor ? settings.colorOrder : undefined,
          signal: controller.signal,
          onProgress: (progress) => {
            timer.tick(progress, performance.now());
            setRun({ status: "running", apply, scope, progress, remaining: left() });
          },
          // Saved as each book finishes, so a page closed mid-run picks up too.
          // Only stored for now: the card shows it once the run is over.
          onBookDone: async (r, results) => {
            if (r.plan) forecast?.bookRead(r.plan);
            if (apply) {
              await store.setState(state);
              // Each book, so a run that fails partway still leaves the counts right.
              remember(state);
            }
            await saveProgress(results);
          },
        });
        await saveProgress(summary.aborted || summary.fatal ? summary.books : []);
        setRun({ status: "done", apply, scope, summary });
      } catch (e) {
        setRun({ status: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        if (clock) {
          persistPace({
            ...(clock.readsTimed && { msPerRead: clock.msPerRead }),
            ...(clock.writesTimed && { msPerWrite: clock.msPerWrite }),
          });
        }
        await wakeLock?.release().catch(() => undefined);
        // From the store, which is ahead of the card if the run failed partway.
        if (resumable) {
          const u = await store.getUnfinished(apply).catch(() => undefined);
          setUnfinished((prev) => ({ ...prev, [runKind(apply)]: u }));
        }
        abort.current = null;
        setStopping(false);
      }
    },
    [versions, settings, earlierRun, saveUnfinished],
  );

  if (!APP_KEY) {
    return (
      <Shell>
        <div className="card text-sm">{t.signIn.missingKey}</div>
      </Shell>
    );
  }
  if (auth === "loading" || !settings) return <Shell>{null}</Shell>;
  // Read only from this browser, so it needs no sign-in.
  if (page === "stats") {
    return (
      <Shell>
        {/* "#stats?demo": made-up data to look at the page with, in development. */}
        <StatsPage versions={settings.versions} colorOrder={settings.colorOrder} demo={import.meta.env.DEV && query === "demo"} />
      </Shell>
    );
  }
  if (auth === "signed-out") return <SignIn />;

  const running = run.status === "running";
  const account = (
    <>
      <span className="inline-flex items-center">
        {plural(t.footer.memory, memory.verses)}
        <button
          className="btn-ghost ml-1 min-h-0 gap-1 px-1 py-0.5 text-xs"
          disabled={running}
          onClick={async () => {
            if (!confirm(t.footer.confirmReset)) return;
            const state = emptyState();
            await store.setState(state);
            await forgetUnfinished();
            remember(state);
          }}
        >
          <RotateCcw size={12} aria-hidden />
          {t.footer.reset}
        </button>
      </span>
      {/* Not mid-run: the page replaces the sync card, Stop button and all. */}
      <a
        href={running ? undefined : "#stats"}
        aria-disabled={running || undefined}
        className="btn-ghost min-h-0 gap-1 px-1 py-0.5 text-xs aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        <ChartColumn size={12} aria-hidden />
        {t.footer.stats}
      </a>
      <button
        className="btn-ghost min-h-0 gap-1 px-1 py-0.5 text-xs"
        disabled={running}
        onClick={async () => {
          await signOut();
          setAuth("signed-out");
        }}
      >
        <LogOut size={12} aria-hidden />
        {t.footer.signOut}
      </button>
    </>
  );

  return (
    <Shell account={account}>
      <VersionsCard
        settings={settings.versions}
        resolved={versions}
        disabled={running}
        fresh={!customised && memory.verses === 0}
        onChange={saveVersions}
      />
      <Priority
        versions={settings.versions}
        byColor={settings.byColor}
        colorOrder={settings.colorOrder}
        disabled={running}
        onVersions={saveVersions}
        onColors={saveColors}
      />
      <SyncCard
        versions={syncable}
        run={run}
        stopping={stopping}
        selection={selection}
        onSelect={setSelection}
        remembered={memory.byBook}
        onRun={startRun}
        resumesAt={(scope, apply) => {
          const earlier = earlierRun(scope, apply);
          const left = remainingScope(scope, earlier);
          return earlier.length && left.kind === "books" ? left.books[0] : undefined;
        }}
        onStartOver={forgetUnfinished}
        onCancel={() => {
          abort.current?.abort();
          setStopping(true);
        }}
      />
      {run.status === "done" && (
        <Results
          run={run}
          names={new Map((versions ?? []).map((v) => [v.bibleId, v.abbr]))}
          // What the preview showed, read afresh rather than picked up from an older stopped sync.
          onApply={() => startRun(run.scope, true, { fresh: true })}
          onApplyAllowingRemovals={() => startRun(run.scope, true, { allowRemovals: true })}
          onSignInAgain={async () => {
            await signOut();
            await startSignIn();
          }}
        />
      )}
      {run.status === "error" && (
        <div className="card border-red-300 text-sm text-red-700 dark:border-red-900 dark:text-red-300">{run.message}</div>
      )}
    </Shell>
  );
}

function SignIn() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <div className="card space-y-4">
        <p className="text-base">{t.signIn.intro}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-400">
          {t.signIn.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <button
          className="btn-primary w-full sm:w-auto"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void startSignIn();
          }}
        >
          <LogIn size={16} aria-hidden />
          {busy ? t.signIn.opening : t.signIn.button}
        </button>
        <p className="text-xs text-stone-600 dark:text-stone-400">{t.signIn.disclaimer}</p>
      </div>
      <iframe
        src="https://www.instagram.com/p/DfAsZNWtJrf/embed"
        title={t.signIn.reelTitle}
        loading="lazy"
        allowFullScreen
        className="mx-auto h-[36rem] w-full max-w-sm rounded-xl border-0 bg-white"
      />
    </Shell>
  );
}

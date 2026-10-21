import {
  emptyState,
  estimateRun,
  forgetVersion,
  RunClock,
  runSync,
  type HighlightColorId,
  type Progress,
  type RunSummary,
  type Scope,
} from "@bvs/core";
import { ChartColumn, LogIn, LogOut, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSwitcher, ThemeSwitcher } from "./components/Pickers";
import { Priority } from "./components/Priority";
import { Results } from "./components/Results";
import { StatsPage } from "./components/Stats";
import { SyncCard } from "./components/SyncCard";
import { VersionsCard } from "./components/VersionsCard";
import { useI18n } from "./i18n";
import { copyrightYears } from "./lib/copyright";
import { APP_KEY, client, completeSignIn, isCallback, SignInError, signOut, startSignIn } from "./lib/auth";
import { labelVersions, store, tokenStore, type Settings } from "./lib/db";
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
      /** Time left, while the run looks like taking more than a few seconds. */
      remainingMs: number | null;
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

const LICENCE_URL = "https://github.com/eugenius1/bible-version-sync/blob/main/LICENSE";
export function App() {
  if (isCallback()) return <Callback />;
  return <Main />;
}

function Shell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  const { t, f } = useI18n();
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-9" />
        <h1 className="text-lg font-semibold">Bible Version Sync</h1>
        <div className="ml-auto flex items-center">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </header>
      {children}
      <footer className="mt-auto space-y-3 pt-6 text-xs text-stone-600 dark:text-stone-400">
        {account && <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">{account}</div>}
        <p className="text-center">
          {f(t.app.copyright, { years: copyrightYears() })} ·{" "}
          <a
            href={LICENCE_URL}
            target="_blank"
            rel="noreferrer"
            title={t.app.licenceTitle}
            className="underline underline-offset-2 hover:text-stone-900 dark:hover:text-stone-100"
          >
            {t.app.licence}
          </a>{" "}
          · {t.app.notAffiliated}
        </p>
      </footer>
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
  const [remembered, setRemembered] = useState(0);
  const [customised, setCustomised] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const [stopping, setStopping] = useState(false);
  const [page, query] = useHash().slice(1).split("?");

  useEffect(() => {
    void (async () => {
      setAuth((await tokenStore.get()) ? "signed-in" : "signed-out");
      setSettings(await store.getSettings());
      setCustomised(await store.hasSettings());
      setRemembered(Object.keys((await store.getState()).verses).length);
    })();
  }, []);

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

  const saveVersions = useCallback(
    async (next: number[], removed?: number) => {
      if (removed !== undefined) {
        const state = await store.getState();
        forgetVersion(state, removed);
        await store.setState(state);
      }
      const s = { ...settings!, versions: labelVersions(next) };
      await store.setSettings(s);
      setSettings(s);
      setCustomised(true);
      setRun({ status: "idle" });
    },
    [settings],
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

  const startRun = useCallback(
    async (scope: Scope, apply: boolean, allowRemovals = false) => {
      if (!versions || !settings) return;
      const controller = new AbortController();
      abort.current = controller;
      setStopping(false);
      const pace = storedPace();
      const expected = estimateRun(versions, scope, pace.msPerRead);
      const clock = new RunClock(performance.now(), { ...pace, expectedMs: expected.ms });
      const left = () => (clock.long ? clock.remainingMs() : null);
      setRun({ status: "running", apply, scope, progress: null, remainingMs: clock.long ? expected.ms : null });
      let wakeLock: { release(): Promise<void> } | null = null;
      try {
        wakeLock = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
        const state = await store.getState();
        const summary = await runSync({
          api: client,
          // Unsupported ones too: the sync leaves them out but keeps their snapshot.
          versions,
          scope,
          state,
          apply,
          maxRemovals: settings.maxRemovals,
          allowRemovals,
          colorOrder: settings.byColor ? settings.colorOrder : undefined,
          signal: controller.signal,
          onProgress: (progress) => {
            clock.tick(progress, performance.now());
            setRun({ status: "running", apply, scope, progress, remainingMs: left() });
          },
          onBookDone: async () => {
            if (apply) await store.setState(state);
          },
        });
        if (apply) setRemembered(Object.keys(state.verses).length);
        setRun({ status: "done", apply, scope, summary });
      } catch (e) {
        setRun({ status: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        persistPace({
          ...(clock.readsTimed && { msPerRead: clock.msPerRead }),
          ...(clock.writesTimed && { msPerWrite: clock.msPerWrite }),
        });
        await wakeLock?.release().catch(() => undefined);
        abort.current = null;
        setStopping(false);
      }
    },
    [versions, settings],
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
        <StatsPage versions={settings.versions} colorOrder={settings.colorOrder} demo={query === "demo"} />
      </Shell>
    );
  }
  if (auth === "signed-out") return <SignIn />;

  const running = run.status === "running";
  const account = (
    <>
      <span className="inline-flex items-center">
        {plural(t.footer.memory, remembered)}
        <button
          className="btn-ghost ml-1 min-h-0 gap-1 px-1 py-0.5 text-xs"
          disabled={running}
          onClick={async () => {
            if (!confirm(t.footer.confirmReset)) return;
            await store.setState(emptyState());
            setRemembered(0);
          }}
        >
          <RotateCcw size={12} aria-hidden />
          {t.footer.reset}
        </button>
      </span>
      <a href="#stats" className="btn-ghost min-h-0 gap-1 px-1 py-0.5 text-xs">
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
        fresh={!customised && remembered === 0}
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
        versions={versions?.filter((v) => v.source !== "unsupported") ?? null}
        run={run}
        stopping={stopping}
        onRun={startRun}
        onCancel={() => {
          abort.current?.abort();
          setStopping(true);
        }}
      />
      {run.status === "done" && (
        <Results
          run={run}
          names={new Map((versions ?? []).map((v) => [v.bibleId, v.abbr]))}
          onApply={() => startRun(run.scope, true)}
          onApplyAllowingRemovals={() => startRun(run.scope, true, true)}
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
      </div>
      <p className="px-1 text-xs text-stone-600 dark:text-stone-400">{t.signIn.disclaimer}</p>
    </Shell>
  );
}

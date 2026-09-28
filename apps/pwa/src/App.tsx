import { emptyState, forgetVersion, runSync, type Progress, type RunSummary, type Scope } from "@bvs/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { APP_KEY, client, completeSignIn, isCallback, signOut, startSignIn } from "./lib/auth";
import { store, tokenStore, type Settings, type VersionSetting } from "./lib/db";
import { resolveVersions, type ResolvedVersion } from "./lib/versions";
import { Results } from "./components/Results";
import { SyncCard } from "./components/SyncCard";
import { VersionsCard } from "./components/VersionsCard";

type Auth = "loading" | "signed-out" | "signed-in";

export type RunState =
  | { status: "idle" }
  | { status: "running"; apply: boolean; scope: Scope; progress: Progress | null }
  | { status: "done"; apply: boolean; scope: Scope; summary: RunSummary }
  | { status: "error"; message: string };

export function App() {
  if (isCallback()) return <Callback />;
  return <Main />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-9" />
        <h1 className="text-lg font-semibold">Bible Version Sync</h1>
      </header>
      {children}
    </div>
  );
}

function Callback() {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    completeSignIn()
      .then((r) => {
        if (r === "done") location.replace("/");
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  return (
    <Shell>
      <div className="card">
        {error ? (
          <div className="space-y-4">
            <p className="font-medium">Sign-in didn't complete</p>
            <p className="text-sm text-stone-600 dark:text-stone-400">{error}</p>
            <a href="/" className="btn-primary">Back</a>
          </div>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">Finishing sign-in…</p>
        )}
      </div>
    </Shell>
  );
}

function Main() {
  const [auth, setAuth] = useState<Auth>("loading");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [versions, setVersions] = useState<ResolvedVersion[] | null>(null);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const [remembered, setRemembered] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      setAuth((await tokenStore.get()) ? "signed-in" : "signed-out");
      setSettings(await store.getSettings());
      setRemembered(Object.keys((await store.getState()).verses).length);
    })();
  }, []);

  useEffect(() => {
    if (!settings || auth !== "signed-in") return;
    let cancelled = false;
    setVersions(null);
    resolveVersions(settings.versions)
      .then((v) => !cancelled && setVersions(v))
      .catch((e: unknown) => !cancelled && setRun({ status: "error", message: String(e) }));
    return () => {
      cancelled = true;
    };
  }, [settings, auth]);

  const saveVersions = useCallback(
    async (next: VersionSetting[], removed?: string) => {
      if (removed) {
        const state = await store.getState();
        forgetVersion(state, removed);
        await store.setState(state);
      }
      const s = { ...settings!, versions: next };
      await store.setSettings(s);
      setSettings(s);
      setRun({ status: "idle" });
    },
    [settings],
  );

  const startRun = useCallback(
    async (scope: Scope, apply: boolean, allowRemovals = false) => {
      if (!versions || !settings) return;
      const controller = new AbortController();
      abort.current = controller;
      setRun({ status: "running", apply, scope, progress: null });
      let wakeLock: { release(): Promise<void> } | null = null;
      try {
        wakeLock = (await navigator.wakeLock?.request("screen").catch(() => null)) ?? null;
        const state = await store.getState();
        const summary = await runSync({
          api: client,
          versions,
          scope,
          state,
          apply,
          maxRemovals: settings.maxRemovals,
          allowRemovals,
          signal: controller.signal,
          onProgress: (progress) => setRun({ status: "running", apply, scope, progress }),
          onBookDone: async () => {
            if (apply) await store.setState(state);
          },
        });
        if (apply) setRemembered(Object.keys(state.verses).length);
        setRun({ status: "done", apply, scope, summary });
      } catch (e) {
        setRun({ status: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        await wakeLock?.release().catch(() => undefined);
        abort.current = null;
      }
    },
    [versions, settings],
  );

  if (!APP_KEY) {
    return (
      <Shell>
        <div className="card text-sm">
          Missing app key. Set <code>VITE_YV_APP_KEY</code> in <code>apps/pwa/.env.local</code> and restart.
        </div>
      </Shell>
    );
  }
  if (auth === "loading" || !settings) return <Shell>{null}</Shell>;
  if (auth === "signed-out") return <SignIn />;

  const running = run.status === "running";
  return (
    <Shell>
      <VersionsCard settings={settings.versions} resolved={versions} disabled={running} onChange={saveVersions} />
      <SyncCard
        versions={versions}
        run={run}
        onRun={startRun}
        onCancel={() => abort.current?.abort()}
      />
      {run.status === "done" && (
        <Results
          run={run}
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
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-stone-500">
        <span>
          Sync memory: {remembered.toLocaleString()} verses
          <button
            className="btn-ghost ml-1 min-h-0 px-1 underline"
            disabled={running}
            onClick={async () => {
              if (!confirm("Forget what previous syncs did? The next sync will only fill in blanks; it won't remove or recolor anything.")) return;
              await store.setState(emptyState());
              setRemembered(0);
            }}
          >
            Reset
          </button>
        </span>
        <button
          className="btn-ghost min-h-0 px-1 underline"
          disabled={running}
          onClick={async () => {
            await signOut();
            setAuth("signed-out");
          }}
        >
          Sign out
        </button>
      </footer>
    </Shell>
  );
}

function SignIn() {
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <div className="card space-y-4">
        <p className="text-base">
          Highlight a verse in one Bible version, and have it show up in the others you read. Verse numbers are matched
          even where versions differ (Psalm titles, Joel, Malachi, Job and more).
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-400">
          <li>Existing highlights are never recolored or removed on your first sync.</li>
          <li>Preview every change before anything is written.</li>
          <li>Your sign-in and data stay in this browser and go only to YouVersion.</li>
        </ul>
        <button
          className="btn-primary w-full sm:w-auto"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void startSignIn();
          }}
        >
          {busy ? "Opening YouVersion…" : "Sign in with YouVersion"}
        </button>
      </div>
      <p className="px-1 text-xs text-stone-500">
        Not affiliated with YouVersion. Uses the YouVersion Platform API with your permission.
      </p>
    </Shell>
  );
}

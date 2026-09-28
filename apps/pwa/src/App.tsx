import { emptyState, forgetVersion, runSync, type Progress, type RunSummary, type Scope } from "@bvs/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Results } from "./components/Results";
import { SyncCard } from "./components/SyncCard";
import { VersionsCard } from "./components/VersionsCard";
import { LANGS, useI18n, type Lang } from "./i18n";
import { APP_KEY, client, completeSignIn, isCallback, SignInError, signOut, startSignIn } from "./lib/auth";
import { store, tokenStore, type Settings, type VersionSetting } from "./lib/db";
import { resolveVersions, type ResolvedVersion } from "./lib/versions";

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

function Shell({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-4 py-6 sm:py-10">
      <header className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-9" />
        <h1 className="text-lg font-semibold">Bible Version Sync</h1>
      </header>
      {children}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4 text-xs text-stone-500">
        {footer}
        <Preferences />
      </footer>
    </div>
  );
}

/** Language (and, below, theme) switchers shown on every screen. */
function Preferences() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="ml-auto flex items-center gap-3">
      <Segmented
        label={t.footer.language}
        value={lang}
        options={(Object.keys(LANGS) as Lang[]).map((l) => ({ value: l, text: l.toUpperCase(), title: LANGS[l].langName, lang: l }))}
        onChange={(l) => setLang(l as Lang)}
      />
    </div>
  );
}

export function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; text: string; title?: string; lang?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-stone-200/70 p-0.5 dark:bg-stone-800">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          lang={o.lang}
          className={`cursor-pointer rounded-md px-2 py-1 font-medium transition focus-visible:outline-2 focus-visible:outline-amber-500 ${
            value === o.value
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-100"
              : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          }`}
          onClick={() => onChange(o.value)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Callback() {
  const { t } = useI18n();
  const [error, setError] = useState<unknown>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    completeSignIn()
      .then((r) => {
        if (r === "done") location.replace("/");
      })
      .catch(setError);
  }, []);

  let message = "";
  if (error instanceof SignInError) {
    message =
      error.code === "state-mismatch" ? t.callback.stateMismatch
      : error.code === "no-permission" ? t.callback.noPermission
      : t.callback.provider(error.detail);
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
            <a href="/" className="btn-primary">{t.back}</a>
          </div>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400">{t.callback.finishing}</p>
        )}
      </div>
    </Shell>
  );
}

function Main() {
  const { t } = useI18n();
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
        <div className="card text-sm">{t.signIn.missingKey}</div>
      </Shell>
    );
  }
  if (auth === "loading" || !settings) return <Shell>{null}</Shell>;
  if (auth === "signed-out") return <SignIn />;

  const running = run.status === "running";
  const footer = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        {t.footer.memory(remembered)}
        <button
          className="btn-ghost ml-1 min-h-0 px-1 underline"
          disabled={running}
          onClick={async () => {
            if (!confirm(t.footer.confirmReset)) return;
            await store.setState(emptyState());
            setRemembered(0);
          }}
        >
          {t.footer.reset}
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
        {t.footer.signOut}
      </button>
    </div>
  );

  return (
    <Shell footer={footer}>
      <VersionsCard settings={settings.versions} resolved={versions} disabled={running} onChange={saveVersions} />
      <SyncCard versions={versions} run={run} onRun={startRun} onCancel={() => abort.current?.abort()} />
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
          {busy ? t.signIn.opening : t.signIn.button}
        </button>
      </div>
      <p className="px-1 text-xs text-stone-500">{t.signIn.disclaimer}</p>
    </Shell>
  );
}

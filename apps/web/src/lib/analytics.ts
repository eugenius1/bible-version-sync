/**
 * Usage events, errors and feedback, sent to PostHog. The rules for what may
 * be sent are in docs/analytics.md and the reasons in docs/adr/0001; nothing
 * else in the app imports posthog-js.
 *
 * Cookieless: PostHog stores nothing in the browser. The only thing kept here
 * is the person's own choice on the Privacy page.
 */
import { useSyncExternalStore } from "react";
import type { CaptureResult, PostHog } from "posthog-js/dist/module.no-external";

const KEY: string = import.meta.env.VITE_POSTHOG_KEY ?? "";
/** Every event says which app sent it: the PostHog project is shared with the author's other sites. */
export const APP = "bible-version-sync";
const CHOICE_KEY = "bvs-usage-data";

/** The "Feedback" API survey in PostHog. The ids are public: they're sent with every response. */
export const FEEDBACK_SURVEY = {
  id: "01a20ec4-6651-0000-8db8-74112c2e8674",
  message: { id: "ba9db97d-e34a-46d0-8e22-2927ff1891ac", question: "Your feedback" },
  email: { id: "31d5a820-7f16-449e-916d-ba67251b86d7", question: "Email, if you'd like a reply" },
};

/** Every event the app sends, with its properties. Counts only: see docs/analytics.md. */
export interface Events {
  signed_in: Record<string, never>;
  version_added: { versions: number };
  preview_run: { versions: number; books: number; differences: number; failedBooks: number; stopped: boolean };
  sync_applied: {
    versions: number;
    books: number;
    /** Verses highlighted or recoloured. */
    highlighted: number;
    removed: number;
    failedBooks: number;
    writeErrors: number;
    stopped: boolean;
  };
  sync_failed: { reason: "auth" | "network" | "rateLimited" | "unexpected" };
  app_installed: Record<string, never>;
}

// ── The person's choice ─────────────────────────────────────────────────────

/** Do Not Track or Global Privacy Control: usage data starts off. */
export function privacySignal(nav: Navigator = navigator): boolean {
  return (nav as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true || nav.doNotTrack === "1";
}

function storedChoice(): boolean | null {
  try {
    const v = localStorage.getItem(CHOICE_KEY);
    return v === "on" ? true : v === "off" ? false : null;
  } catch {
    return null;
  }
}

/** Whether usage data and errors may be sent: the person's choice, else on unless the browser asks not to. */
export function usageAllowed(): boolean {
  return storedChoice() ?? !privacySignal();
}

const listeners = new Set<() => void>();

export function setUsageAllowed(on: boolean): void {
  try {
    localStorage.setItem(CHOICE_KEY, on ? "on" : "off");
  } catch {
    // Private mode without storage: the choice lasts until the page closes.
  }
  listeners.forEach((l) => l());
  if (on) startAnalytics();
}

export function useUsageAllowed(): boolean {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, usageAllowed);
}

// ── Scrubbing ───────────────────────────────────────────────────────────────

/**
 * A URL without its query, in the address or in the hash ("#stats?demo"): the
 * sign-in callback's `?code=` must never leave the browser.
 */
export function withoutQuery(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = u.hash.split("?")[0];
    return u.toString();
  } catch {
    return url.split("?")[0];
  }
}

/** An error message without API paths, which carry version ids and chapters ("HTTP 404 on /v1/bibles/111/…"). */
export function withoutPaths(message: string): string {
  return message.replace(/(?:\/[^\s/:?]+)+\/?(?:\?[^\s:]*)?/g, "/…");
}

function scrubUrls(props: Record<string, unknown> | undefined): void {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string" && /^https?:\/\//.test(v)) props[k] = withoutQuery(v);
  }
}

/**
 * PostHog's `before_send`: drops everything but feedback when the person has
 * turned usage data off, and strips queries and API paths from what's left.
 * Also drops the `$set` PostHog sends on every load: there are no person
 * profiles to set, and it would double the event count.
 */
export function scrub(event: CaptureResult | null): CaptureResult | null {
  if (!event || event.event === "$set") return null;
  if (event.event === "survey sent") forgetSurveySeen(event);
  else if (!usageAllowed()) return null;
  scrubUrls(event.properties);
  scrubUrls(event.$set);
  scrubUrls(event.$set_once);
  const list = event.properties.$exception_list as { value?: string }[] | undefined;
  for (const e of list ?? []) if (typeof e.value === "string") e.value = withoutPaths(e.value);
  if (typeof event.properties.$exception_message === "string") {
    event.properties.$exception_message = withoutPaths(event.properties.$exception_message);
  }
  return event;
}

/**
 * While building a survey response, PostHog marks the survey seen in
 * localStorage and on the person, though it never shows surveys here. The app
 * stores nothing for analytics but the person's choice, and keeps no profiles.
 */
function forgetSurveySeen(event: CaptureResult): void {
  delete event.$set;
  try {
    localStorage.removeItem(`seenSurvey_${String(event.properties.$survey_id)}`);
  } catch {
    // No storage, nothing to remove.
  }
}

// ── PostHog ─────────────────────────────────────────────────────────────────

let client: Promise<PostHog | null> | null = null;

/**
 * Loads PostHog on first use, in its own chunk. The no-external build never
 * loads scripts from PostHog, so the Content-Security-Policy keeps
 * `script-src 'self'`; exception capture is bundled for the same reason.
 */
function load(): Promise<PostHog | null> {
  if (!KEY) return Promise.resolve(null);
  client ??= Promise.all([import("posthog-js/dist/module.no-external"), import("posthog-js/dist/exception-autocapture")])
    .then(([{ default: posthog }]) => {
      posthog.init(KEY, {
        api_host: "https://eu.i.posthog.com",
        ui_host: "https://eu.posthog.com",
        defaults: "2026-08-30",
        cookieless_mode: "always",
        persistence: "memory",
        autocapture: false,
        capture_pageview: false, // sent here, on hash changes too
        disable_capture_url_hashes: false, // the hash is the page ("#stats"); scrub() drops its query
        capture_pageleave: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        capture_exceptions: true,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        before_send: scrub,
      });
      posthog.register({ app: APP });
      return posthog;
    })
    .catch(() => {
      client = null; // offline before the chunk was cached: try again next time
      return null;
    });
  return client;
}

let started = false;

/**
 * Starts sending page views, once per page load, when there's a key and the
 * person allows it. The sign-in callback sends none: its address holds the
 * sign-in code, and it's a moment, not a page.
 */
export function startAnalytics({ pageviews = true } = {}): void {
  if (!KEY) {
    if (import.meta.env.DEV) {
      console.warn("VITE_POSTHOG_KEY isn't set, so no usage data, errors or feedback are sent. That's fine for development.");
    }
    return;
  }
  if (started || !usageAllowed()) return;
  started = true;
  void load().then((ph) => {
    if (!ph || !pageviews) return;
    ph.capture("$pageview");
    addEventListener("hashchange", () => ph.capture("$pageview"));
  });
}

/** Sends a usage event if the person allows it. Resolves once it's queued. */
export async function track<E extends keyof Events>(event: E, ...props: Events[E] extends Record<string, never> ? [] : [Events[E]]): Promise<void> {
  if (!usageAllowed()) return;
  (await load())?.capture(event, props[0]);
}

/**
 * Sends a usage event from a page about to navigate away, straight away by
 * beacon, waiting at most `ms` so analytics never holds the person up.
 */
export async function trackBeforeLeaving(event: "signed_in", ms = 1000): Promise<void> {
  if (!usageAllowed()) return;
  const send = load().then((ph) => void ph?.capture(event, undefined, { send_instantly: true, transport: "sendBeacon" }));
  await Promise.race([send, new Promise((resolve) => setTimeout(resolve, ms))]);
}

/** Reports an error the app caught and showed, which PostHog wouldn't see otherwise. */
export async function trackError(error: unknown): Promise<void> {
  if (!usageAllowed()) return;
  (await load())?.captureException(error);
}

/** Sends feedback as a response to the Feedback survey. False when it couldn't be sent. */
export async function sendFeedback(message: string, email: string): Promise<boolean> {
  const ph = await load();
  if (!ph) return false;
  const { id, message: m, email: e } = FEEDBACK_SURVEY;
  ph.capture("survey sent", {
    $survey_id: id,
    $survey_questions: [
      { id: m.id, question: m.question },
      { id: e.id, question: e.question },
    ],
    [`$survey_response_${m.id}`]: message,
    ...(email && { [`$survey_response_${e.id}`]: email }),
    $survey_completed: true,
  });
  return true;
}

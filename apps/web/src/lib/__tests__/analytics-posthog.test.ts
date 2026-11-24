/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** PostHog as the app drives it, recorded instead of sent. */
const posthog = { init: vi.fn(), register: vi.fn(), capture: vi.fn(), captureException: vi.fn() };
vi.mock("posthog-js/dist/module.no-external", () => ({ default: posthog }));
vi.mock("posthog-js/dist/exception-autocapture", () => ({}));

/** A fresh module with a key: it reads the key, and keeps its client, once per load. */
async function analytics() {
  vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
  vi.resetModules();
  return import("../analytics");
}

beforeEach(() => Object.values(posthog).forEach((f) => f.mockReset()));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("with a PostHog key", () => {
  it("starts PostHog cookieless, in the EU, with only the events the app names", async () => {
    const { track, APP } = await analytics();
    await track("signed_in");
    const [key, config] = posthog.init.mock.calls[0];
    expect(key).toBe("phc_test");
    expect(config).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      cookieless_mode: "always",
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_external_dependency_loading: true,
      capture_exceptions: true,
      // No click ids (?gclid=…) or utm_* copied from the landing address.
      save_campaign_params: false,
    });
    expect(posthog.register).toHaveBeenCalledWith({ app: APP });
    expect(posthog.capture).toHaveBeenCalledWith("signed_in", undefined);
  });

  it("sends a page view on start and on each hash change, once per page load", async () => {
    const { startAnalytics } = await analytics();
    startAnalytics();
    startAnalytics();
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalledTimes(1));
    dispatchEvent(new HashChangeEvent("hashchange"));
    expect(posthog.capture.mock.calls.map(([e]) => e)).toEqual(["$pageview", "$pageview"]);
  });

  it("sends no page views where asked not to (the sign-in callback)", async () => {
    const { startAnalytics, track } = await analytics();
    startAnalytics({ pageviews: false });
    await track("signed_in");
    expect(posthog.capture.mock.calls.map(([e]) => e)).toEqual(["signed_in"]);
  });

  it("sends nothing once usage data is off, but still lets feedback through", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const { setUsageAllowed, startAnalytics, track, trackError, trackBeforeLeaving, sendFeedback } = await analytics();
    setUsageAllowed(false);
    startAnalytics();
    await track("app_installed");
    await trackError(new Error("x"));
    await trackBeforeLeaving("signed_in");
    expect(posthog.init).not.toHaveBeenCalled();
    await expect(sendFeedback("Hi", "")).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("sends feedback to the Feedback survey, with the email only when given, and nothing stored", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    history.replaceState(null, "", "/callback?code=secret#feedback");
    const { sendFeedback, FEEDBACK_SURVEY: s, APP } = await analytics();
    await sendFeedback("Love it", "");
    await sendFeedback("Broken", "me@example.test");
    const [[url, init], [, init2]] = fetch.mock.calls as [string, RequestInit][];
    expect(url).toBe("https://eu.i.posthog.com/i/v0/e/");
    const first = JSON.parse(init.body as string);
    const second = JSON.parse(init2.body as string);
    expect(first).toMatchObject({ api_key: "phc_test", event: "survey sent" });
    expect(first.distinct_id).not.toBe(second.distinct_id);
    expect(first.properties).toMatchObject({
      app: APP,
      $current_url: "http://localhost:3000/callback#feedback",
      $process_person_profile: false,
      $survey_id: s.id,
      [`$survey_response_${s.message.id}`]: "Love it",
      $survey_completed: true,
    });
    expect(first.properties).not.toHaveProperty(`$survey_response_${s.email.id}`);
    expect(second.properties).toMatchObject({ [`$survey_response_${s.email.id}`]: "me@example.test" });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(Object.keys(localStorage)).toEqual([]);
  });

  it("says feedback wasn't sent when PostHog refuses it or the request is blocked", async () => {
    const { sendFeedback } = await analytics();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 400 })));
    await expect(sendFeedback("Hi", "")).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(sendFeedback("Hi", "")).resolves.toBe(false);
  });

  it("reports caught errors, and sends sign-in straight away before leaving the page", async () => {
    const { trackError, trackBeforeLeaving } = await analytics();
    const error = new Error("boom");
    await trackError(error);
    await trackBeforeLeaving("signed_in");
    expect(posthog.captureException).toHaveBeenCalledWith(error);
    expect(posthog.capture).toHaveBeenCalledWith("signed_in", undefined, { send_instantly: true, transport: "sendBeacon" });
  });

  it("doesn't hold up leaving the page when PostHog is slow to load", async () => {
    vi.useFakeTimers();
    // PostHog's chunk never finishes loading.
    vi.doMock("posthog-js/dist/module.no-external", () => new Promise(() => {}));
    const { trackBeforeLeaving } = await analytics();
    let finished = false;
    void trackBeforeLeaving("signed_in", 1000).then(() => (finished = true));
    await vi.advanceTimersByTimeAsync(999);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(finished).toBe(true);
    expect(posthog.capture).not.toHaveBeenCalled();
    vi.doMock("posthog-js/dist/module.no-external", () => ({ default: posthog }));
    vi.useRealTimers();
  });
});

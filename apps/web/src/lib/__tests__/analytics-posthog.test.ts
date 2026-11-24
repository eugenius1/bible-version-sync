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
afterEach(() => vi.unstubAllEnvs());

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

  it("sends nothing but feedback once usage data is off", async () => {
    const { setUsageAllowed, startAnalytics, track, trackError, trackBeforeLeaving, sendFeedback } = await analytics();
    setUsageAllowed(false);
    startAnalytics();
    await track("app_installed");
    await trackError(new Error("x"));
    await trackBeforeLeaving("signed_in");
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.captureException).not.toHaveBeenCalled();
    await expect(sendFeedback("Hi", "")).resolves.toBe(true);
    expect(posthog.capture).toHaveBeenCalledWith("survey sent", expect.anything());
  });

  it("sends feedback as a response to the Feedback survey, with the email only when given", async () => {
    const { sendFeedback, FEEDBACK_SURVEY: s } = await analytics();
    await sendFeedback("Love it", "");
    await sendFeedback("Broken", "me@example.test");
    const [[, first], [, second]] = posthog.capture.mock.calls;
    expect(first).toMatchObject({ $survey_id: s.id, [`$survey_response_${s.message.id}`]: "Love it", $survey_completed: true });
    expect(first).not.toHaveProperty(`$survey_response_${s.email.id}`);
    expect(second).toMatchObject({ [`$survey_response_${s.email.id}`]: "me@example.test" });
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
    const { trackBeforeLeaving } = await analytics();
    posthog.init.mockImplementation(() => new Promise(() => {}));
    const done = trackBeforeLeaving("signed_in", 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(done).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

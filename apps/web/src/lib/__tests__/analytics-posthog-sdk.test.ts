/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  history.replaceState(null, "", "/");
});

describe("with the real PostHog SDK", () => {
  it("copies no click ids or utm_* from the landing address into events", async () => {
    history.replaceState(
      null,
      "",
      "/?gclid=abc123&fbclid=def456&utm_source=ads&utm_campaign=spring#stats",
    );
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.resetModules();
    // No real requests: the SDK's own network call is blocked.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    const { track } = await import("../analytics");
    const { default: posthog } =
      await import("posthog-js/dist/module.no-external");
    const sent: Record<string, unknown>[] = [];
    posthog.on("eventCaptured", (e: { properties: Record<string, unknown> }) =>
      sent.push(e.properties),
    );

    await track("signed_in");

    expect(sent.length).toBeGreaterThan(0);
    for (const properties of sent) {
      expect(
        Object.keys(properties).filter((k) => /gclid|fbclid|utm_/.test(k)),
      ).toEqual([]);
      expect(JSON.stringify(properties)).not.toMatch(
        /abc123|def456|utm_source=|spring/,
      );
    }
  });
});

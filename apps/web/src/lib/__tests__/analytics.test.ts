/** @vitest-environment jsdom */

import type { CaptureResult } from "posthog-js/dist/module.no-external";
import { afterEach, describe, expect, it, vi } from "vitest";
import { privacySignal, scrub, sendFeedback, setUsageAllowed, track, usageAllowed, withoutPaths, withoutQuery } from "../analytics";

const event = (name: string, properties: Record<string, unknown>): CaptureResult =>
  ({ uuid: "1", event: name, properties }) as CaptureResult;

afterEach(() => vi.unstubAllGlobals());

describe("withoutQuery", () => {
  it("drops the sign-in code from the callback address", () => {
    expect(withoutQuery("https://eusebius.tech/bible-version-sync/callback?code=secret&state=x")).toBe(
      "https://eusebius.tech/bible-version-sync/callback",
    );
  });

  it("keeps the page in the hash but not its query", () => {
    expect(withoutQuery("https://eusebius.tech/app/#stats?demo")).toBe("https://eusebius.tech/app/#stats");
  });
});

describe("withoutPaths", () => {
  it("drops API paths, which name versions and chapters", () => {
    expect(withoutPaths("HTTP 404 on /v1/bibles/111/passages/JHN.3: not found")).toBe("HTTP 404 on /…: not found");
    expect(withoutPaths("HTTP 0 on /auth/token?code=secret: offline")).toBe("HTTP 0 on /…: offline");
  });

  it("keeps the rest of a message, question marks included", () => {
    expect(withoutPaths("Unexpected token ? in JSON at position 4")).toBe("Unexpected token ? in JSON at position 4");
  });
});

describe("scrub", () => {
  it("strips queries from every URL property", () => {
    const e = scrub(event("$pageview", { $current_url: "https://x.test/callback?code=1", $referrer: "https://a.test/?q=2", n: 3 }));
    expect(e?.properties).toEqual({ $current_url: "https://x.test/callback", $referrer: "https://a.test/", n: 3 });
  });

  it("strips API paths from error messages", () => {
    const e = scrub(event("$exception", { $exception_list: [{ type: "ApiError", value: "HTTP 500 on /v1/bibles/1/passages/GEN.1: boom" }] }));
    expect(e?.properties.$exception_list).toEqual([{ type: "ApiError", value: "HTTP 500 on /…: boom" }]);
  });

  it("drops the person-profile update PostHog sends on every load", () => {
    expect(scrub(event("$set", {}))).toBeNull();
  });

  it("drops everything once usage data is turned off", () => {
    setUsageAllowed(false);
    expect(scrub(event("$exception", {}))).toBeNull();
    expect(scrub(event("sync_applied", {}))).toBeNull();
  });
});

describe("the person's choice", () => {
  it("is on by default", () => {
    expect(usageAllowed()).toBe(true);
  });

  it("starts off when the browser asks not to be tracked", () => {
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    expect(privacySignal()).toBe(true);
    expect(usageAllowed()).toBe(false);
  });

  it("wins over the browser's signal once made", () => {
    vi.stubGlobal("navigator", { ...navigator, doNotTrack: "1" });
    setUsageAllowed(true);
    expect(usageAllowed()).toBe(true);
  });
});

describe("without a PostHog key", () => {
  it("sends nothing and says feedback couldn't be sent", async () => {
    await expect(track("signed_in")).resolves.toBeUndefined();
    await expect(sendFeedback("Hello", "")).resolves.toBe(false);
  });
});

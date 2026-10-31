/** @vitest-environment jsdom */

import type { RunSummary } from "@bvs/core";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n";
import { isIosSafari, listenForInstall, resetInstall } from "../../lib/install";
import { Results } from "../Results";

// The IndexedDB key-value store, in memory; it outlives a render the way it outlives a reload.
const kv = new Map<string, unknown>();
vi.mock("../../lib/db", async (actual) => ({
  ...(await actual<typeof import("../../lib/db")>()),
  store: {
    getInstallOffered: async () => kv.get("installOffered") === true,
    setInstallOffered: async () => void kv.set("installOffered", true),
  },
}));

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  books: [],
  sets: 3,
  removals: 0,
  differences: 0,
  failedBooks: 0,
  blockedBooks: 0,
  writeErrors: 0,
  aborted: false,
  refused: [],
  ...over,
});

const renderResults = (apply = true, s = summary()) =>
  render(
    <I18nProvider>
      <Results
        run={{ status: "done", apply, scope: { kind: "books", books: ["ROM"] }, summary: s }}
        names={new Map()}
        onApply={vi.fn()}
        onApplyAllowingRemovals={vi.fn()}
        onSignInAgain={vi.fn()}
      />
    </I18nProvider>,
  );

// One window for the whole file, so the listeners are added once, as at startup.
listenForInstall(window);

/** Fires Chromium's install event, as it would long before the sync ends. */
function installable() {
  const prompt = vi.fn(async () => undefined);
  const e = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  act(() => void window.dispatchEvent(e));
  return { prompt, event: e };
}

function standalone(matches: boolean) {
  window.matchMedia = ((query: string) => ({ matches: matches && query === "(display-mode: standalone)" })) as typeof window.matchMedia;
}

const banner = () => screen.queryByRole("region", { name: "Keep it on your home screen" });

beforeEach(() => {
  kv.clear();
  standalone(false);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ANDROID_CHROME);
});

afterEach(() => {
  resetInstall();
  vi.restoreAllMocks();
});

describe("InstallBanner", () => {
  it("offers Chromium's install dialog after a finished sync, from the event kept at startup", async () => {
    const { prompt, event } = installable();
    expect(event.defaultPrevented).toBe(true);
    renderResults();
    expect(await screen.findByRole("region", { name: "Keep it on your home screen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(banner()).not.toBeInTheDocument();
  });

  it("isn't shown after a preview, a sync with nothing to write, or one that stopped or failed", async () => {
    installable();
    for (const [apply, s] of [
      [false, summary()],
      [true, summary({ sets: 0 })],
      [true, summary({ aborted: true })],
      [true, summary({ failedBooks: 1 })],
      [true, summary({ writeErrors: 2 })],
      [true, summary({ fatal: { reason: "network", message: "Failed to fetch" } })],
    ] as const) {
      const { unmount } = renderResults(apply, s);
      await act(async () => undefined);
      expect(banner()).not.toBeInTheDocument();
      unmount();
    }
    // None of them used up the one chance.
    expect(kv.has("installOffered")).toBe(false);
  });

  it("isn't shown when the app is already installed", async () => {
    standalone(true);
    installable();
    renderResults();
    await act(async () => undefined);
    expect(banner()).not.toBeInTheDocument();
  });

  it("isn't shown without a way to install", async () => {
    renderResults();
    await act(async () => undefined);
    expect(banner()).not.toBeInTheDocument();
  });

  it("is offered once: dismissed, it stays gone after a reload", async () => {
    installable();
    const first = renderResults();
    await screen.findByRole("region", { name: "Keep it on your home screen" });
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(banner()).not.toBeInTheDocument();
    first.unmount();

    renderResults();
    await act(async () => undefined);
    expect(banner()).not.toBeInTheDocument();
  });

  it("counts installing from the browser's own menu as the offer seen", async () => {
    installable();
    act(() => void window.dispatchEvent(new Event("appinstalled")));
    await act(async () => undefined);
    expect(kv.get("installOffered")).toBe(true);
  });

  it("gives the Share hint in iPhone Safari, which has no install event", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_SAFARI);
    renderResults();
    expect(await screen.findByText(/then “Add to Home Screen”/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("gives no hint in other iPhone browsers", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_CHROME);
    renderResults();
    await act(async () => undefined);
    expect(banner()).not.toBeInTheDocument();
  });
});

describe("isIosSafari", () => {
  it("knows iPadOS Safari by its touch points, since it reports a Mac", () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_SAFARI, 0)).toBe(false);
    expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME, 5)).toBe(false);
  });
});

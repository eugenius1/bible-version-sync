import { afterEach, describe, expect, it, vi } from "vitest";
import { isTheme, resolveTheme, systemTheme, THEMES, watchSystemTheme } from "../theme";

/** Stand in for matchMedia, reporting a fixed preference that can be flipped. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: prefersDark,
      addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    })),
  );
  return {
    listenerCount: () => listeners.size,
    flip: (dark: boolean) => listeners.forEach((fn) => fn({ matches: dark } as MediaQueryListEvent)),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("theme resolution", () => {
  it("defaults to following the system", () => {
    expect(THEMES[0]).toBe("system");
  });

  it("resolves system to whatever the device reports", () => {
    stubMatchMedia(true);
    expect(systemTheme()).toBe("dark");
    expect(resolveTheme("system")).toBe("dark");
    stubMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("lets an explicit choice override the system", () => {
    stubMatchMedia(true);
    expect(resolveTheme("light")).toBe("light");
    stubMatchMedia(false);
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("falls back to light where matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolveTheme("system")).toBe("light");
  });

  it("rejects unknown stored values", () => {
    expect(isTheme("system")).toBe(true);
    expect(isTheme("solarized")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });
});

describe("following the system over time", () => {
  it("reports a change when the device preference flips, and unsubscribes", () => {
    const media = stubMatchMedia(false);
    const seen: string[] = [];
    const stop = watchSystemTheme((r) => seen.push(r));
    media.flip(true);
    media.flip(false);
    expect(seen).toEqual(["dark", "light"]);
    stop();
    expect(media.listenerCount()).toBe(0);
  });

  it("unsubscribes cleanly where matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => watchSystemTheme(() => {})()).not.toThrow();
  });
});

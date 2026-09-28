/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, LANG_STORAGE_KEY } from "../../i18n";
import { THEME_STORAGE_KEY } from "../../theme";
import { LanguageSwitcher, ThemeSwitcher } from "../Pickers";

/**
 * jsdom has no matchMedia, and a real one can't be told to change its mind.
 * This stands in for both and can flip the system preference.
 */
function stubMatchMedia(prefersDark: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = prefersDark;
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return matches;
    },
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  }));
  return {
    flip(dark: boolean) {
      matches = dark;
      listeners.forEach((fn) => fn({ matches: dark } as MediaQueryListEvent));
    },
    listenerCount: () => listeners.size,
  };
}

function renderPickers() {
  return render(
    <I18nProvider>
      <LanguageSwitcher />
      <ThemeSwitcher />
    </I18nProvider>,
  );
}

const isDark = () => document.documentElement.classList.contains("dark");

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-GB"]);
});

describe("ThemeSwitcher", () => {
  it("defaults to following the system, without storing a choice", async () => {
    stubMatchMedia(true);
    renderPickers();
    await waitFor(() => expect(isDark()).toBe(true));
    expect(screen.getByLabelText("Appearance")).toHaveValue("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("keeps following after load when the system preference changes", async () => {
    const media = stubMatchMedia(false);
    renderPickers();
    await waitFor(() => expect(isDark()).toBe(false));
    media.flip(true);
    await waitFor(() => expect(isDark()).toBe(true));
    media.flip(false);
    await waitFor(() => expect(isDark()).toBe(false));
  });

  it("lets an explicit choice override the system, and remembers it", async () => {
    stubMatchMedia(false);
    renderPickers();
    await userEvent.selectOptions(screen.getByLabelText("Appearance"), "dark");
    await waitFor(() => expect(isDark()).toBe(true));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("stops following the system once a choice is made", async () => {
    const media = stubMatchMedia(false);
    renderPickers();
    await userEvent.selectOptions(screen.getByLabelText("Appearance"), "light");
    await waitFor(() => expect(media.listenerCount()).toBe(0));
    media.flip(true);
    expect(isDark()).toBe(false);
  });

  it("picks up a stored choice on load", async () => {
    stubMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderPickers();
    await waitFor(() => expect(isDark()).toBe(true));
    expect(screen.getByLabelText("Appearance")).toHaveValue("dark");
  });
});

describe("LanguageSwitcher", () => {
  it("starts from the device language", () => {
    stubMatchMedia(false);
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-CA", "en"]);
    renderPickers();
    expect(screen.getByLabelText("Langue")).toHaveValue("fr");
  });

  it("switches language, translates the other controls and updates <html lang>", async () => {
    stubMatchMedia(false);
    renderPickers();
    expect(screen.getByLabelText("Appearance")).toHaveTextContent("System");

    await userEvent.selectOptions(screen.getByLabelText("Language"), "fr");

    await waitFor(() => expect(screen.getByLabelText("Apparence")).toHaveTextContent("Système"));
    expect(document.documentElement.lang).toBe("fr");
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("fr");
  });

  it("lists each language in its own name", () => {
    stubMatchMedia(false);
    renderPickers();
    const names = [...(screen.getByLabelText("Language") as HTMLSelectElement).options].map((o) => o.textContent);
    expect(names).toEqual(["English", "Français"]);
  });
});

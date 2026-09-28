/**
 * Light/dark handling.
 *
 * Three states, not two: `system` follows the device and is the default, while
 * `light` and `dark` are explicit overrides. Following the system has to keep
 * working when the system changes (e.g. at sundown); an app that reads the
 * preference once gets stuck.
 *
 * public/theme-init.js mirrors resolveTheme() so the right palette is in place
 * before first paint. It's a separate file rather than an inline script because
 * the production Content-Security-Policy doesn't allow inline scripts.
 */

export type Theme = "system" | "light" | "dark";
export const THEMES: Theme[] = ["system", "light", "dark"];

/** What `system` currently resolves to. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "bible-version-sync.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Browser toolbar colour per theme: the page background (stone-50 / stone-950). */
export const THEME_COLORS: Record<ResolvedTheme, string> = { light: "#fafaf9", dark: "#0c0a09" };

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as string[]).includes(value);
}

export function storedTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    // Private windows and blocked site data throw on access.
    return null;
  }
}

export function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}

export function systemTheme(): ResolvedTheme {
  return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

/**
 * Put the resolved theme on the root element. The stylesheet keys its dark
 * palette off `.dark`, which also sets `color-scheme` so native controls
 * (selects, scrollbars) follow the choice rather than the system.
 */
export function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
  return resolved;
}

/**
 * Call `onChange` whenever the system preference flips. Returns an unsubscribe
 * function. Only meaningful while the theme is `system`.
 */
export function watchSystemTheme(onChange: (resolved: ResolvedTheme) => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(DARK_QUERY);
  const handler = (e: MediaQueryListEvent) => onChange(e.matches ? "dark" : "light");
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
}

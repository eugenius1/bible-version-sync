import { ChevronDown, Contrast, Globe, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { DICTIONARIES, LANGUAGES, useI18n, type Lang } from "../i18n";
import { applyTheme, persistTheme, storedTheme, THEMES, watchSystemTheme, type Theme } from "../theme";

/**
 * Both pickers are native <select>s dressed as pills: they get keyboard
 * handling, screen-reader semantics and the platform's own picker on mobile
 * for free, and stay usable as more languages are added.
 */

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="picker">
      <Globe className="shrink-0" size={13} aria-hidden />
      <select
        className="picker-select"
        aria-label={t.app.languageLabel}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        {LANGUAGES.map((code) => (
          <option key={code} value={code} lang={DICTIONARIES[code].meta.localeTag}>
            {DICTIONARIES[code].meta.name}
          </option>
        ))}
      </select>
      <ChevronDown className="shrink-0" size={13} aria-hidden />
    </div>
  );
}

/**
 * Light/dark override. Defaults to `system` and keeps following the system
 * while it stays there.
 */
export function ThemeSwitcher() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? "system");

  useEffect(() => {
    applyTheme(theme);
    // Only worth listening while we're actually deferring to the system.
    if (theme !== "system") return;
    return watchSystemTheme(() => applyTheme("system"));
  }, [theme]);

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Contrast;
  return (
    <div className="picker">
      {/* A half-filled circle for "follow the system": the choice between
          light and dark rather than either one. */}
      <Icon className="shrink-0" size={13} aria-hidden />
      <select
        className="picker-select"
        aria-label={t.app.themeLabel}
        value={theme}
        onChange={(e) => {
          const next = e.target.value as Theme;
          setTheme(next);
          persistTheme(next);
        }}
      >
        {THEMES.map((option) => (
          <option key={option} value={option}>
            {t.themes[option]}
          </option>
        ))}
      </select>
      <ChevronDown className="shrink-0" size={13} aria-hidden />
    </div>
  );
}

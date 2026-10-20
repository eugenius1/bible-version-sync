import { Contrast, Globe, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";
import { DICTIONARIES, menuOrder, useI18n, type Lang } from "../i18n";
import { applyTheme, persistTheme, storedTheme, THEMES, watchSystemTheme, type Theme } from "../theme";

/**
 * Both pickers are native <select>s laid invisibly over an icon: they get
 * keyboard handling, screen-reader semantics and the platform's own picker on
 * mobile for free, and stay usable as more languages are added, while taking
 * no more room in the header than an icon.
 */

/**
 * Tags a select opened by pointer so the stylesheet can leave its focus ring
 * off: the select keeps focus once its picker closes, and Chromium counts a
 * focused select as :focus-visible however it got there. The next key press
 * is keyboard use again, so the ring comes back.
 */
const markPointer = (e: SyntheticEvent<HTMLSelectElement>) => {
  e.currentTarget.dataset.pointer = "";
};
const clearPointer = (e: SyntheticEvent<HTMLSelectElement>) => {
  delete e.currentTarget.dataset.pointer;
};
const pointerFocus = { onPointerDown: markPointer, onKeyDown: clearPointer, onBlur: clearPointer };

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const { pinned, rest } = useMemo(() => menuOrder(), []);
  // Each name in its own language, whatever the page is in.
  const option = (code: Lang) => (
    <option key={code} value={code} lang={DICTIONARIES[code].meta.localeTag}>
      {DICTIONARIES[code].meta.name}
    </option>
  );
  return (
    <div className="picker" title={`${t.app.languageLabel}: ${DICTIONARIES[lang].meta.name}`}>
      <Globe size={18} aria-hidden />
      <select
        className="picker-select"
        aria-label={t.app.languageLabel}
        {...pointerFocus}
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
      >
        {pinned.map(option)}
        {/* Drawn as a divider where the browser supports <hr> in a <select>, skipped elsewhere. */}
        <hr />
        {rest.map(option)}
      </select>
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
    <div className="picker" title={`${t.app.themeLabel}: ${t.themes[theme]}`}>
      {/* A half-filled circle for "follow the system": the choice between
          light and dark rather than either one. */}
      <Icon size={18} aria-hidden />
      <select
        className="picker-select"
        aria-label={t.app.themeLabel}
        {...pointerFocus}
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
    </div>
  );
}

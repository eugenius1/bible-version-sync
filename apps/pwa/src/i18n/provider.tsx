import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyDocumentLanguage, createI18n, detectLanguage, isLang, type I18n, type Lang } from "./core";

export const LANG_STORAGE_KEY = "bible-version-sync.lang";

/** A language the reader chose explicitly, which outranks the device default. */
function storedLanguage(): Lang | null {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(raw) ? raw : null;
  } catch {
    // Private windows and blocked site data throw on access.
    return null;
  }
}

function persistLanguage(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Not being able to remember the choice is not worth failing over.
  }
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => storedLanguage() ?? detectLanguage());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    persistLanguage(next);
  }, []);

  useEffect(() => applyDocumentLanguage(lang), [lang]);

  const value = useMemo(() => createI18n(lang, setLang), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

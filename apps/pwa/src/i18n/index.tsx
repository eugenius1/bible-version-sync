import { bookName, displayRef, type Lang } from "@bvs/core";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { en, type Messages } from "./en";
import { fr } from "./fr";

export type { Lang };
export const LANGS: Record<Lang, Messages> = { en, fr };

const KEY = "bvs.lang";

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" || v === "fr" ? v : null;
  } catch {
    return null;
  }
}

/** The saved choice, else the browser's preferred language, else English. */
export function detectLang(): Lang {
  const saved = stored();
  if (saved) return saved;
  for (const l of navigator.languages ?? [navigator.language]) {
    const base = l.toLowerCase().split("-")[0];
    if (base === "fr" || base === "en") return base;
  }
  return "en";
}

interface I18n {
  lang: Lang;
  t: Messages;
  setLang: (l: Lang) => void;
  book: (code: string) => string;
  ref: (r: string) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // private mode etc.; the choice just won't persist
    }
    setLangState(l);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      t: LANGS[lang],
      setLang,
      book: (code) => bookName(code, lang),
      ref: (r) => displayRef(r, lang),
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}

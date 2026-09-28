/**
 * The translation core, free of React, so the formatting rules can be tested
 * directly.
 */
import { bookName, displayRef } from "@bvs/core";
import { en, type Dictionary } from "./en";
import { fr } from "./fr";

export type Lang = "en" | "fr";

export const DICTIONARIES: Record<Lang, Dictionary> = { en, fr };
export const LANGUAGES = Object.keys(DICTIONARIES) as Lang[];

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGUAGES as string[]).includes(value);
}

/**
 * Pick a language from the device's preferences, in order: a reader set up as
 * [de, fr, en] gets French. Region subtags are ignored (fr-CA means French).
 */
export function detectLanguage(
  preferred: readonly string[] = typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language],
): Lang {
  for (const tag of preferred) {
    const base = tag?.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

export type Params = Record<string, string | number>;

/** Substitute `{name}` placeholders; unknown ones are left as they are. */
export function interpolate(template: string, params: Params = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in params ? String(params[key]) : whole));
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** The active dictionary: `t.sync.title`. */
  t: Dictionary;
  /** Fill a template: `f(t.versions.remove, { abbr })`. */
  f: (template: string, params?: Params) => string;
  /**
   * Pick the plural form for `n` and fill it (`{n}` is the formatted count).
   * Uses Intl.PluralRules: French treats 0 as singular, English doesn't.
   */
  plural: (forms: readonly string[], n: number, params?: Params) => string;
  /** Format a number for the locale (thousands separators). */
  num: (value: number) => string;
  /** Book name in the active language: GEN -> Genesis / Genèse. */
  book: (code: string) => string;
  /** "PSA.51.3" -> "Psalms 51:3" / "Psaumes 51:3". */
  ref: (ref: string) => string;
}

export function createI18n(lang: Lang, setLang: (lang: Lang) => void = () => {}): I18n {
  const t = DICTIONARIES[lang];
  const pluralRules = new Intl.PluralRules(t.meta.localeTag);
  const numberFormat = new Intl.NumberFormat(t.meta.localeTag);
  return {
    lang,
    setLang,
    t,
    f: interpolate,
    plural: (forms, n, params) => {
      // Dictionaries carry [singular, plural]; map the CLDR category onto it.
      const form = pluralRules.select(n) === "one" ? forms[0] : forms[forms.length - 1];
      return interpolate(form, { n: numberFormat.format(n), ...params });
    },
    num: (v) => numberFormat.format(v),
    book: (code) => bookName(code, lang),
    ref: (r) => displayRef(r, lang),
  };
}

/** Keep <html lang> in step, so screen readers and hyphenation follow. */
export function applyDocumentLanguage(lang: Lang): void {
  if (typeof document !== "undefined") document.documentElement.lang = DICTIONARIES[lang].meta.localeTag;
}

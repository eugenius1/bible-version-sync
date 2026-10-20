/**
 * The translation core, free of React, so the formatting rules can be tested
 * directly.
 */
import { bookName, displayRef, type Lang as BookLang } from "@bvs/core";
import { de } from "./de";
import { en, type Dictionary } from "./en";
import { enGB } from "./en-gb";
import { es } from "./es";
import { fr } from "./fr";
import { id } from "./id";
import { pt } from "./pt";
import { ru } from "./ru";
import { sw } from "./sw";

/** A language the app is in. British English shares its book names with American. */
export type Lang = BookLang | "en-GB";

export const DICTIONARIES: Record<Lang, Dictionary> = { en, "en-GB": enGB, es, pt, fr, id, sw, de, ru };
export const LANGUAGES = Object.keys(DICTIONARIES) as Lang[];

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGUAGES as string[]).includes(value);
}

/**
 * Where English is written with British spelling: the UK and Ireland, and the
 * Commonwealth countries whose schools teach it. Canada mixes the two, so it
 * stays with American.
 */
const BRITISH_REGIONS = new Set(
  ["gb", "ie", "au", "nz", "za", "in", "pk", "ng", "gh", "ke", "ug", "tz", "zw", "zm", "mw", "jm", "sg", "my", "hk"],
);

/**
 * The language for one tag the browser sent, if the app has it. Other region
 * subtags are ignored (fr-CA means French).
 */
export function forTag(tag: string): Lang | undefined {
  const [base, ...subtags] = (tag ?? "").toLowerCase().split("-");
  // A script may come before the region: en-Latn-GB.
  if (base === "en" && subtags.some((s) => BRITISH_REGIONS.has(s))) return "en-GB";
  return isLang(base) ? base : undefined;
}

/**
 * Pick a language from the device's preferences, in order: a reader set up as
 * [ja, fr, en] gets French.
 */
export function detectLanguage(preferred: readonly string[] = browserLanguages()): Lang {
  for (const tag of preferred) {
    const lang = forTag(tag);
    if (lang) return lang;
  }
  return "en";
}

// One fixed collation, so the list is in the same order for every reader:
// Latin-script names first, then the others.
const byName = new Intl.Collator("en");

/**
 * The languages in the order the picker offers them, as in
 * concurrent-counter-next: English first, as the way out for someone landed
 * in a language they can't read; then the reader's own languages, most
 * preferred first; then the rest by their own names.
 */
export function menuOrder(preferred: readonly string[] = browserLanguages()): { pinned: Lang[]; rest: Lang[] } {
  const langs = preferred.map(forTag).filter((l): l is Lang => !!l);
  // The reader's own English leads, if they have one.
  const pinned: Lang[] = [langs.find((l) => l === "en" || l === "en-GB") ?? "en"];
  for (const lang of langs) if (!pinned.includes(lang)) pinned.push(lang);
  const rest = LANGUAGES.filter((l) => !pinned.includes(l)).sort((a, b) =>
    byName.compare(DICTIONARIES[a].meta.name, DICTIONARIES[b].meta.name),
  );
  return { pinned, rest };
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
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
   * Forms are [one, other], or [one, few, many] where a language has three
   * (Russian: 1 стих, 2 стиха, 5 стихов).
   */
  plural: (forms: readonly string[], n: number, params?: Params) => string;
  /** Format a number for the locale (thousands separators). */
  num: (value: number) => string;
  /**
   * A rough length of time, in the locale's own units: "45 seconds",
   * "3 minutes", "1.5 hours". Rounded, since it's always an estimate.
   */
  duration: (ms: number) => string;
  /** Book name in the active language: GEN -> Genesis / Genèse. */
  book: (code: string) => string;
  /** "PSA.51.3" -> "Psalms 51:3" / "Psaumes 51:3". */
  ref: (ref: string) => string;
}

export function createI18n(lang: Lang, setLang: (lang: Lang) => void = () => {}): I18n {
  const t = DICTIONARIES[lang];
  const books: BookLang = lang === "en-GB" ? "en" : lang;
  const pluralRules = new Intl.PluralRules(t.meta.localeTag);
  const numberFormat = new Intl.NumberFormat(t.meta.localeTag);
  return {
    lang,
    setLang,
    t,
    f: interpolate,
    plural: (forms, n, params) => {
      // Map the CLDR category onto the forms the dictionary carries.
      const category = pluralRules.select(n);
      const form =
        category === "one" ? forms[0]
        : category === "few" && forms.length > 2 ? forms[1]
        : forms[forms.length - 1];
      return interpolate(form, { n: numberFormat.format(n), ...params });
    },
    num: (v) => numberFormat.format(v),
    duration: (ms) => formatDuration(t.meta.localeTag, ms),
    book: (code) => bookName(code, books),
    ref: (r) => displayRef(r, books),
  };
}

/**
 * Seconds to the nearest five under a minute and a half, then minutes, then
 * hours to one decimal. Rounding up for the seconds, so "0 seconds" never
 * shows while something is still running.
 */
export function formatDuration(localeTag: string, ms: number): string {
  const s = ms / 1000;
  const [value, unit, digits] =
    s < 90 ? [Math.max(5, Math.ceil(s / 5) * 5), "second", 0]
    : s < 90 * 60 ? [Math.round(s / 60), "minute", 0]
    : [s / 3600, "hour", 1];
  return new Intl.NumberFormat(localeTag, { style: "unit", unit, unitDisplay: "long", maximumFractionDigits: digits }).format(value);
}

/** Keep <html lang> in step, so screen readers and hyphenation follow. */
export function applyDocumentLanguage(lang: Lang): void {
  if (typeof document !== "undefined") document.documentElement.lang = DICTIONARIES[lang].meta.localeTag;
}

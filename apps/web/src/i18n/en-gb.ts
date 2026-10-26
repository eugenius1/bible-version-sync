import { en, type Dictionary } from "./en";

/**
 * Words spelled differently in British English. Placeholders like {color} are
 * left alone. None of the strings has an -ize word yet; the rule is there so a
 * new one ("synchronize", "organization") is respelled too. Size, resize,
 * prize and seize aren't -ize words, so they keep their spelling.
 */
const SPELLINGS: [RegExp, string][] = [
  [/(?<!\{)\b([Rr]e)?([Cc])olor/g, "$1$2olour"],
  [/\bGray\b/g, "Grey"],
  [/\b(\w{2,}?)(?<![Ss]|[Pp]r|[Ss]e)(i|y)z(e|es|ed|ing|ation|ations)\b/g, "$1$2s$3"],
];

function british<T>(value: T): T {
  if (typeof value === "string") return SPELLINGS.reduce<string>((s, [from, to]) => s.replace(from, to), value) as T;
  if (Array.isArray(value)) return value.map(british) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, british(v)])) as T;
  }
  return value;
}

/**
 * British English: the American strings respelled, so a string added to en.ts
 * is here too without anyone having to remember.
 */
export const enGB: Dictionary = {
  ...british(en),
  meta: { localeTag: "en-GB", name: "English (UK)" },
};

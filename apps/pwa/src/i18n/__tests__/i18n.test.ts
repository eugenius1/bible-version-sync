import { describe, expect, it } from "vitest";
import { createI18n, detectLanguage, DICTIONARIES, interpolate, LANGUAGES } from "..";
import { copyrightYears } from "../../lib/copyright";
import { en } from "../en";
import { fr } from "../fr";

/** Every leaf path in a dictionary (arrays count as one leaf with their length). */
function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return [`${prefix}[${value.length}]`];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

/** Every string with its path, including those inside arrays. */
function strings(dict: unknown, prefix = ""): [string, string][] {
  if (typeof dict === "string") return [[prefix, dict]];
  if (Array.isArray(dict)) return dict.flatMap((v, i) => strings(v, `${prefix}[${i}]`));
  if (dict && typeof dict === "object") {
    return Object.entries(dict).flatMap(([k, v]) => strings(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

describe("dictionaries", () => {
  it("cover exactly the same keys in every language", () => {
    const reference = paths(en).sort();
    for (const lang of LANGUAGES) expect(paths(DICTIONARIES[lang]).sort(), `locale ${lang}`).toEqual(reference);
  });

  it("use the same placeholders in every language", () => {
    // Guards against a French string using {count} where English uses {n}.
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const reference = new Map(strings(en));
    for (const [path, value] of strings(fr)) {
      expect(placeholders(value), `placeholders differ at ${path}`).toEqual(placeholders(reference.get(path) ?? ""));
    }
  });

  it("have no French strings left identical to English by accident", () => {
    // Names, symbols and format-only strings are legitimately shared.
    const allowed = new Set(["app.copyright", "app.licence", "results.more"]);
    const english = new Map(strings(en));
    const identical = strings(fr)
      .filter(([path, value]) => !allowed.has(path) && english.get(path) === value)
      .map(([path]) => path);
    expect(identical).toEqual([]);
  });

  it("keep French punctuation off the start of a line", () => {
    // French puts a space before : ; ? !, and it must be a no-break one.
    const offenders = strings(fr)
      .filter(([, value]) => / [:;?!]/.test(value))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});

describe("device language detection", () => {
  it("picks French when French is the first preference", () => {
    expect(detectLanguage(["fr-FR", "en-US"])).toBe("fr");
  });

  it("ignores the region subtag", () => {
    expect(detectLanguage(["fr-CA"])).toBe("fr");
    expect(detectLanguage(["en-GB"])).toBe("en");
  });

  it("respects preference order and skips unsupported languages", () => {
    expect(detectLanguage(["de-DE", "fr-BE", "en"])).toBe("fr");
  });

  it("falls back to English when nothing matches", () => {
    expect(detectLanguage(["ja", "ko"])).toBe("en");
    expect(detectLanguage([])).toBe("en");
  });
});

describe("formatting", () => {
  const EN = createI18n("en");
  const FR = createI18n("fr");

  it("uses the singular for zero in French but the plural in English", () => {
    expect(FR.plural(FR.t.footer.memory, 0)).toBe("Mémoire de synchronisation : 0 verset");
    expect(EN.plural(EN.t.footer.memory, 0)).toBe("Sync memory: 0 verses");
  });

  it("agrees on one and many", () => {
    expect(EN.plural(EN.t.results.apply, 1)).toBe("Apply 1 change");
    expect(EN.plural(EN.t.results.apply, 2)).toBe("Apply 2 changes");
    expect(FR.plural(FR.t.results.apply, 1)).toBe("Appliquer 1 modification");
    expect(FR.plural(FR.t.results.apply, 2)).toBe("Appliquer 2 modifications");
  });

  it("formats counts for the locale", () => {
    expect(EN.num(12345)).toBe("12,345");
    expect(FR.num(12345)).toMatch(/^12\s345$/u);
    expect(FR.plural(FR.t.results.apply, 1500)).toMatch(/^Appliquer 1\s500 modifications$/u);
  });

  it("names books and verses in the active language", () => {
    expect(EN.ref("ISA.53.5")).toBe("Isaiah 53:5");
    expect(FR.ref("ISA.53.5")).toBe("Ésaïe 53:5");
  });
});

describe("interpolation", () => {
  it("substitutes named placeholders", () => {
    expect(interpolate("{a} then {b}", { a: "one", b: 2 })).toBe("one then 2");
  });

  it("leaves unknown placeholders untouched rather than printing undefined", () => {
    expect(interpolate("{missing}", {})).toBe("{missing}");
  });
});

describe("copyright notice", () => {
  it("shows the first year alone, then widens to a range", () => {
    expect(copyrightYears(new Date("2026-09-28"))).toBe("2026");
    expect(copyrightYears(new Date("2028-01-01"))).toBe("2026–2028");
  });
});

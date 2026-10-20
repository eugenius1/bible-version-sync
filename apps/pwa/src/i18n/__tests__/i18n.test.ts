import { STD_SCHEMES } from "@bvs/core";
import { describe, expect, it, vi } from "vitest";
import { createI18n, detectLanguage, DICTIONARIES, interpolate, LANGUAGES, menuOrder, type Lang } from "..";
import { copyrightYears } from "../../lib/copyright";
import { en } from "../en";
import { fr } from "../fr";

/** Languages whose counts take [one, few, many]. */
const THREE_FORMS = new Set<Lang>(["ru"]);

/**
 * Every leaf path in a dictionary (arrays count as one leaf with their
 * length). A language with three plural forms has three where English has
 * two; that's counted as two, so the shapes still compare.
 */
function paths(value: unknown, prefix = "", threeForms = false): string[] {
  if (Array.isArray(value)) {
    const plural = threeForms && value.length === 3 && prefix !== "signIn.points";
    return [`${prefix}[${plural ? 2 : value.length}]`];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k, threeForms));
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
    for (const lang of LANGUAGES) {
      expect(paths(DICTIONARIES[lang], "", THREE_FORMS.has(lang)).sort(), `locale ${lang}`).toEqual(reference);
    }
  });

  it("show the count in every form of a language whose 'one' isn't only 1", () => {
    for (const lang of THREE_FORMS) {
      for (const [path, value] of strings(DICTIONARIES[lang])) {
        const plural = path.match(/^(.*)\[0\]$/)?.[1];
        if (!plural || plural === "signIn.points") continue;
        const other = new Map(strings(DICTIONARIES[lang])).get(`${plural}[1]`) ?? "";
        if (other.includes("{n}")) expect(value, `${lang} ${path}`).toContain("{n}");
      }
    }
    const RU = createI18n("ru");
    expect(RU.plural(RU.t.results.inSyncStoppedDone, 21)).toMatch(/^В 21 книге/);
  });

  it("give three plural forms only where the language has a separate 'few'", () => {
    // signIn.points is a list, not plural forms, and has three items everywhere.
    for (const lang of LANGUAGES) {
      const threes = strings(DICTIONARIES[lang])
        .map(([path]) => path.match(/^(.*)\[2\]$/)?.[1])
        .filter((path): path is string => !!path && path !== "signIn.points");
      if (THREE_FORMS.has(lang)) expect(threes.length, lang).toBeGreaterThan(0);
      else expect(threes, lang).toEqual([]);
    }
    for (const lang of THREE_FORMS) {
      expect(new Intl.PluralRules(DICTIONARIES[lang].meta.localeTag).resolvedOptions().pluralCategories).toContain("few");
    }
  });

  it("use the same placeholders in every language", () => {
    // Guards against a French string using {count} where English uses {n}.
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const reference = new Map(strings(en));
    for (const lang of LANGUAGES) {
      for (const [path, value] of strings(DICTIONARIES[lang])) {
        // A third plural form is checked against English's plural.
        const english = reference.get(path) ?? reference.get(path.replace(/\[2\]$/, "[1]")) ?? "";
        // Where "one" isn't only 1 (Russian's covers 21, 31…), the first form
        // carries the count even when English's singular doesn't.
        const own = THREE_FORMS.has(lang) && path.endsWith("[0]") ? placeholders(value).filter((p) => p !== "{n}") : placeholders(value);
        const theirs = THREE_FORMS.has(lang) && path.endsWith("[0]") ? placeholders(english).filter((p) => p !== "{n}") : placeholders(english);
        expect(own, `${lang}: placeholders differ at ${path}`).toEqual(theirs);
      }
    }
  });

  it("name every numbering system the assumed-numbering hint can mention", () => {
    for (const lang of LANGUAGES) {
      const { source, systems } = DICTIONARIES[lang].versions;
      for (const system of STD_SCHEMES) {
        expect(systems[system], `${lang} ${system}`).toBeTruthy();
        expect(interpolate(source.assumed.hint, { system: systems[system] }), `${lang} ${system}`).not.toMatch(/[{}]/);
      }
    }
    expect(interpolate(en.versions.source.assumed.hint, { system: en.versions.systems.rso })).toContain(
      "so Russian Synodal numbering is assumed",
    );
  });

  it("have no strings left identical to English by accident", () => {
    // Names, symbols and format-only strings are legitimately shared, and some
    // words are the same in both languages.
    const shared = ["app.copyright", "app.licence"];
    const allowed: Partial<Record<Lang, string[]>> = {
      fr: ["results.more", "priority.names.orange"],
      de: ["themes.system", "priority.names.orange"],
      id: ["versions.number"],
    };
    const english = new Map(strings(en));
    // British English is American respelled, so mostly the same by design.
    for (const lang of LANGUAGES.filter((l) => l !== "en" && l !== "en-GB")) {
      const ok = new Set([...shared, ...(allowed[lang] ?? [])]);
      const identical = strings(DICTIONARIES[lang])
        .filter(([path, value]) => !ok.has(path) && english.get(path) === value)
        .map(([path]) => path);
      expect(identical, lang).toEqual([]);
    }
  });

  it("respell British English but leave placeholders alone", () => {
    const gb = DICTIONARIES["en-GB"];
    expect(gb.priority.title).toBe("When a verse's colours differ, which wins?");
    expect(gb.priority.names.grey).toBe("Grey");
    expect(gb.results.action.recolor).toBe("change colour");
    expect(gb.signIn.points[0]).toContain("recoloured");
    expect(gb.priority.drag).toContain("{color}");
    const american = strings(gb).filter(([, value]) => /(?<!\{)\bcolor|\bgray\b/i.test(value));
    expect(american).toEqual([]);
    expect(createI18n("en-GB").ref("PSA.23.1")).toBe("Psalms 23:1");
  });

  it("respells -ize and -yze words, but not size or prize", async () => {
    vi.resetModules();
    vi.doMock("../en", async (load) => {
      const real = await load<typeof import("../en")>();
      return { ...real, en: { ...real.en, app: { ...real.en.app, back: "Synchronize, organization, analyzed, resize, prizes" } } };
    });
    const { enGB } = await import("../en-gb");
    expect(enGB.app.back).toBe("Synchronise, organisation, analysed, resize, prizes");
    vi.doUnmock("../en");
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
    expect(detectLanguage(["en-US"])).toBe("en");
  });

  it("gives British English to the UK and the Commonwealth, and American to the rest", () => {
    expect(detectLanguage(["en-GB"])).toBe("en-GB");
    expect(detectLanguage(["en-KE"])).toBe("en-GB");
    expect(detectLanguage(["en-Latn-NG"])).toBe("en-GB");
    expect(detectLanguage(["en-CA"])).toBe("en");
    expect(detectLanguage(["en"])).toBe("en");
  });

  it("respects preference order and skips unsupported languages", () => {
    expect(detectLanguage(["ja-JP", "fr-BE", "en"])).toBe("fr");
    expect(detectLanguage(["pt-PT", "es"])).toBe("pt");
  });

  it("falls back to English when nothing matches", () => {
    expect(detectLanguage(["ja", "ko"])).toBe("en");
    expect(detectLanguage([])).toBe("en");
  });
});

describe("language menu order", () => {
  it("puts English first, then the device's languages, then the rest by name", () => {
    expect(menuOrder(["ru-RU", "fr", "ja", "en-US"])).toEqual({
      pinned: ["en", "ru", "fr"],
      rest: ["id", "de", "en-GB", "es", "sw", "pt"],
    });
  });

  it("leads with the reader's own English", () => {
    expect(menuOrder(["fr", "en-GB"]).pinned).toEqual(["en-GB", "fr"]);
    expect(menuOrder(["en-GB", "en-US"]).pinned).toEqual(["en-GB", "en"]);
  });

  it("puts English alone first when nothing else matches", () => {
    expect(menuOrder([]).pinned).toEqual(["en"]);
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

  it("picks Russian's three forms by the last digits", () => {
    const RU = createI18n("ru");
    const memory = (n: number) => RU.plural(RU.t.footer.memory, n);
    expect(memory(1)).toBe("Память синхронизации: 1 стих");
    expect(memory(3)).toBe("Память синхронизации: 3 стиха");
    expect(memory(5)).toBe("Память синхронизации: 5 стихов");
    expect(memory(11)).toBe("Память синхронизации: 11 стихов");
    expect(memory(21)).toBe("Память синхронизации: 21 стих");
    expect(memory(22)).toBe("Память синхронизации: 22 стиха");
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

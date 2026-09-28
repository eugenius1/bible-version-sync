/**
 * Verse-number mapping between Bible versions.
 *
 * Two standard systems cover almost everything:
 *   eng - traditional English numbering (NIV, AMP, KJV, ...)
 *   org - Hebrew/Greek "original" numbering (BHS / Nestle-Aland): Psalm titles
 *         are verse 1, Joel has 4 chapters, Malachi has 3, etc.
 *
 * Many translations (notably French ones like LSG) mix the two chapter by
 * chapter, so the system is detected per chapter by comparing each chapter's
 * real verse count with the eng and org counts. Chapters that follow neither
 * come from hand-checked correction tables ("custom").
 *
 * Every verse is converted to a canonical reference in the org system; two
 * versions agree on a verse when their verses map to the same canonical ref.
 */

import { BUILTIN_VERSIONS, ENG_VRS, KNOWN_COUNTS, ORG_VRS, OVERRIDES } from "./data.generated";

export const BOOKS = (
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO " +
  "ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL " +
  "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB " +
  "JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split(" ");

/** "JHN.3.16" */
export type Ref = string;
export type Scheme = "eng" | "org" | "custom";
/** book -> chapter -> verse count */
export type ChapterCounts = Record<string, Record<number, number>>;

export const ref = (book: string, ch: number, v: number): Ref => `${book}.${ch}.${v}`;

export function parseRef(r: Ref): [string, number, number] {
  const [book, ch, v] = r.split(".");
  const c = Number(ch);
  const n = Number(v);
  if (!book || !Number.isInteger(c) || !Number.isInteger(n)) throw new Error(`bad reference: ${r}`);
  return [book, c, n];
}

// eng.vrs has no mapping for these NT differences; org merges two English verses.
const SUPPLEMENTAL_ENG_TO_ORG: Record<Ref, Ref> = {
  "ACT.19.41": "ACT.19.40",
  "2CO.13.13": "2CO.13.12",
  "2CO.13.14": "2CO.13.13",
};

const BOOK_LINE = /^([0-9A-Z]{3})((?: \d+:\d+)+)$/;
const MAP_LINE = /^([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))? = ([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$/;

/** Parse a Paratext .vrs file (or a correction table in the same syntax). */
export function parseVrs(text: string): { counts: Record<string, number[]>; mappings: [Ref, Ref][] } {
  const counts: Record<string, number[]> = {};
  const mappings: [Ref, Ref][] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    if (!line) continue;
    if (line.includes("=")) {
      const m = MAP_LINE.exec(line);
      if (!m) continue; // verse-part splits like "ESG 1:1a" are not supported
      const [, b1, c1, v1s, v1e, b2, c2, v2s, v2e] = m;
      const v1 = Number(v1s);
      const v2 = Number(v2s);
      const n1 = (v1e ? Number(v1e) : v1) - v1;
      const n2 = (v2e ? Number(v2e) : v2) - v2;
      // Uneven ranges (e.g. PSA 13:0-5 = 13:1-6 when eng also has 13:6) leave
      // the tail unmapped, which falls back to identity.
      for (let i = 0; i <= Math.min(n1, n2); i++) {
        mappings.push([ref(b1, Number(c1), v1 + i), ref(b2, Number(c2), v2 + i)]);
      }
      continue;
    }
    const b = BOOK_LINE.exec(line);
    if (b) counts[b[1]] = b[2].trim().split(" ").map((p) => Number(p.split(":")[1]));
  }
  return { counts, mappings };
}

export class Standard {
  constructor(
    readonly engCounts: Record<string, number[]>,
    readonly orgCounts: Record<string, number[]>,
    readonly engToOrg: Map<Ref, Ref>,
  ) {}

  private static cached?: Standard;

  static load(): Standard {
    if (Standard.cached) return Standard.cached;
    const eng = parseVrs(ENG_VRS);
    const org = parseVrs(ORG_VRS);
    const engToOrg = new Map<Ref, Ref>();
    for (const [src, dst] of eng.mappings) {
      if (parseRef(src)[2] === 0) continue; // English Psalm titles are unnumbered
      if (!engToOrg.has(src)) engToOrg.set(src, dst);
    }
    for (const [src, dst] of Object.entries(SUPPLEMENTAL_ENG_TO_ORG)) engToOrg.set(src, dst);
    Standard.cached = new Standard(eng.counts, org.counts, engToOrg);
    return Standard.cached;
  }

  count(scheme: "eng" | "org", book: string, ch: number): number {
    const counts = (scheme === "eng" ? this.engCounts : this.orgCounts)[book] ?? [];
    return ch > 0 && ch <= counts.length ? counts[ch - 1] : 0;
  }

  toCanon(scheme: "eng" | "org", r: Ref): Ref {
    return scheme === "eng" ? (this.engToOrg.get(r) ?? r) : r;
  }
}

export interface BuildOptions {
  /** Real verse counts per chapter (may be partial or empty). */
  knownCounts?: ChapterCounts;
  /** Used for books where nothing is known. */
  defaultScheme?: "eng" | "org";
  /** Explicit local ref -> canonical ref for chapters following neither system. */
  overrides?: Map<Ref, Ref>;
}

/** Maps one version's verse numbers to canonical (org) refs and back. */
export class VersionMap {
  /** book -> chapter -> scheme, or null when the chapter can't be mapped */
  readonly schemes: Record<string, Record<number, Scheme | null>> = {};
  readonly counts: ChapterCounts = {};
  toCanon = new Map<Ref, Ref>();
  fromCanon = new Map<Ref, Ref[]>();
  private overrides = new Map<Ref, Ref>();

  private constructor(readonly abbr: string) {}

  /** Chapters of `book` that exist in this version and can be mapped. */
  chapters(book: string): number[] {
    return Object.entries(this.schemes[book] ?? {})
      .filter(([c, s]) => s !== null && (this.counts[book][Number(c)] ?? 0) > 0)
      .map(([c]) => Number(c))
      .sort((a, b) => a - b);
  }

  skippedChapters(book: string): number[] {
    return Object.entries(this.schemes[book] ?? {})
      .filter(([c, s]) => s === null && (this.counts[book][Number(c)] ?? 0) > 0)
      .map(([c]) => Number(c))
      .sort((a, b) => a - b);
  }

  /**
   * Chapters without known counts inherit their book's majority scheme, or
   * `defaultScheme` when nothing in the book is known. Every chapter touched by
   * an override uses only the override table (unlisted verses keep their number).
   */
  static build(abbr: string, std: Standard, opts: BuildOptions = {}): VersionMap {
    const known = opts.knownCounts ?? {};
    const overrides = opts.overrides ?? new Map<Ref, Ref>();
    const defaultScheme = opts.defaultScheme ?? "eng";
    const custom: Record<string, Record<number, number>> = {};
    for (const local of overrides.keys()) {
      const [b, c, v] = parseRef(local);
      custom[b] ??= {};
      custom[b][c] = Math.max(custom[b][c] ?? 0, v);
    }

    const vm = new VersionMap(abbr);
    vm.overrides = overrides;
    for (const book of BOOKS) {
      const actual = known[book] ?? {};
      const actualChapters = Object.keys(actual).map(Number);
      const nCh = Math.max(
        std.engCounts[book]?.length ?? 0,
        std.orgCounts[book]?.length ?? 0,
        ...actualChapters,
      );
      const label: Record<number, "unknown" | "both" | "eng" | "org" | "none"> = {};
      for (let c = 1; c <= nCh; c++) {
        const a = actual[c];
        const e = std.count("eng", book, c);
        const o = std.count("org", book, c);
        if (a === undefined) label[c] = "unknown";
        else if (a === e && a === o) label[c] = "both";
        else if (a === e) label[c] = "eng";
        else if (a === o) label[c] = "org";
        else label[c] = "none";
      }
      const labels = Object.values(label);
      const nEng = labels.filter((l) => l === "eng").length;
      const nOrg = labels.filter((l) => l === "org").length;
      const majority: "eng" | "org" = nEng || nOrg ? (nEng >= nOrg ? "eng" : "org") : defaultScheme;

      const schemes: Record<number, Scheme | null> = {};
      const counts: Record<number, number> = {};
      for (let c = 1; c <= nCh; c++) {
        const lab = label[c];
        const s: "eng" | "org" | null =
          lab === "both" || lab === "unknown" ? majority : lab === "none" ? null : lab;
        schemes[c] = s;
        counts[c] = actual[c] ?? std.count(s ?? majority, book, c);
      }
      for (const [c, maxV] of Object.entries(custom[book] ?? {})) {
        schemes[Number(c)] = "custom";
        counts[Number(c)] = actual[Number(c)] ?? maxV;
      }
      vm.schemes[book] = schemes;
      vm.counts[book] = counts;
    }
    vm.index(std);
    return vm;
  }

  private index(std: Standard): void {
    // If chapters using different schemes collide on the same canonical verse
    // we can't trust either chapter, so drop both and retry.
    for (;;) {
      const toCanon = new Map<Ref, Ref>();
      const fromCanon = new Map<Ref, Ref[]>();
      for (const [book, schemes] of Object.entries(this.schemes)) {
        for (const [cs, s] of Object.entries(schemes)) {
          if (s === null) continue;
          const c = Number(cs);
          const n = this.counts[book][c] ?? 0;
          for (let v = 1; v <= n; v++) {
            const local = ref(book, c, v);
            const canon = s === "custom" ? (this.overrides.get(local) ?? local) : std.toCanon(s, local);
            toCanon.set(local, canon);
            const list = fromCanon.get(canon);
            if (list) list.push(local);
            else fromCanon.set(canon, [local]);
          }
        }
      }
      const bad = new Set<string>();
      for (const locals of fromCanon.values()) {
        const kinds = new Set(locals.map((l) => {
          const [b, c] = parseRef(l);
          return this.schemes[b][c];
        }));
        if (kinds.size > 1) {
          for (const l of locals) {
            const [b, c] = parseRef(l);
            bad.add(`${b}.${c}`);
          }
        }
      }
      if (bad.size === 0) {
        this.toCanon = toCanon;
        this.fromCanon = fromCanon;
        return;
      }
      for (const bc of bad) {
        const [b, c] = bc.split(".");
        this.schemes[b][Number(c)] = null;
      }
    }
  }
}

/** Built-in verified verse counts for a bible id, as {book: {chapter: count}}. */
export function builtinCounts(bibleId: number): ChapterCounts | undefined {
  const flat = KNOWN_COUNTS[bibleId];
  if (!flat) return undefined;
  const out: ChapterCounts = {};
  for (const [key, n] of Object.entries(flat)) {
    const [book, ch] = key.split(".");
    (out[book] ??= {})[Number(ch)] = n;
  }
  return out;
}

/** Built-in correction table for a bible id (local ref -> canonical ref). */
export function builtinOverrides(bibleId: number): Map<Ref, Ref> {
  const text = OVERRIDES[bibleId];
  return new Map(text ? parseVrs(text).mappings : []);
}

export function isBuiltinVersion(bibleId: number): boolean {
  return BUILTIN_VERSIONS.some((v) => v.bibleId === bibleId);
}

/** Convert a /v1/bibles/{id}/index response into {book: {chapter: count}}. */
export function countsFromIndex(index: unknown): ChapterCounts {
  const out: ChapterCounts = {};
  const books = (index as { books?: unknown[] })?.books ?? [];
  for (const book of books as Array<{ id?: string; chapters?: unknown[] }>) {
    if (!book.id || !BOOKS.includes(book.id)) continue;
    for (const ch of (book.chapters ?? []) as Array<{ id?: unknown; verses?: unknown[] }>) {
      const c = Number(ch.id);
      if (!Number.isInteger(c)) continue; // intros etc.
      const verses = ch.verses ?? [];
      let max = 0;
      for (const v of verses) {
        let id: unknown = v;
        if (v && typeof v === "object") {
          const o = v as { id?: unknown; passage_id?: string; reference?: string };
          id = o.id ?? (o.passage_id ?? o.reference ?? "").split(".").pop();
        }
        const n = Number(String(id).split("-").pop());
        if (Number.isInteger(n)) max = Math.max(max, n);
      }
      (out[book.id] ??= {})[c] = max || verses.length;
    }
  }
  return out;
}

/**
 * Build the map for a version from the best data available: the API index
 * (if the app key may read it), else the built-in table, else an assumption.
 */
export function buildVersionMap(
  abbr: string,
  bibleId: number,
  apiIndex?: unknown,
  defaultScheme: "eng" | "org" = "eng",
): { map: VersionMap; source: "api-index" | "builtin" | "assumed" } {
  const std = Standard.load();
  const overrides = builtinOverrides(bibleId);
  if (apiIndex) {
    return { map: VersionMap.build(abbr, std, { knownCounts: countsFromIndex(apiIndex), overrides, defaultScheme }), source: "api-index" };
  }
  const known = builtinCounts(bibleId);
  if (known) return { map: VersionMap.build(abbr, std, { knownCounts: known, overrides, defaultScheme }), source: "builtin" };
  return { map: VersionMap.build(abbr, std, { overrides, defaultScheme }), source: "assumed" };
}

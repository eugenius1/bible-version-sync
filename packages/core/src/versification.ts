/**
 * Verse-number mapping between Bible versions.
 *
 * Two standard systems cover almost everything:
 *   eng - traditional English numbering (NIV, AMP, KJV, ...)
 *   org - Hebrew/Greek "original" numbering (BHS / Nestle-Aland): Psalm titles
 *         are verse 1, Joel has 4 chapters, Malachi has 3, etc.
 * Four more are considered only for versions YouVersion labels with them:
 *   rso, rsc - Russian Synodal (Orthodox and Protestant editions)
 *   lxx      - Septuagint (Psalms 10-147 one behind Hebrew, ...)
 *   vul      - Vulgate
 *
 * Many translations (notably French ones like LSG) mix systems chapter by
 * chapter, so the system is detected per chapter by comparing each chapter's
 * real verse count with each candidate system's count. Chapters that follow
 * none come from hand-checked correction tables ("custom").
 *
 * Every verse is converted to a canonical reference in the org system; two
 * versions agree on a verse when their verses map to the same canonical ref.
 */

import {
  ENG_VRS,
  KNOWN_COUNTS,
  LXX_VRS,
  ORG_VRS,
  OVERRIDES,
  RSC_VRS,
  RSO_VRS,
  SHARED_OVERRIDES,
  VERIFIED_VERSIONS,
  VRS_LABEL_IDS,
  VUL_VRS,
  type VersionName,
} from "./data.generated";

export const BOOKS = (
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO " +
  "ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL " +
  "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB " +
  "JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split(" ");

/** "JHN.3.16" */
export type Ref = string;
export type Scheme = StdScheme | "custom";
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

// Corrections to SIL's tables, applied over them, each checked against the
// text on bible.com (Sept 2026).
const SUPPLEMENTAL: Partial<Record<StdScheme, string>> = {
  // rso.vrs doesn't shift Daniel 5:31-6:28, though rsc.vrs and eng.vrs both
  // do: Synodal Daniel 5:31 is Darius receiving the kingdom and 6:1 the 120
  // satraps, as in English (Hebrew 6:1-2).
  rso: "DAN 5:31 = DAN 6:1\nDAN 6:1-28 = DAN 6:2-29",
  // lxx.vrs swaps verses into the Greek order of the commandments; UBIO, the
  // only lxx-labelled version surveyed, keeps the Hebrew order (Exodus 20:13
  // and Deuteronomy 5:17 are "do not murder").
  lxx: "EXO 20:13-15 = EXO 20:13-15\nEXO 21:16-17 = EXO 21:16-17\nDEU 5:17-18 = DEU 5:17-18",
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

/** A standard numbering system, as YouVersion labels versions (`vrs`). */
export type StdScheme = "eng" | "org" | "rso" | "rsc" | "lxx" | "vul";
export const STD_SCHEMES: readonly StdScheme[] = ["eng", "org", "rso", "rsc", "lxx", "vul"];
/**
 * Systems only considered for a version YouVersion labels with them. Their
 * chapter counts coincide with English or Hebrew chapters holding different
 * text (Synodal Psalm 91 has English Psalm 91's count but is Psalm 92), so
 * offering them to every version would misplace verses.
 */
export const LABEL_ONLY_SCHEMES: readonly StdScheme[] = ["rso", "rsc", "lxx", "vul"];

const VRS_TEXT: Record<StdScheme, string> = {
  eng: ENG_VRS,
  org: ORG_VRS,
  rso: RSO_VRS,
  rsc: RSC_VRS,
  lxx: LXX_VRS,
  vul: VUL_VRS,
};

export class Standard {
  constructor(
    readonly counts: Record<StdScheme, Record<string, number[]>>,
    readonly toOrg: Record<StdScheme, Map<Ref, Ref>>,
  ) {}

  private static cached?: Standard;

  static load(): Standard {
    if (Standard.cached) return Standard.cached;
    const counts = {} as Record<StdScheme, Record<string, number[]>>;
    const toOrg = {} as Record<StdScheme, Map<Ref, Ref>>;
    for (const s of STD_SCHEMES) {
      const parsed = parseVrs(VRS_TEXT[s]);
      counts[s] = parsed.counts;
      const map = new Map<Ref, Ref>();
      toOrg[s] = map;
      if (s === "org") continue; // canonical numbering itself
      const targets = new Map<Ref, Ref[]>();
      for (const [src, dst] of parsed.mappings) {
        const [sb, , sv] = parseRef(src);
        const [db, , dv] = parseRef(dst);
        // Psalm titles are verse 0 and can't be highlighted. Drop them on
        // either side too: rso's "PSA 9:22 = PSA 10:0" would otherwise shadow
        // the real "PSA 9:22 = PSA 10:1".
        if (sv === 0 || dv === 0) continue;
        // The sync reads and plans one book at a time, so a verse whose
        // canonical ref lies in another synced book (lxx numbers Nehemiah as
        // Ezra 11-23) would look unread, i.e. removed, when that book syncs.
        // Books outside BOOKS (Prayer of Manasseh, Psalm 151...) are only
        // ever reached from their own book, so those mappings are kept.
        if (db !== sb && BOOKS.includes(db)) continue;
        const list = targets.get(src);
        if (list) list.push(dst);
        else targets.set(src, [dst]);
      }
      // A verse spanning two canonical verses (rso's "NUM 26:1 = NUM 25:19"
      // and "= NUM 26:1") can only map to one. Take the one eng picks for the
      // same verse when it's among them, so English and Synodal Numbers 26:1,
      // the same text, stay in step; else the first listed.
      for (const [src, list] of targets) {
        const engPick = s === "eng" ? undefined : (toOrg.eng.get(src) ?? src);
        map.set(src, engPick !== undefined && list.includes(engPick) ? engPick : list[0]);
      }
      if (s === "eng") {
        for (const [src, dst] of Object.entries(SUPPLEMENTAL_ENG_TO_ORG)) map.set(src, dst);
      }
      for (const [src, dst] of parseVrs(SUPPLEMENTAL[s] ?? "").mappings) map.set(src, dst);
    }
    Standard.cached = new Standard(counts, toOrg);
    return Standard.cached;
  }

  count(scheme: StdScheme, book: string, ch: number): number {
    const counts = this.counts[scheme][book] ?? [];
    return ch > 0 && ch <= counts.length ? counts[ch - 1] : 0;
  }

  toCanon(scheme: StdScheme, r: Ref): Ref {
    return this.toOrg[scheme].get(r) ?? r;
  }
}

export interface BuildOptions {
  /** Real verse counts per chapter (may be partial or empty). */
  knownCounts?: ChapterCounts;
  /** Used for books where nothing is known, unless `label` is Synodal, Septuagint or Vulgate. */
  defaultScheme?: "eng" | "org";
  /**
   * YouVersion's numbering label for the version. Only the label-only systems
   * (`rso`, `rsc`, `lxx`, `vul`) change anything: they become a candidate
   * alongside eng and org. An eng or org label is ignored, because chapter
   * counts already decide between those two (LSG is labelled org but follows
   * English numbering in Malachi).
   */
  label?: StdScheme;
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
  /**
   * Set on the empty map of a version whose numbering can't be mapped (see
   * buildVersionMap). The sync leaves such a version out entirely; the map
   * is empty so that code which forgets to check still reads and writes
   * nothing for it.
   */
  unsupported = false;

  private constructor(readonly abbr: string) {}

  /** A map with no chapters, for a version the sync must refuse. */
  static unsupported(abbr: string): VersionMap {
    const vm = new VersionMap(abbr);
    vm.unsupported = true;
    return vm;
  }

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
   * Each chapter with a known count uses the candidate system whose count it
   * matches (eng, org, plus the version's label when that's rso, rsc, lxx or
   * vul). When several match, the one that fits most of the book's
   * discriminating chapters wins; on a tie eng, then the label. Chapters
   * without known counts take that same book-wide pick, which is the label
   * (else `defaultScheme`) when nothing in the book is known. Every chapter
   * touched by an override uses only the override table (unlisted verses keep
   * their number), and is skipped when its known count isn't the table's
   * highest verse.
   *
   * The book's evidence outranks the label because a label describes a whole
   * version loosely: UBIO is labelled lxx but follows Hebrew order in
   * Jeremiah, where lxx Jeremiah 34 and 36 have the same verse counts as the
   * Hebrew chapters by coincidence (lxx 36 is Hebrew 29). eng wins a tie
   * because where a Synodal or Septuagint table disagrees with eng inside a
   * book that fits both equally well, it's about a verse the text divides as
   * English does (Synodal Numbers 26:1 and Revelation 13:1, UBIO's
   * Deuteronomy 5:17-18), so eng keeps those verses in step with English
   * versions.
   */
  static build(abbr: string, std: Standard, opts: BuildOptions = {}): VersionMap {
    const known = opts.knownCounts ?? {};
    const overrides = opts.overrides ?? new Map<Ref, Ref>();
    const label = opts.label && LABEL_ONLY_SCHEMES.includes(opts.label) ? opts.label : undefined;
    const candidates: StdScheme[] = label ? [label, "eng", "org"] : ["eng", "org"];
    const fallback: StdScheme = label ?? opts.defaultScheme ?? "eng";
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
      // Chapters only the label-only systems have (Psalm 151, Daniel 13-14)
      // count only when the version is known to have them: reading a
      // chapter that doesn't exist would fail the whole book.
      const nCh = Math.max(
        std.counts.eng[book]?.length ?? 0,
        std.counts.org[book]?.length ?? 0,
        ...actualChapters,
      );
      // A label system may not number this book at all: lxx has Nehemiah as
      // Ezra 11-23 and no Esther or Daniel of its own. Leaving it in would
      // give every chapter of an unknown book a count of 0 and drop the book
      // from the sync. Such a book is Hebrew-numbered instead, as UBIO's
      // Nehemiah, Esther and Daniel are.
      const bookCandidates = candidates.filter((s) => (std.counts[s][book]?.length ?? 0) > 0);
      const bookFallback: StdScheme = bookCandidates.includes(fallback) ? fallback : "org";
      // fits[c]: candidates whose count matches; undefined when unknown.
      const fits: Record<number, StdScheme[] | undefined> = {};
      const score = new Map<StdScheme, number>(bookCandidates.map((s) => [s, 0]));
      for (let c = 1; c <= nCh; c++) {
        const a = actual[c];
        if (a === undefined) continue;
        const expected = bookCandidates.map((s) => std.count(s, book, c));
        fits[c] = bookCandidates.filter((_, i) => expected[i] === a);
        // Only chapters where the candidates disagree say anything about
        // which system the book follows.
        if (new Set(expected).size > 1) for (const s of fits[c]!) score.set(s, score.get(s)! + 1);
      }
      const pick = (options: StdScheme[]): StdScheme => {
        const best = Math.max(...options.map((s) => score.get(s)!));
        if (best === 0) return options.includes(bookFallback) ? bookFallback : options[0];
        const top = options.filter((s) => score.get(s) === best);
        if (top.length === 1) return top[0];
        if (top.includes("eng")) return "eng";
        return label && top.includes(label) ? label : top[0];
      };
      const majority = pick(bookCandidates);

      const schemes: Record<number, Scheme | null> = {};
      const counts: Record<number, number> = {};
      for (let c = 1; c <= nCh; c++) {
        const f = fits[c];
        const s: StdScheme | null = f === undefined ? majority : f.length === 0 ? null : pick(f);
        schemes[c] = s;
        counts[c] = actual[c] ?? std.count(s ?? majority, book, c);
      }
      // A table is written for a chapter of a given length. If the version's
      // real count says otherwise (say, the API index of a version whose text
      // has changed since), the table doesn't describe this text: skip the
      // chapter rather than guess.
      for (const [cs, maxV] of Object.entries(custom[book] ?? {})) {
        const c = Number(cs);
        schemes[c] = actual[c] === undefined || actual[c] === maxV ? "custom" : null;
        counts[c] = actual[c] ?? maxV;
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

/**
 * Bundled verse counts for a bible id (verified or scanned), as
 * {book: {chapter: count}}. Only the chapters the engine can't infer are
 * stored; see KNOWN_COUNTS.
 */
export function builtinCounts(bibleId: number): ChapterCounts | undefined {
  const flat = KNOWN_COUNTS[bibleId];
  if (!flat) return undefined;
  const out: ChapterCounts = {};
  const std = Standard.load();
  for (const [key, n] of Object.entries(flat)) {
    const [book, ch] = key.split(".");
    if (ch === undefined) {
      // A book the version lacks: every chapter English or Hebrew has is 0.
      const chapters = Math.max(std.counts.eng[book]?.length ?? 0, std.counts.org[book]?.length ?? 0);
      out[book] = Object.fromEntries(Array.from({ length: chapters }, (_, i) => [i + 1, 0]));
    } else {
      (out[book] ??= {})[Number(ch)] = n;
    }
  }
  return out;
}

/**
 * Built-in correction tables for a bible id (local ref -> canonical ref): the
 * shared tables its own table names, then its own lines. gen-data checks that
 * no two of them touch the same chapter.
 */
export function builtinOverrides(bibleId: number): Map<Ref, Ref> {
  const tables = OVERRIDES[bibleId];
  if (!tables) return new Map();
  const text = [...tables.use.map((name) => SHARED_OVERRIDES[name]), tables.own].join("\n");
  return new Map(parseVrs(text).mappings);
}

/** Whether a version's numbering was checked by hand, chapter by chapter. */
export function isVerifiedVersion(bibleId: number): boolean {
  return VERIFIED_VERSIONS.some((v) => v.bibleId === bibleId);
}

let allNames: Map<number, VersionName> | undefined;
let loadingNames: Promise<void> | undefined;

/**
 * Load every version's name (about 100 KB gzipped, in a chunk of its own),
 * after which versionName knows them all. Safe to call repeatedly; a failed
 * load (offline, before the app is cached) can be retried.
 */
export function loadVersionNames(): Promise<void> {
  loadingNames ??= import("./names.generated").then(
    ({ NAMES_BY_LANGUAGE }) => {
      const map = new Map<number, VersionName>();
      for (const [language, list] of Object.entries(NAMES_BY_LANGUAGE)) {
        for (const [id, abbr, title] of list) map.set(id, { abbr, language, title });
      }
      allNames = map;
    },
    (e: unknown) => {
      loadingNames = undefined;
      throw e;
    },
  );
  return loadingNames;
}

/**
 * A version's name as bible.com shows it, once loadVersionNames is done. The
 * official API doesn't give names for most versions (their text isn't
 * licensed to the app key).
 */
export function versionName(bibleId: number): VersionName | undefined {
  return allNames?.get(bibleId);
}

/** Whether loadVersionNames has finished, so a missing name means an unknown version. */
export function versionNamesLoaded(): boolean {
  return allNames !== undefined;
}

/** Whether a version's verse counts are bundled, so the API index isn't needed. */
export function hasKnownCounts(bibleId: number): boolean {
  return Object.hasOwn(KNOWN_COUNTS, bibleId);
}

/**
 * Where a version's verse numbering comes from, most trusted first:
 * - verified: bundled counts, checked by hand chapter by chapter
 * - scanned: bundled counts from the versification survey, not checked by hand
 * - api-index: counts from the YouVersion API index
 * - assumed: no counts; the version's label, else English numbering
 * - unsupported: counts that neither English nor Hebrew numbering explains,
 *   and no label saying which other system does; the sync refuses it
 */
export type NumberingSource = "verified" | "scanned" | "api-index" | "assumed" | "unsupported";

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

let labels: Map<number, StdScheme> | undefined;

/** YouVersion's numbering label for a bible id, when known (bundled; the API doesn't expose it). */
export function versificationLabel(bibleId: number): StdScheme | undefined {
  if (!labels) {
    labels = new Map();
    for (const s of STD_SCHEMES) {
      let id = 0;
      for (const gap of VRS_LABEL_IDS[s] ? VRS_LABEL_IDS[s].split(",") : []) labels.set((id += parseInt(gap, 36)), s);
    }
  }
  return labels.get(bibleId);
}

/** The system a version is taken to follow when none of its verse counts are known. */
export function assumedScheme(bibleId: number, defaultScheme: "eng" | "org" = "eng"): StdScheme {
  const label = versificationLabel(bibleId);
  return label && LABEL_ONLY_SCHEMES.includes(label) ? label : defaultScheme;
}

/**
 * A version with more chapters than this fitting neither English nor Hebrew
 * numbering, and no Synodal, Septuagint or Vulgate label, is refused.
 *
 * Measured over the survey's 54 scanned versions: English and Hebrew
 * numbered versions have at most 38 such chapters (UKRK, 35 once its
 * correction tables are counted; the next is 11), the Synodal and Septuagint
 * ones 131 (UBIO), 143 (NRT) and 153 (SYNO), and the four label-only tables
 * themselves 145 (rsc) to 187 (lxx). 80 is over twice the English/Hebrew
 * maximum and 50 chapters below the lowest Synodal or Septuagint version.
 * Of the 220 unlabelled versions scanned since, the four refused reach 132
 * to 187 and the rest at most 23 (see docs/versification-survey.md).
 *
 * Without a label the engine can only use eng and org, and counts alone
 * can't say which other system applies (UBIO fits lxx in 131 of its chapters
 * and rsc in 130), so such a version would have its Psalms land one psalm
 * off: refusing it is the only safe answer.
 */
export const MAX_UNFIT_CHAPTERS = 80;

/**
 * Chapters whose known count fits neither English nor Hebrew numbering,
 * leaving out chapters the version lacks (a count of 0) and chapters a
 * correction table describes.
 */
export function unfitChapters(known: ChapterCounts, overrides: Map<Ref, Ref> = new Map()): number {
  const std = Standard.load();
  const described = new Set([...overrides.keys()].map((r) => r.slice(0, r.lastIndexOf("."))));
  let n = 0;
  for (const book of BOOKS) {
    for (const [cs, count] of Object.entries(known[book] ?? {})) {
      const c = Number(cs);
      if (count === 0 || described.has(`${book}.${c}`)) continue;
      if (count !== std.count("eng", book, c) && count !== std.count("org", book, c)) n++;
    }
  }
  return n;
}

/**
 * Build the map for a version from the data given or bundled: the API index
 * when passed, else the bundled counts, else an assumption. Every lookup is by
 * bible id; `abbr` only names the map.
 * The version's bundled numbering label, if any, is used throughout.
 *
 * A version whose known counts leave more than MAX_UNFIT_CHAPTERS chapters
 * unexplained, without a Synodal, Septuagint or Vulgate label, gets an empty
 * map and the source "unsupported", which the sync refuses. `unfit` is that
 * number of chapters, whenever counts are known.
 */
export function buildVersionMap(
  abbr: string,
  bibleId: number,
  apiIndex?: unknown,
  defaultScheme: "eng" | "org" = "eng",
): { map: VersionMap; source: NumberingSource; unfit?: number } {
  const std = Standard.load();
  const label = versificationLabel(bibleId);
  const base = { overrides: builtinOverrides(bibleId), defaultScheme, label };
  const known = apiIndex ? countsFromIndex(apiIndex) : builtinCounts(bibleId);
  if (!known) return { map: VersionMap.build(abbr, std, base), source: "assumed" };
  const unfit = unfitChapters(known, base.overrides);
  if (unfit > MAX_UNFIT_CHAPTERS && !(label && LABEL_ONLY_SCHEMES.includes(label))) {
    return { map: VersionMap.unsupported(abbr), source: "unsupported", unfit };
  }
  const map = VersionMap.build(abbr, std, { ...base, knownCounts: known });
  const source = apiIndex ? "api-index" : isVerifiedVersion(bibleId) ? "verified" : "scanned";
  return { map, source, unfit };
}

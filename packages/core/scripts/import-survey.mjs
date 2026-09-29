// Copies what the app needs from the versification survey into data/: each
// scanned version's verse counts (exceptions only) into known_counts.json,
// YouVersion's numbering labels into labels.json, and every surveyed
// version's name into names.json. Run it deliberately after a new scan and
// review the diff: the app never reads tools/ itself.
//
//   npm run import-survey -w @bvs/core
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bcp47 } from "./language-tags.mjs";
import { VERIFIED } from "./verified.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = join(root, "data");
const survey = join(root, "..", "..", "tools", "versification-survey", "data");

const BOOKS = (
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO " +
  "ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL " +
  "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB " +
  "JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split(" ");
const SCHEMES = ["eng", "org", "rso", "rsc", "lxx", "vul"];
const LABEL_ONLY = ["rso", "rsc", "lxx", "vul"];

/** book -> verse count per chapter, from a .vrs file's book lines. */
function vrsCounts(name) {
  const out = {};
  for (const raw of readFileSync(join(data, `${name}.vrs`), "utf8").split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    const m = /^([0-9A-Z]{3})((?: \d+:\d+)+)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().split(" ").map((p) => Number(p.split(":")[1]));
  }
  return out;
}
const std = Object.fromEntries(SCHEMES.map((s) => [s, vrsCounts(s)]));
const count = (s, book, ch) => std[s][book]?.[ch - 1] ?? 0;

/**
 * The chapters the engine can't infer: every one whose count differs from
 * English, and every one where the version's candidate systems disagree (the
 * engine needs those to pick each book's system). A chapter left out gets the
 * same count and system it would have had with every count known.
 *
 * A chapter English or Hebrew has but the version lacks (Joel 4 in an English
 * version, Esther in NABRE, whose Esther is the Greek ESG) is stored as 0 so
 * it isn't read: a failed read would hold back the whole book. Chapters only
 * a label-only system has (Daniel 13) are left out, since a 0 there would
 * count as evidence against that system. A book the version lacks entirely
 * is stored as one "BOOK": 0: many versions are a New Testament, or a few
 * books, and a 0 per chapter would cost about 15 KB per version.
 */
function exceptions(version) {
  const candidates = ["eng", "org", ...(LABEL_ONLY.includes(version.vrs) ? [version.vrs] : [])];
  const out = {};
  for (const book of BOOKS) {
    if (!(version.counts[book] ?? []).some((n) => n > 0)) {
      out[book] = 0;
      continue;
    }
    const actual = version.counts[book];
    const nCh = Math.max(std.eng[book]?.length ?? 0, std.org[book]?.length ?? 0, actual.length);
    for (let c = 1; c <= nCh; c++) {
      const n = actual[c - 1] ?? 0;
      const expected = new Set(candidates.map((s) => count(s, book, c)));
      if (n !== count("eng", book, c) || expected.size > 1) out[`${book}.${c}`] = n;
    }
  }
  return out;
}

const byNumber = (a, b) => Number(a) - Number(b);
/**
 * One entry per line, keyed by bible id, so a diff shows exactly which
 * chapters changed. `inline` keeps each version's object on its own line.
 */
function writeJson(file, obj, { inline = false } = {}) {
  const entry = (k, v) => `${JSON.stringify(k)}: ${v}`;
  const lines = Object.keys(obj).sort(byNumber).map((id) => {
    const value = obj[id];
    if (typeof value !== "object" || inline) return entry(id, JSON.stringify(value));
    const inner = Object.keys(value).sort().map((k) => entry(k, JSON.stringify(value[k])));
    return entry(id, `{\n${inner.join(",\n")}\n}`);
  });
  writeFileSync(join(data, file), `{\n${lines.join(",\n")}\n}\n`);
}

const scanned = JSON.parse(readFileSync(join(survey, "counts.json"), "utf8"));
// Only the verified versions carry over from the old file (the scan, which
// includes them, then refreshes their counts too). A version dropped from the
// scan must go: bundled counts stop the app from reading the API index.
const previous = JSON.parse(readFileSync(join(data, "known_counts.json"), "utf8"));
const known = {};
for (const { bibleId } of VERIFIED) if (previous[bibleId]) known[bibleId] = previous[bibleId];
for (const [id, version] of Object.entries(scanned)) known[id] = exceptions(version);

// Build and check the labels before writing anything, so a bad label can't
// leave the two files from different scans.
const labels = {};
const addLabel = (id, vrs, from) => {
  if (!vrs) return;
  if (!SCHEMES.includes(vrs)) throw new Error(`${from}: unknown numbering ${vrs} for ${id}`);
  if (labels[id] && labels[id] !== vrs) throw new Error(`${from}: ${id} is both ${labels[id]} and ${vrs}`);
  labels[id] = vrs;
};
for (const [id, v] of Object.entries(scanned)) addLabel(id, v.vrs, "counts.json");
const candidates = JSON.parse(readFileSync(join(survey, "candidates.json"), "utf8"));
for (const versions of Object.values(candidates)) {
  for (const v of versions) addLabel(String(v.id), v.vrs, "candidates.json");
}

// Each version's name as bible.com shows it, so the app can name a version
// the person only gave a number for. That's YouVersion's local abbreviation
// (NIV), not its internal one (NIV11); tools/versification-survey/names.py
// records it. Every candidate, not just the scanned
// versions: the 305 add about 8 KB to the gzipped app (the 54 alone, under
// 2 KB) and let the add form name any version someone is likely to add. The
// survey's ISO 639-3 codes become BCP 47 (eng -> en, zho_tw -> zh-TW) for the
// page's lang attribute, which picks Japanese rather than Chinese glyphs, and
// the voice a screen reader uses, by a fixed table (language-tags.mjs), so
// the result doesn't depend on the Node version.
const names = {};
const BIBLE_ID = /^[1-9]\d*$/;
// Control characters, and bidi overrides that would reorder the text around a title.
const UNPRINTABLE = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;
const addName = (id, abbr, title, lang, from) => {
  if (!BIBLE_ID.test(id)) throw new Error(`${from}: ${id} is not a bible id`);
  for (const [what, s] of [["abbreviation", abbr], ["title", title]]) {
    if (typeof s !== "string" || !s || s !== s.trim() || UNPRINTABLE.test(s)) {
      throw new Error(`${from}: ${id}: bad ${what} ${JSON.stringify(s)} (run the survey's names.py?)`);
    }
  }
  let language;
  try {
    language = bcp47(lang);
  } catch (e) {
    throw new Error(`${from}: ${id}: bad language ${JSON.stringify(lang)}: ${e.message}`);
  }
  const name = { abbr, language, title };
  if (names[id] && JSON.stringify(names[id]) !== JSON.stringify(name)) {
    throw new Error(`${from}: ${id} is both ${JSON.stringify(names[id])} and ${JSON.stringify(name)}`);
  }
  names[id] = name;
};
for (const [id, v] of Object.entries(scanned)) addName(id, v.local_abbr, v.title, v.lang, "counts.json");
for (const [lang, versions] of Object.entries(candidates)) {
  for (const v of versions) addName(String(v.id), v.local_abbreviation, v.local_title, lang, "candidates.json");
}

// The version bible.com opens for each language: the one popularity signal
// YouVersion publishes (see versionRank). Only the ids are kept.
const defaults = [...new Set(Object.values(JSON.parse(readFileSync(join(survey, "defaults.json"), "utf8"))))].sort(byNumber);
for (const id of defaults) if (!names[id]) throw new Error(`defaults.json: ${id} isn't a listed version`);

writeJson("known_counts.json", known);
writeJson("labels.json", labels);
writeJson("names.json", names, { inline: true });
writeFileSync(join(data, "defaults.json"), `[\n${defaults.join(",\n")}\n]\n`);

const total = Object.values(known).reduce((n, v) => n + Object.keys(v).length, 0);
console.log(
  `wrote data/known_counts.json (${Object.keys(known).length} versions, ${total} chapters)` +
    `, data/labels.json (${Object.keys(labels).length} labels)` +
    `, data/names.json (${Object.keys(names).length} names)` +
    ` and data/defaults.json (${defaults.length} language defaults)`,
);

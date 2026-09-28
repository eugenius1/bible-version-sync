// Bundles the files in data/ into src/data.generated.ts so the core package
// works the same in the browser, in Node and in tests (no file access needed).
//
//   npm run gen -w @bvs/core
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERIFIED } from "./verified.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = join(root, "data");
const read = (...path) => readFileSync(join(data, ...path), "utf8");

// Everything here is keyed by bible id: abbreviations aren't unique (ARC is
// both 212 and 3407), and the ones users type are their own.
const BIBLE_ID = /^[1-9]\d*$/;
const CHAPTER = /^[0-9A-Z]{3}\.[1-9]\d*$/;
const knownCounts = {};
for (const [id, counts] of Object.entries(JSON.parse(read("known_counts.json")))) {
  if (!BIBLE_ID.test(id)) throw new Error(`known_counts.json: key ${id} is not a bible id`);
  for (const [ch, n] of Object.entries(counts)) {
    if (!CHAPTER.test(ch) || !Number.isInteger(n) || n < 0) throw new Error(`known_counts.json: ${id} ${ch}: ${n}`);
  }
  knownCounts[id] = counts;
}
for (const v of VERIFIED) {
  if (!(v.bibleId in knownCounts)) throw new Error(`${v.abbr} (${v.bibleId}) is verified but has no counts`);
}

// Correction tables. A chapter that follows no system in several versions
// (Revelation 12 in 17 verses) is described once, in overrides/shared/<name>.map,
// and each version that numbers it that way says so with a `use <name>` line
// in its own overrides/<bible id>.map. Nothing applies a table on its own:
// matching counts don't prove matching text (Het Boek has Haggai 2 in 24
// verses like HSV, but splits it elsewhere).
const MAP_LINE = /^([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))? = ([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))?$/;
const USE_LINE = /^use ([0-9a-z-]+)$/;
const TABLE_NAME = /^[0-9a-z]+(?:-[0-9a-z]+)*$/;

/** A table's mapping lines, without comments; throws on anything else (but `use`, when allowed). */
function parseTable(path, text, allowUse) {
  const maps = [];
  const uses = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#", 1)[0].trim();
    if (!line) continue;
    const use = USE_LINE.exec(line);
    if (use && allowUse) {
      uses.push(use[1]);
      continue;
    }
    const m = MAP_LINE.exec(line);
    if (!m) throw new Error(`${path}: not a mapping: ${line}`);
    const [, b1, c1, v1, v1e, , , v2, v2e] = m;
    const n1 = (v1e ? Number(v1e) : Number(v1)) - Number(v1);
    const n2 = (v2e ? Number(v2e) : Number(v2)) - Number(v2);
    if (n1 !== n2 || n1 < 0) throw new Error(`${path}: uneven range: ${line}`);
    if (Number(v1) < 1 || Number(v2) < 1) throw new Error(`${path}: verse 0 can't be highlighted: ${line}`);
    maps.push({ book: b1, ch: Number(c1), last: Number(v1) + n1, line });
  }
  return { maps, uses, body: maps.map((m) => m.line).join("\n") };
}

/** Highest local verse per chapter a table touches: the counts it was written for. */
function signature(maps) {
  const out = {};
  for (const m of maps) out[`${m.book}.${m.ch}`] = Math.max(out[`${m.book}.${m.ch}`] ?? 0, m.last);
  return out;
}

// English counts, for the chapters known_counts.json leaves out (those where
// all of a version's candidate systems agree).
const engCounts = {};
for (const raw of read("eng.vrs").split(/\r?\n/)) {
  const m = /^([0-9A-Z]{3})((?: \d+:\d+)+)$/.exec(raw.split("#", 1)[0].trim());
  if (m) m[2].trim().split(" ").forEach((p, i) => (engCounts[`${m[1]}.${i + 1}`] = Number(p.split(":")[1])));
}

const shared = {};
for (const file of readdirSync(join(data, "overrides", "shared")).sort()) {
  const name = file.replace(/\.map$/, "");
  if (!file.endsWith(".map") || !TABLE_NAME.test(name)) throw new Error(`overrides/shared/${file}: name it <name>.map, in lower case`);
  shared[name] = parseTable(`overrides/shared/${file}`, read("overrides", "shared", file), false);
}

const overrides = {};
const used = new Set();
for (const file of readdirSync(join(data, "overrides")).sort()) {
  if (file === "shared") continue;
  const id = file.replace(/\.map$/, "");
  if (!file.endsWith(".map") || !BIBLE_ID.test(id)) throw new Error(`overrides/${file}: name it <bible id>.map`);
  if (!(id in knownCounts)) throw new Error(`overrides/${file}: no counts for bible ${id}`);
  const own = parseTable(`overrides/${file}`, read("overrides", file), true);
  const tables = [["its own lines", own]];
  for (const name of own.uses) {
    if (!(name in shared)) throw new Error(`overrides/${file}: no shared table ${name}`);
    if (tables.some(([n]) => n === name)) throw new Error(`overrides/${file}: uses ${name} twice`);
    tables.push([name, shared[name]]);
    used.add(name);
  }
  // A chapter a table touches is taken from the tables alone, so it must
  // belong to one table, and the version must have the verse count that table
  // was written for.
  const owner = {};
  for (const [name, t] of tables) {
    for (const [ch, last] of Object.entries(signature(t.maps))) {
      if (owner[ch]) throw new Error(`overrides/${file}: ${ch} is in both ${owner[ch]} and ${name}`);
      owner[ch] = name;
      const count = knownCounts[id][ch] ?? engCounts[ch];
      if (count !== last) throw new Error(`overrides/${file}: ${name} is for ${ch} in ${last} verses; bible ${id} has ${count}`);
    }
  }
  overrides[id] = { use: own.uses, own: own.body };
}
for (const name of Object.keys(shared)) {
  if (!used.has(name)) throw new Error(`overrides/shared/${name}.map: no version uses it`);
}

// YouVersion's numbering label per bible id, which the official API doesn't
// expose (see scripts/import-survey.mjs).
const SCHEMES = ["eng", "org", "rso", "rsc", "lxx", "vul"];
const labels = JSON.parse(read("labels.json"));
for (const [id, vrs] of Object.entries(labels)) {
  if (!BIBLE_ID.test(id) || !SCHEMES.includes(vrs)) throw new Error(`labels.json: ${id}: ${vrs}`);
}
const vrs = (name) => JSON.stringify(read(`${name}.vrs`));

const out = `// Generated by scripts/gen-data.mjs from data/ - do not edit by hand.
/* eslint-disable */

/** Paratext versification files from SIL libpalaso (MIT licence). */
export const ENG_VRS: string = ${vrs("eng")};
export const ORG_VRS: string = ${vrs("org")};
/** Russian Synodal (Orthodox and Protestant editions), Septuagint, Vulgate. */
export const RSO_VRS: string = ${vrs("rso")};
export const RSC_VRS: string = ${vrs("rsc")};
export const LXX_VRS: string = ${vrs("lxx")};
export const VUL_VRS: string = ${vrs("vul")};

/**
 * YouVersion's numbering label (\`vrs\`) by bible id, from bible.com (Sept 2026).
 * Versions not listed are unlabelled or weren't surveyed.
 */
export const VRS_LABELS: Record<number, "eng" | "org" | "rso" | "rsc" | "lxx" | "vul"> = ${JSON.stringify(labels)};

/** A version whose numbering was checked by hand, chapter by chapter. */
export interface VerifiedVersion {
  abbr: string;
  bibleId: number;
  language: string;
  title: string;
}

export const VERIFIED_VERSIONS: VerifiedVersion[] = ${JSON.stringify(VERIFIED, null, 2)};

/**
 * Real verse counts (bible.com, Sept 2026) of the verified versions and the
 * others scanned for the versification survey, for every chapter where a
 * version differs from English numbering or where its candidate systems
 * disagree. Every other chapter has the count the engine would infer.
 * 0 is a chapter the version doesn't have.
 * { bibleId: { "BOOK.chapter": verseCount } }
 */
export const KNOWN_COUNTS: Record<number, Record<string, number>> = ${JSON.stringify(knownCounts)};

/**
 * Hand-checked correction tables shared by several versions
 * (data/overrides/shared/*.map), by name, as \`.vrs\` mapping lines.
 */
export const SHARED_OVERRIDES: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(shared).map(([n, t]) => [n, t.body])), null, 2)};

/**
 * Each version's correction tables (data/overrides/<bible id>.map), by bible
 * id: the shared tables it uses and its own mapping lines.
 */
export const OVERRIDES: Record<number, { use: string[]; own: string }> = ${JSON.stringify(overrides, null, 2)};
`;
writeFileSync(join(root, "src", "data.generated.ts"), out);
console.log("wrote src/data.generated.ts");

// Length-based (Gale-Church) check of a version's verse mapping against a
// reference version whose mapping is trusted. Both versions' verses are put
// in canonical order; the engine's mapping implies an alignment between them
// (verses sharing a canonical verse are one "bead"). A dynamic programme finds
// the cheapest alignment by verse lengths; where it departs from the engine's
// by a clear margin, the stretch is flagged for reading by eye.
import { readFileSync } from "node:fs";
import { BOOKS, buildVersionMap, parseRef, type VersionMap } from "../../packages/core/src/index";

// Bundled into out/ (see sheets.ts), so the text text.py fetched is beside it.
const TEXT = new URL("text/", import.meta.url);

type Text = Record<string, Record<string, string> | null>;
interface Unit {
  key: string; // local "BOOK.c.v" or "BOOK.c.v+w"
  canon: string[]; // canonical refs
  len: number;
  text: string;
  anchors: Set<string>;
}

// Names and numbers, the words most likely to survive translation: a
// capitalised word not starting a sentence, reduced to its first three
// consonants (Gibeon, Gabaon -> gbn; Nicodemus, Nicodème, Никодим -> nkd),
// and numbers of two digits or more in any script.
const CYR: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", ґ: "g", д: "d", е: "e", є: "e", ё: "e", ж: "zh", з: "z", и: "i", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "iu", я: "ia" };
const skeleton = (w: string) => {
  let x = w.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  x = [...x].map((ch) => CYR[ch] ?? ch).join("");
  x = x.replace(/ph/g, "f").replace(/[cq]/g, "k").replace(/[^a-z]/g, "").replace(/[aeiouyhw]/g, "").replace(/(.)\1+/g, "$1");
  return x.slice(0, 3);
};
const ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xe50, 0x1040, 0xff10];
const digit = (d: string) => {
  const cp = d.codePointAt(0)!;
  const z = ZEROS.find((z0) => cp >= z0 && cp < z0 + 10);
  return z === undefined ? "?" : String(cp - z);
};
export function anchorsOf(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.normalize("NFKC").matchAll(/\p{Nd}{2,}/gu)) {
    out.add("#" + [...m[0]].map(digit).join(""));
  }
  for (const m of text.matchAll(/(?<=[\p{L},;:]\s+)(\p{Lu}[\p{L}'’-]{3,})/gu)) {
    const k = skeleton(m[1]);
    if (k.length === 3) out.add(k);
  }
  return out;
}

export function loadText(id: number): { abbr: string; lang: string; chapters: Text } {
  return JSON.parse(readFileSync(new URL(`${id}.json`, TEXT), "utf8"));
}

const bookIdx = new Map(BOOKS.map((b, i) => [b, i]));
const canonKey = (r: string) => {
  const [b, c, v] = parseRef(r);
  return (bookIdx.get(b) ?? 99) * 1e6 + c * 1e3 + v;
};
const letters = (s: string) => (s.match(/[\p{L}\p{N}]/gu) ?? []).length;

/** Units of one book, in canonical order. Titles (verse 0) take the canonical verses before verse 1's. */
export function units(t: Text, map: VersionMap, book: string): Unit[] {
  const out: Unit[] = [];
  for (const [bc, verses] of Object.entries(t)) {
    const [b, cs] = bc.split(".");
    if (b !== book || !verses) continue;
    const c = Number(cs);
    for (const [k, text] of Object.entries(verses)) {
      let canon: string[];
      if (k === "0") {
        const first = map.toCanon.get(`${b}.${c}.1`);
        if (!first) continue;
        const [fb, fc, fv] = parseRef(first);
        canon = [];
        for (let v = 1; v < fv; v++) canon.push(`${fb}.${fc}.${v}`);
        if (!canon.length) canon = [first]; // a title that is part of verse 1 canonically
      } else {
        const nums = k.split("+").map((p) => Number(p.split(".").pop()));
        if (nums.some((n) => !Number.isInteger(n))) continue;
        canon = nums.map((n) => map.toCanon.get(`${b}.${c}.${n}`)).filter((x): x is string => !!x);
        if (canon.length !== nums.length) canon = []; // unmapped (skipped chapter)
      }
      out.push({ key: `${b}.${c}.${k}`, canon, len: letters(text), text, anchors: anchorsOf(text) });
    }
  }
  return out.filter((u) => u.canon.length).sort((a, b) => Math.min(...a.canon.map(canonKey)) - Math.min(...b.canon.map(canonKey)) || a.key.localeCompare(b.key));
}

// log of 2*(1-Phi(|d|)), the Gale-Church match probability.
function logTail(d: number): number {
  const x = Math.abs(d) / Math.SQRT2;
  if (x > 5) return -x * x - Math.log(x * Math.sqrt(Math.PI));
  // erfc, Numerical Recipes erfcc
  const t = 1 / (1 + 0.5 * x);
  const e = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return Math.log(Math.max(e, 1e-300));
}
const PRIOR: Record<string, number> = { "1-1": 0.89, "1-0": 0.005, "0-1": 0.005, "2-1": 0.0445, "1-2": 0.0445, "2-2": 0.011, "3-1": 0.002, "1-3": 0.002 };
const MOVES = Object.keys(PRIOR).map((k) => k.split("-").map(Number) as [number, number]);

export interface Params { c: number; s2: number; alpha: number }

function beadCost(l: number, r: number, type: string, p: Params): number {
  const prior = -Math.log(PRIOR[type] ?? 0.0005);
  if (l === 0 && r === 0) return prior;
  const mean = (l + r / p.c) / 2; // symmetric: scale r into local units
  const d = (l - r * p.c) / Math.sqrt(Math.max(mean, 1) * p.s2);
  return prior - logTail(d);
}

interface Bead { li: number[]; ri: number[] }

/** The engine's alignment: connected components over shared canonical verses. */
function engineBeads(L: Unit[], R: Unit[]): Bead[] {
  const byCanonR = new Map<string, number[]>();
  R.forEach((u, i) => u.canon.forEach((c) => (byCanonR.get(c) ?? byCanonR.set(c, []).get(c)!).push(i)));
  const byCanonL = new Map<string, number[]>();
  L.forEach((u, i) => u.canon.forEach((c) => (byCanonL.get(c) ?? byCanonL.set(c, []).get(c)!).push(i)));
  const seenL = new Set<number>(), seenR = new Set<number>();
  const beads: Bead[] = [];
  const visit = (start: number) => {
    const b: Bead = { li: [], ri: [] };
    const stack: ["L" | "R", number][] = [["L", start]];
    seenL.add(start);
    while (stack.length) {
      const [side, i] = stack.pop()!;
      if (side === "L") {
        b.li.push(i);
        for (const c of L[i].canon) for (const j of byCanonR.get(c) ?? []) if (!seenR.has(j)) { seenR.add(j); stack.push(["R", j]); }
      } else {
        b.ri.push(i);
        for (const c of R[i].canon) for (const j of byCanonL.get(c) ?? []) if (!seenL.has(j)) { seenL.add(j); stack.push(["L", j]); }
      }
    }
    b.li.sort((x, y) => x - y);
    b.ri.sort((x, y) => x - y);
    beads.push(b);
  };
  L.forEach((_, i) => { if (!seenL.has(i)) visit(i); });
  R.forEach((_, j) => { if (!seenR.has(j)) beads.push({ li: [], ri: [j] }); });
  const minKey = (b: Bead) => Math.min(...b.li.flatMap((i) => L[i].canon.map(canonKey)), ...b.ri.flatMap((j) => R[j].canon.map(canonKey)));
  beads.sort((a, b) => minKey(a) - minKey(b));
  return beads;
}

const sum = (xs: number[], u: Unit[]) => xs.reduce((s, i) => s + u[i].len, 0);
function shared(L: Unit[], li: number[], R: Unit[], ri: number[]): number {
  const a = new Set(li.flatMap((i) => [...L[i].anchors]));
  let n = 0;
  for (const x of new Set(ri.flatMap((j) => [...R[j].anchors]))) if (a.has(x)) n++;
  return Math.min(n, 4);
}
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, k) => a + k);

export function estimate(pairs: [number, number][]): Params {
  let tl = 0, tr = 0;
  for (const [l, r] of pairs) { tl += l; tr += r; }
  const c = tl / tr;
  const zs = pairs.filter(([l, r]) => l + r > 0).map(([l, r]) => (l - r * c) ** 2 / Math.max((l + r / c) / 2, 1)).sort((a, b) => a - b);
  const trimmed = zs.slice(0, Math.floor(zs.length * 0.95));
  const s2 = trimmed.reduce((s, z) => s + z, 0) / Math.max(trimmed.length, 1);
  return { c, s2: Math.max(s2, 0.5), alpha: 3 };
}

export interface Flag { book: string; local: string[]; ref: string[]; engine: number; best: number; bestBeads: string }

/** Compare engine vs DP alignment of one book; returns flagged stretches. */
export function checkBook(L: Unit[], R: Unit[], p: Params, margin: number): { flags: Flag[]; irregular: string[] } {
  const beads = engineBeads(L, R);
  const irregular: string[] = [];
  // engine path must be monotone ranges to be comparable
  let li = 0, ri = 0;
  const cuts = new Set<string>(["0,0"]);
  const engineCostAt: number[] = []; // cost of bead ending at each cut
  const path: { i: number; j: number; cost: number }[] = [{ i: 0, j: 0, cost: 0 }];
  let acc = 0;
  for (const b of beads) {
    const contiguous = (xs: number[], start: number) => xs.every((x, k) => x === start + k);
    if (!(contiguous(b.li, li) && contiguous(b.ri, ri))) {
      irregular.push([...b.li.map((i) => L[i].key), "|", ...b.ri.map((j) => R[j].key)].join(" "));
      // resync: jump past
      li = Math.max(li, ...b.li.map((x) => x + 1));
      ri = Math.max(ri, ...b.ri.map((x) => x + 1));
      acc += 20;
      path.push({ i: li, j: ri, cost: acc });
      continue;
    }
    const type = `${b.li.length}-${b.ri.length}`;
    acc += beadCost(sum(b.li, L), sum(b.ri, R), type, p) - p.alpha * shared(L, b.li, R, b.ri);
    li += b.li.length;
    ri += b.ri.length;
    cuts.add(`${li},${ri}`);
    path.push({ i: li, j: ri, cost: acc });
    engineCostAt.push(acc);
  }
  if (irregular.length) return { flags: [], irregular };
  const n = L.length, m = R.length;
  // band around engine path
  const center = new Array(n + 1).fill(0);
  for (const pt of path) center[pt.i] = pt.j;
  for (let i = 1; i <= n; i++) if (center[i] < center[i - 1]) center[i] = center[i - 1];
  const W = 8;
  const INF = 1e18;
  const D = new Map<number, { cost: number; prev: number; type: string }>();
  const key = (i: number, j: number) => i * (m + 1) + j;
  D.set(0, { cost: 0, prev: -1, type: "" });
  const prefL = [0], prefR = [0];
  for (const u of L) prefL.push(prefL[prefL.length - 1] + u.len);
  for (const u of R) prefR.push(prefR[prefR.length - 1] + u.len);
  for (let i = 0; i <= n; i++) {
    const lo = Math.max(0, center[i] - W), hi = Math.min(m, center[i] + W);
    for (let j = lo; j <= hi; j++) {
      if (i === 0 && j === 0) continue;
      let best = { cost: INF, prev: -1, type: "" };
      for (const [a, b] of MOVES) {
        if (i - a < 0 || j - b < 0) continue;
        const prev = D.get(key(i - a, j - b));
        if (!prev) continue;
        const cost = prev.cost + beadCost(prefL[i] - prefL[i - a], prefR[j] - prefR[j - b], `${a}-${b}`, p) - p.alpha * shared(L, range(i - a, i), R, range(j - b, j));
        if (cost < best.cost) best = { cost, prev: key(i - a, j - b), type: `${a}-${b}` };
      }
      if (best.prev >= 0) D.set(key(i, j), best);
    }
  }
  const end = D.get(key(n, m));
  if (!end) return { flags: [], irregular: ["no DP path"] };
  // recover dp path cuts
  const dpPath: { i: number; j: number; cost: number; type: string }[] = [];
  let k = key(n, m);
  while (k >= 0) {
    const s = D.get(k)!;
    dpPath.push({ i: Math.floor(k / (m + 1)), j: k % (m + 1), cost: s.cost, type: s.type });
    k = s.prev;
  }
  dpPath.reverse();
  const engineAt = new Map(path.map((pt) => [`${pt.i},${pt.j}`, pt.cost]));
  const flags: Flag[] = [];
  // walk common cuts
  let lastCommon = dpPath[0];
  let lastEngineCost = 0;
  for (let t = 1; t < dpPath.length; t++) {
    const pt = dpPath[t];
    const ec = engineAt.get(`${pt.i},${pt.j}`);
    if (ec === undefined) continue;
    const segDp = pt.cost - lastCommon.cost;
    const segEng = ec - lastEngineCost;
    const beadsDp = dpPath.slice(dpPath.indexOf(lastCommon) + 1, t + 1).map((q) => q.type);
    const inner = beadsDp.slice(1, -1);
    const offset = inner.includes("1-1") || inner.includes("1-0") || inner.includes("0-1");
    const structural = offset || (beadsDp.length > 1 && segEng - segDp > 3 * margin && !beadsDp.every((b) => b === "2-2"));
    if (segEng - segDp > margin && structural) {
      const ls = L.slice(lastCommon.i, pt.i).map((u) => u.key);
      const rs = R.slice(lastCommon.j, pt.j).map((u) => u.key);
      flags.push({ book: L[0]?.key.split(".")[0], local: ls, ref: rs, engine: segEng, best: segDp, bestBeads: beadsDp.join(" ") });
    }
    lastCommon = pt;
    lastEngineCost = ec;
  }
  return { flags, irregular };
}

export interface Report { flags: Flag[]; irregular: string[]; skipped: string[]; params: Params; noRef: string[] }

export function check(targetId: number, refId: number, margin = 6): Report {
  const t = loadText(targetId), r = loadText(refId);
  const tm = buildVersionMap(t.abbr, targetId).map;
  const rm = buildVersionMap(r.abbr, refId).map;
  const skipped: string[] = [];
  for (const b of BOOKS) for (const c of tm.skippedChapters(b)) skipped.push(`${b}.${c}`);
  // Only verses both have: a verse one side lacks (KRV has no Psalm titles,
  // NIV no Matthew 17:21) would otherwise cost a gap the DP avoids by merging.
  const both = (L: Unit[], R: Unit[]) => {
    const inR = new Set(R.flatMap((u) => u.canon)), inL = new Set(L.flatMap((u) => u.canon));
    return [L.filter((u) => u.canon.some((c) => inR.has(c))), R.filter((u) => u.canon.some((c) => inL.has(c)))] as const;
  };
  const perBook = BOOKS.map((b) => [b, ...both(units(t.chapters, tm, b), units(r.chapters, rm, b))] as const);
  // estimate params from engine 1-1 beads
  const pairs: [number, number][] = [];
  for (const [, L, R] of perBook) {
    for (const bd of engineBeads(L, R)) if (bd.li.length === 1 && bd.ri.length === 1) pairs.push([L[bd.li[0]].len, R[bd.ri[0]].len]);
  }
  const params = estimate(pairs);
  const flags: Flag[] = [];
  const irregular: string[] = [];
  const noRef: string[] = [];
  for (const [b, L, R] of perBook) {
    if (!L.length) continue;
    if (!R.length) { noRef.push(b); continue; }
    const res = checkBook(L, R, params, margin);
    flags.push(...res.flags);
    irregular.push(...res.irregular.map((x) => `${b}: ${x}`));
  }
  return { flags, irregular, skipped, params, noRef };
}

export function flagged(target: number, refs: number[], margin = 6) {
  const reports = refs.map((r) => check(target, r, margin));
  // keep a flag only when every reference flags an overlapping stretch
  const sets = reports.map((rep) => rep.flags.map((f) => ({ f, set: new Set(f.local) })));
  const agreed = sets[0].filter(({ set }) => sets.slice(1).every((other) => other.some((o) => [...set].some((k) => o.set.has(k)))));
  return { reports, agreed: agreed.map(({ f }) => f) };
}

// Review sheets: for one version, every chapter whose numbering isn't plain
// (its count differs from English, English and Hebrew differ there, or its
// mapping isn't the identity), the verses at each boundary beside the NIV and
// LSG verses the engine pairs them with; the aligner's flagged stretches in
// full; and skipped chapters in full, for writing tables.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BOOKS, Standard, buildVersionMap, parseRef, type VersionMap } from "../../packages/core/src/index";
import { flagged, loadText } from "./align";

const OUTDIR = fileURLToPath(new URL("sheets/", import.meta.url));
mkdirSync(OUTDIR, { recursive: true });

const REFS = [111, 93];
const std = Standard.load();
const clip = (s: string | undefined, n = 220) => (s === undefined ? "—" : s.length > n ? s.slice(0, n) + "…" : s);

type Chapters = Record<string, Record<string, string> | null>;
interface V { id: number; abbr: string; ch: Chapters; map: VersionMap }
const load = (id: number): V => {
  const t = loadText(id);
  return { id, abbr: t.abbr, ch: t.chapters, map: buildVersionMap(t.abbr, id).map };
};

/** A version's verse text by local ref, merged spans found by any of their verses. */
function textOf(v: V, local: string): string | undefined {
  const [b, c, n] = parseRef(local);
  const verses = v.ch[`${b}.${c}`];
  if (!verses) return undefined;
  if (verses[String(n)] !== undefined) return verses[String(n)];
  for (const [k, t] of Object.entries(verses)) if (k.split("+").map(Number).includes(n)) return `[${k}] ${t}`;
  return undefined;
}

function refLine(r: V, canon: string): string {
  const locals = r.map.fromCanon.get(canon) ?? [];
  if (!locals.length) {
    // a canonical verse the reference folds into its title (Hebrew title verses)
    const [b, c, n] = parseRef(canon);
    const title = r.ch[`${b}.${c}`]?.["0"];
    const first = r.map.toCanon.get(`${b}.${c}.1`);
    if (title && first && parseRef(first)[2] > n) return `${r.abbr} ${b} ${c}:title: ${clip(title)}`;
    return `${r.abbr}: (no verse at canonical ${canon})`;
  }
  return locals.map((l) => `${r.abbr} ${l.replace(/\./, " ").replace(/\./, ":")}: ${clip(textOf(r, l))}`).join("\n      ");
}

function block(v: V, refs: V[], locals: string[]): string {
  const out: string[] = [];
  for (const l of locals) {
    const canon = v.map.toCanon.get(l);
    out.push(`  ${v.abbr} ${l.replace(/\./, " ").replace(/\./, ":")} → ${canon ?? "UNMAPPED"}: ${clip(textOf(v, l))}`);
    if (canon) for (const r of refs) out.push(`      ${refLine(r, canon)}`);
  }
  return out.join("\n");
}

export function sheet(id: number): { path: string; boundaries: number; flags: number; skipped: string[] } {
  const v = load(id);
  const refs = REFS.filter((r) => r !== id).map(load);
  const parts: string[] = [];
  let boundaries = 0;
  const skipped: string[] = [];
  for (const b of BOOKS) {
    for (const c of v.map.skippedChapters(b)) skipped.push(`${b}.${c}`);
    for (const c of v.map.chapters(b)) {
      const n = v.map.counts[b][c];
      const eng = std.count("eng", b, c), org = std.count("org", b, c);
      const canon = (k: number) => v.map.toCanon.get(`${b}.${c}.${k}`);
      let identity = true;
      for (let k = 1; k <= n; k++) if (canon(k) !== `${b}.${c}.${k}`) identity = false;
      const title = v.ch[`${b}.${c}`]?.["0"];
      if (identity && n === eng && eng === org && !title) continue;
      const show = new Set<number>([1, n]);
      for (let k = 2; k <= n; k++) {
        const [pb, pc, pv] = parseRef(canon(k - 1)!);
        const [qb, qc, qv] = parseRef(canon(k)!);
        if (!(pb === qb && pc === qc && qv === pv + 1)) { show.add(k - 1); show.add(k); }
      }
      const list = [...show].filter((k) => k >= 1 && k <= n).sort((a, z) => a - z);
      boundaries++;
      const head = `### ${b} ${c} (${n} verses; eng ${eng}, org ${org}; scheme ${v.map.schemes[b][c]})`;
      const t = title ? `  ${v.abbr} title: ${clip(title)}\n` : "";
      parts.push(`${head}\n${t}${block(v, refs, list.map((k) => `${b}.${c}.${k}`))}`);
    }
  }
  const { agreed } = flagged(id, refs.map((r) => r.id));
  const flagParts = agreed.map((f) => `### flagged: ${f.local[0]} … ${f.local[f.local.length - 1]} (gain ${(f.engine - f.best).toFixed(1)}; best ${f.bestBeads})\n${block(v, refs, f.local.filter((k) => !k.endsWith(".0")).flatMap((k) => { const [b, c, rest] = k.split("."); return rest.split("+").map((x) => `${b}.${c}.${x}`); }))}`);
  const skipParts = skipped.map((bc) => {
    const verses = v.ch[bc] ?? {};
    const lines = Object.entries(verses).map(([k, t]) => `  ${v.abbr} ${bc}:${k}: ${clip(t, 400)}`);
    const [b, c] = bc.split(".");
    const refLines = refs.map((r) => {
      const rc = r.ch[bc] ?? {};
      return Object.entries(rc).map(([k, t]) => `      ${r.abbr} ${bc}:${k} → ${r.map.toCanon.get(`${b}.${c}.${k}`) ?? "?"}: ${clip(t, 400)}`).join("\n");
    });
    return `### skipped: ${bc} (${Object.keys(verses).length} verse keys)\n${lines.join("\n")}\n${refLines.join("\n")}`;
  });
  const path = `${OUTDIR}${id}.md`;
  writeFileSync(path, [`# ${v.abbr} (${id})`, "## Boundaries", ...parts, "## Flagged by the aligner", ...flagParts, "## Skipped chapters", ...skipParts].join("\n\n") + "\n");
  return { path, boundaries, flags: agreed.length, skipped };
}

if (process.argv[1]?.endsWith("sheets.mjs")) {
  for (const id of process.argv.slice(2).map(Number)) {
    const r = sheet(id);
    console.log(`${id}: ${r.boundaries} boundary chapters, ${r.flags} flags, skipped ${r.skipped.join(",") || "none"} -> ${r.path}`);
  }
}

# Handover: versification next steps

For whoever picks up the five follow-ups from
[versification-survey.md](versification-survey.md). Read
[AGENTS.md](../AGENTS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md) first; this
file only holds what they don't: findings, data sources and traps from the
session that produced the survey (Sept 2026).

## What you have

- `tools/versification-survey/`
  - `scan.py`: the scanner. `python3 scan.py <bible ids…>` writes
    `out/<id>.json` (gitignored), resumable. ~50 s per version at 6
    concurrent requests.
  - `analyse.py`: classifies every chapter against six schemes and simulates
    the current engine. Reads `out/` if present, else `data/counts.json`.
    `python3 analyse.py` rewrites `data/analysis.json` and prints a summary.
    It imports the Python prototype's engine (`tools/python-cli`), which was
    checked verse-for-verse identical to the TypeScript one for AMP, NIV, LSG
    and S21 — but the TS engine has since gained `members`/newcomer logic that
    doesn't affect mapping. For anything the app ships, test in
    `packages/core`.
  - `vrs/`: SIL libpalaso versification files (MIT): `eng`, `org` (same as
    `packages/core/data/`), plus `rso`, `rsc`, `lxx`, `vul`, not yet bundled.
  - `data/counts.json`: the scan, compact. `{ "<bible id>": { abbr, title,
    lang, vrs, counts: { BOOK: [max verse number per chapter, 0 = absent] },
    gaps: { "BOOK.C": [missing verse numbers] }, merged: ["JHN.3.1+JHN.3.2", …] } }`.
    Counts are the **highest verse number present**, not the number of verses,
    so omitted verses (NIV Mat 17:21) don't shift anything.
  - `data/candidates.json`: every text version per language code, with
    YouVersion's `vrs` label, for choosing more versions.
- The scanner was validated against the official API index for LSG: all 1,189
  chapters identical.

## Data sources (not documented anywhere official)

**YouVersion's own API behind bible.com** (unofficial; fine for one-off
research at a gentle rate, don't make the app depend on it):

- Base `https://bible.youversionapi.com/3.1/`, headers:
  `Accept: application/json`, `Referer: https://web.youversionapi.com`,
  `User-Agent: Web App: Production`, `X-YouVersion-Client: youversion`,
  `X-YouVersion-App-Platform: web`, `X-YouVersion-App-Version: 3`.
  Responses are wrapped in `{"response": {"data": …}}`. Works from plain
  Python; no bot challenge (unlike bible.com pages, which serve curl a
  "Client Challenge").
- `version.json?id=<id>`: metadata, `vrs` label, `books[].chapters[]` with
  `canonical` flags (no verse counts).
- `chapter.json?id=<id>&reference=JHN.3`: ~12 KB; `content` is HTML where each
  verse carries `data-usfm="JHN.3.16"`; merged verses read
  `data-usfm="JHN.3.16+JHN.3.17"`. 404 when the chapter doesn't exist.
- `versions.json?language_tag=<tag>&type=all`: versions per language, with
  `vrs`. `languages.json` is a 404. Chinese is `zho` (Simplified, e.g. CUNPSS
  48) and `zho_tw` (Traditional, CUNP 46); `cmn` has only 2 versions.
- On bible.com itself (same origin, e.g. from a browser), `/api/bible/version/<id>`
  returns the same metadata including `vrs`.

**The official Platform API** (`api.youversion.com`, what the app uses):

- Does **not** expose `vrs`.
- `/v1/bibles?language_ranges[]=spa&all_available=true&page_size=99` lists only
  the platform's subset (Spanish: 9 versions; RVR1960 isn't there).
  `page_size` must be ≤ 99.
- `/v1/bibles/<id>/index` works only for versions licensed to the app key
  (LSG yes; NIV/AMP 403; S21 404; 3 of the 9 Spanish ones). Highlights work
  for all of them regardless.

## YouVersion's `vrs` label

Values seen: `eng`, `org`, `rso`, `rsc`, `lxx`, `vul`, and `null` (some
historical or partial texts). It's per version and coarse: LSG is `org` but
uses English numbering in Malachi/Joel and neither in Job 38–41. Of the 54
surveyed: 38 `eng`, 13 `org`, one each `rso` (SYNO 400), `rsc` (NRT 143),
`lxx` (UBIO 186). Other `lxx`/`rso`/`rsc`/`vul` versions exist in
`candidates.json` (Ukrainian NPU/UTT, Polish NT NPD, Indonesian PBTB2,
Portuguese AVM, English CPDV/DRC1752, most Russian versions).

## 1. Block unsupported numbering

Why first: SYNO, NRT and UBIO get 87–169 verses mapped onto the wrong verse
today. Verified on text: Synodal Psalm 91 ("Псалом. Песнь на день
субботний… Благо есть славить Господа") is English Psalm 92, but the engine
treats it as Psalm 91 because the verse counts coincide.

The app can't read `vrs` from the official API, so options are:

- **Bundled labels** for known ids (the 54 plus `candidates.json`); cheap and
  exact for those, blind for others.
- **A count heuristic** that works for any version: the three unsafe versions
  leave 2,300–3,000 verses unmapped (≈ 130–150 chapters) while every
  `eng`/`org` version leaves at most ~500 (VIE1925) and usually under 100.
  Psalms is the tell: in Synodal/LXX numbering most chapters from 9 on fit
  neither `eng` nor `org`. A rule like "more than N Psalms chapters skipped" or
  "skipped verses > 1,000" separates the groups in this data; check the
  threshold against `analysis.json` (`engine_skipped_verses`).
- Probably both: labels when known, heuristic otherwise.

It must hold everywhere a version enters: the add form
(`apps/pwa/src/components/VersionsCard.tsx`, which calls
`canReadHighlights`), `resolveVersions` in `apps/pwa/src/lib/versions.ts`
(settings saved before the fix may already contain such a version), and
ideally the engine (`buildVersionMap` returning a source like `"unsupported"`
that `runSync` refuses). New strings go in both `apps/pwa/src/i18n/en.ts` and
`fr.ts`; the i18n tests will enforce parity.

## 2. Support Synodal, Septuagint and Vulgate

- Generalise `Standard` in `packages/core/src/versification.ts` from
  `eng`+`org` to all six: bundle the four extra `.vrs` files through
  `packages/core/scripts/gen-data.mjs` (they're 130 KB together).
- `.vrs` mapping lines read `<this scheme> = <org>`. Some quirks in the new
  files: titles are verse 0 on **both** sides in places (`rso`: `PSA 10:0-7 =
  PSA 11:0-7`), so drop pairs whose source *or* target verse is 0; uneven
  ranges and lettered splits (`ESG 1:1a`) are skipped by the existing parser,
  which is fine for the 66-book canon.
- Detection: with six schemes, many chapters fit several (`analysis.json`
  `other_fits` shows LSG chapters also fitting `vul` by coincidence). Limit
  candidates to {label, `eng`, `org`} when the label is known, and use the
  label to break ties before the book-majority rule. Keep the existing
  collision check (two chapters on different schemes claiming one canonical
  verse → skip both).
- Target, measured with `analyse.py` after porting the logic (or a TS
  equivalent over `counts.json`): SYNO, NRT and UBIO with **0 misplaced**
  verses and a small skip count, and **no change** for the other 51 versions.
  Then spot-check the text of a few mapped Psalms and Daniel 5–6 /
  Jeremiah 34–36 against NIV.

## 3. Bundle the scanned counts

- Today `packages/core/data/known_counts.json` holds only exceptions, keyed by
  abbreviation, mapped to ids by the `BUILTIN` list in `gen-data.mjs`;
  overrides are files named by abbreviation. **Key by bible id instead**:
  YouVersion abbreviations aren't unique (`NVI-S` is both 128 and 2664, `ARC`
  both 212 and 3407).
- Store exceptions only (chapters where the count differs from `eng`, plus
  every chapter where schemes disagree), as now; the full table would be
  ~650 KB.
- `isBuiltinVersion` currently drives the "Verified numbering" badge. Add a
  middle tier ("counts known", unverified) so scanned-but-not-hand-checked
  versions don't claim to be verified; promote a version once its
  fits-no-system chapters are handled and a few mappings are checked by eye.

## 4. Shared correction tables

Chapters fitting no system, by family (from `versification-survey.md`):

- **Dutch/Indonesian (HSV 1990, Het Boek 75, TB 306):** Neh 8, Job 39,
  Hos 1, Hos 2, and skips in Exo 5–6, 1 Sam 20, Job 38–41, Hag 1–2. HSV and TB
  are identical, which suggests a shared Statenvertaling-style numbering; one
  table may serve all three.
- **Revelation 12 with 17 verses** (most English-numbered versions):
  generalise `overrides/NIV.map` (`REV 12:1-17 = REV 12:1-17`) rather than
  copying it per version.
- **3 John with 14 verses** (KJV tradition: KJV, NKJV, DELUT, BDC, …): find
  where the 15th verse went by reading the text.
- One-offs: KRV Song 6 (14 verses), NR06 and UKRK Psalm 13 (5), VIE1925 1 Kings
  6, PBG Jeremiah 29, NABRE Psalm 2 (11); LSG's Job 39 and Mark 9 are already
  handled in `overrides/LSG.map`.

How the LSG tables were built: align the version's text verse by verse with
a closely related version whose numbering is known (LSG against S21, by word
overlap), then with NIV for English numbering, and read every boundary by eye.
`chapter.json` gives you the text; the `data-usfm` attributes split it into
verses. Add each checked verse pair to `packages/core/test/versification.test.ts`.

## 5. Merged verses

Common in paraphrases and dynamic translations: MSG 8,085 spans, JCB 2,020,
Het Boek 1,285, BIMK 643. Examples to test with: MSG (97) `JHN.3.1+JHN.3.2`,
`PSA.23.1+PSA.23.2+PSA.23.3`; JCB (83) `ROM.8.20+ROM.8.21`.

Unknown: when a user highlights a merged span in the YouVersion app, does
`GET /v1/highlights` report every verse in it, or one? And does the API accept
a `POST` for a single verse inside a span? The engine maps verse by verse, so
either answer is workable, but it needs knowing. This requires the user's
account: **ask the user** to highlight a merged span in the app, then read the
chapter; don't write test highlights to their account without asking
(AGENTS.md).

## Environment notes

- **npm 10 crashes** installing this workspace ("Cannot read properties of null
  (reading 'edgesOut')"). Use Node 24 or `npx npm@11 install`. npm 11 withholds
  esbuild's install script by default; the build works anyway.
- The dev server is pinned to **port 8001** because
  `http://localhost:8001/callback` is the callback registered for the app key.
  `npm run dev` is for editing (no CSP, no service worker); `npm run preview`
  serves the production build (CSP, offline) after `npm run build`.
- The app key is in `apps/pwa/.env.local`; the Python CLI's key and tokens are
  in `tools/python-cli/config.json` and `.yvsync/`. All gitignored.
- The desktop app's built-in browser pane can't run service workers and is
  signed in to the user's bible.com account: read public pages only. For UI
  checks, a throwaway headless Chrome (fresh `--user-data-dir`, driven over the
  DevTools protocol) with a fake token in IndexedDB worked well.
- The user's conventions beyond the docs: no licence headers in files;
  prose commit messages ending with the `Co-Authored-By` line; commit and push
  only when asked.

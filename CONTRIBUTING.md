# Developing Bible Version Sync

Everything a contributor needs. The [README](README.md) is for people using the
app; this is for people changing it; [AGENTS.md](AGENTS.md) holds the handful
of rules that bind coding agents specifically.

## Running it

Needs Node 24 (or npm 11) and a YouVersion Platform app key. npm 10 crashes
installing this workspace ("Cannot read properties of null (reading
'edgesOut')"); on an older Node, `npx npm@11 install` works. npm 11 holds back
esbuild's install script by default, which the build doesn't need.

```bash
npm install
cp apps/pwa/.env.example apps/pwa/.env.local   # put your app key in it
npm run dev                                     # http://localhost:8001
```

`npm run dev` is for editing: instant reload, but no Content-Security-Policy
and no service worker. `npm run preview` serves the production build from
`apps/pwa/dist/` (run `npm run build` first) with both, so use it to check
what users will get.

`npm run coverage` runs the tests with coverage (lcov in each package's
`coverage/`); CI uploads it to Codecov.

`npm run check` is the gate: it regenerates the bundled data, typechecks every
package, runs all tests and builds the app. Run it before every commit.

**App key and callback.** Create an app at
<https://platform.youversion.com>. The key goes in `apps/pwa/.env.local` as
`VITE_YV_APP_KEY` (git ignores that file). The app's callback URL must be
`<origin><base>callback`, where the base is `/` except when deployed below a
domain's root; the dev server is pinned to port 8001 so that
`http://localhost:8001/callback` stays valid. The key isn't a secret — it's an
OAuth client id and ends up in the built JavaScript — but keep your real value
out of the repository anyway.

**Deploying.** Pushes to `main` deploy to GitHub Pages at
<https://eusebius.tech/bible-version-sync/> (`.github/workflows/deploy.yml`).
The custom domain belongs to the `eugenius1.github.io` user site, so this
project is served under `/bible-version-sync/`, and the build is run with
`BASE_PATH=/bible-version-sync/`. The app key comes from the `VITE_YV_APP_KEY`
repository variable (Settings → Secrets and variables → Actions → Variables),
and `https://eusebius.tech/bible-version-sync/callback` must be registered in
the portal. Pages has no SPA fallback, so the build copies `index.html` to
`callback.html`, which Pages serves at `/callback`.

To host it elsewhere, `npm run build` writes a static site to `apps/pwa/dist/`
(set `BASE_PATH=/path/` to serve it below a domain's root). Set
`VITE_YV_APP_KEY` at build time and register `<origin><base>callback`. The production build carries a
strict Content-Security-Policy (see `apps/pwa/vite.config.ts`).

## Layout

| Path | What |
|---|---|
| `packages/core` | The sync engine: verse mapping, merge rules, API client, sign-in helpers, and the runner that ties them together. Framework-free TypeScript, so a future server can use it unchanged. |
| `packages/core/data` | Verse-numbering data and correction tables, bundled into `src/data.generated.ts` by `npm run gen -w @bvs/core`. |
| `apps/pwa` | The web app: Vite, React, Tailwind CSS v4, lucide icons, Dexie (IndexedDB), vite-plugin-pwa. |
| `tools/python-cli` | The original Python prototype, kept for reference. The TypeScript mapping was checked against it verse for verse. |

## How verses are matched

Every verse is converted to a **canonical** reference in the Hebrew/Greek
"original" numbering (`org.vrs`), and two versions agree on a verse when their
verses map to the same canonical reference.

Two standard systems explain almost everything: **English** numbering
(`eng.vrs`, with its mappings to the original) and the **original** numbering
itself. Versions don't pick one: Louis Segond uses original numbering in the
Psalms and Exodus 7–8, English numbering in Malachi and Joel, and neither in
Job 38–41. So the system is detected **per chapter**, by comparing the chapter's
real verse count with each candidate system's count
(`VersionMap.build` in `packages/core/src/versification.ts`):

- The candidates are `eng` and `org`, plus the version's YouVersion label when
  that's Russian Synodal (`rso`, `rsc`), Septuagint (`lxx`) or Vulgate (`vul`).
  Those four are never offered to other versions: their chapter counts often
  coincide with an English or Hebrew chapter holding different text (Synodal
  Psalm 91 has English Psalm 91's count and Hebrew Psalm 92's text), so they
  only come in on the label's say-so. The official API doesn't expose the
  label, so `VRS_LABELS` bundles it by bible id from the survey.
- A chapter matching one candidate uses it; one matching none is skipped.
- A chapter matching several takes the one that fits most of the book's
  chapters where the candidates disagree, then `eng`, then the label. The book
  outranks the label because labels are loose: UBIO is labelled `lxx` but
  follows Hebrew order in Jeremiah, where two `lxx` chapters have the Hebrew
  counts by coincidence.
- Chapters without a known count take the book's pick; with nothing known,
  the label, else English.
- If two chapters on different systems would claim the same canonical verse,
  both are skipped rather than guessed.
- Chapters that follow no system are described by hand in a **correction
  table**, `packages/core/data/overrides/<bible id>.map`, in `.vrs` mapping syntax:
  `LOCAL = CANONICAL`. Every chapter such a table touches uses only the table.
- A departure several versions share (Revelation 12 in 17 verses, 3 John in
  14, Job 38–41 as Louis Segond breaks them) is written once, as a **shared
  table** in `overrides/shared/<name>.map`, and each version that follows it
  names it with a `use <name>` line in its own table. Nothing is applied by
  matching counts alone: the same count can hide different text (Het Boek has
  Haggai 2 in 24 verses like HSV but divides it elsewhere), so a version gets a
  table only once someone has read its text. `gen-data.mjs` rejects a table
  whose chapters don't have the counts it was written for (its highest verse
  per chapter) in the version that uses it, two tables touching one chapter,
  a shared table nobody uses, and any line it can't parse. At run time a
  chapter whose real count (from the API index) disagrees with its table is
  skipped.

The `rso`, `rsc`, `lxx` and `vul` tables are read from
`packages/core/data/`, with a few corrections checked against the
text (`SUPPLEMENTAL` in `versification.ts`), and a mapping into another of the
66 books is dropped: the sync plans one book at a time, so such a verse would
look unread, and so removed, when the other book syncs.
`packages/core/test/survey.test.ts` runs the engine over all 328 scanned
versions and pins what each one skips.

**A version no system explains is refused.** Without a label, only `eng`
and `org` are candidates, and counts can't say which of the other four a
version follows (UBIO fits `lxx` in 131 chapters and `rsc` in 130), so an
unlabelled Synodal or Septuagint version would have its Psalms land one
psalm off. `buildVersionMap` counts the chapters whose known count fits
neither `eng` nor `org` (leaving out chapters it lacks and those a
correction table describes) and, above `MAX_UNFIT_CHAPTERS` (80), returns an
empty map flagged `unsupported`, unless the version is labelled `rso`, `rsc`,
`lxx` or `vul`. English and Hebrew numbered versions reach 35 (UKRK), Synodal
and Septuagint ones 131 to 187. The sync leaves such a version out of
reading, planning and writing and keeps its snapshot as it was (a version
with nothing read would otherwise look like every highlight removed); the
add form refuses one, and a saved one shows "Numbering not supported". A
version with no counts at all can't be checked, and is assumed English as
before.

Verse counts come from, in order: `packages/core/data/known_counts.json`
(the four verified versions, the other 50 surveyed, 54 more from the
hand-made ranking in `scripts/popular.mjs` and 220 smaller unlabelled ones
scanned for coverage, by bible id), then the
YouVersion API's `/v1/bibles/{id}/index` (only for versions the app key may
read), then an assumption of the version's label or English numbering. The
app shows which as a badge: "Verified numbering", "Verse counts known",
"Numbering from YouVersion", "Numbering assumed" or "Numbering not
supported". `known_counts.json` holds
only the chapters the engine can't infer: those where a version differs from
English, and those where its candidate systems disagree (the engine needs
those to pick each book's system). A chapter the version lacks is stored as
0 so it isn't read, and a whole book it lacks as one `"BOOK": 0` (many
versions are a Gospel or two). Everything else would get the same count and
system anyway, which keeps the 328 versions to about 33,000 entries.

[docs/versification-survey.md](docs/versification-survey.md) records how 54
widely used versions in 20 languages fared against the two-system engine,
which is what led to the other four. The scanner and data behind it are in [tools/versification-survey](tools/versification-survey/README.md).

**Adding a version's counts.** Scan it (`tools/versification-survey/scan.py`),
add it to the survey's `data/counts.json` (`scan.py --add`), and run
`npm run import-survey -w @bvs/core`, which rewrites that version's
exceptions in `known_counts.json`, every label in `labels.json` and every
name in `names.json`. Review the diff: the app never reads `tools/` itself, so
what ships is exactly what's in `packages/core/data`. `survey.test.ts` fails if
the bundle stops reproducing the scan. The version then shows "Verse counts
known".

**Version names.** The official API doesn't name most versions (their text
isn't licensed to the app key), so `names.json` has the abbreviation, title
and language bible.com shows for all 3,864 versions YouVersion lists. That's
100 KB gzipped, more than half the rest of the app, so it isn't in the main
bundle: `gen-data.mjs` writes it to `src/names.generated.ts`, which
`loadVersionNames()` imports on demand, and Vite makes a chunk of its own.
The versions card starts the load when it mounts, and `versionName()`
returns nothing until it's done. YouVersion's language tags become BCP 47
(`eng` → `en`, `zho_tw` → `zh-TW`, `hin_ro` → `hi-Latn`; a suffix with no
BCP 47 equivalent, like `gax_ars` for Arsi Oromo, is dropped). YouVersion has
two abbreviations per version, and bible.com shows
`local_abbreviation` (NIV, НРП), not `abbreviation` (NIV11, NRT); the survey's
`names.py` records it. The verified versions are named the same way, and
`gen-data.mjs` checks that `verified.mjs` agrees. The app shows the title
beside the name the person chose, falls back to "Version {id}" once the
names are loaded and don't have it, and offers the abbreviation as the name when the person gives only a
number. Titles are in the version's own script, so they're rendered with `lang` (Japanese glyphs rather than
Chinese) and `dir="auto"` (Arabic).

**Finding the person's versions.** There's no "list my highlights", so
`discoverVersions` (`packages/core/src/discover.ts`) reads three
often-highlighted chapters (Isaiah 41, Philippians 4, John 3, none
of which moves between numbering systems, most highlighted first by
YouVersion's yearly figures) in every version in the browser's languages,
stopping at a version's first hit: about 90 versions and up to 270 reads for
English, and the progress counts the most it could take (versions × 3). A
version found is checked for supported numbering straight away, so it can be
added while the scan goes on. It runs by itself only on a first visit (no saved settings,
empty sync memory), when the default list is just an example; replacing the
list is only offered then, since replacing a synced list would drop its
snapshots. Versions are asked about, and listed, most used first
(`byPopularity`): YouVersion publishes no ranking, so 20 big languages
have a hand-made one in `packages/core/scripts/popular.mjs`, and every other
language has only its default version, the one bible.com opens for it
(`data/defaults.json`, from the survey's `languages.py`, which reads
`default_versions` in bible.com's `configuration.json`), ranked first. A
default that a hand-made list leaves out ranks just after it. Both ride in
the names chunk. The example list shown before the person chooses
(`defaultVersions` in `apps/pwa/src/lib/db.ts`) uses the same ranking: the
most used version of each of the browser's first three languages, then AMP,
or the most used English version and AMP when none of those languages is
known, so there are always two to sync.

**Verifying a version.** Also add an entry to `VERIFIED` in
`packages/core/scripts/verified.mjs`, and for each chapter that matches neither
system, write the correction table: first check whether a shared table in
`overrides/shared/` describes it, by reading the verses at its boundaries in
the version (not just comparing counts), and `use` it if so. The LSG tables were built by aligning the
text verse by verse with a closely related version whose numbering is known
(LSG against S21, by word overlap), then against NIV, and reading every
boundary by eye. The shared tables were checked the same way, version by
version, against NIV, reading the verses around every boundary (text fetched
from the API behind bible.com and cached under the survey's gitignored `out/`;
Bible text isn't committed, and comments quote only the public-domain KJV).
Then add test cases to `packages/core/test/versification.test.ts` for
the verses you checked by eye, and run `npm run check`.

## The sync rules

The engine is in `packages/core/src/sync.ts`; the reasoning is in its header
comment and the tests in `packages/core/test/sync.test.ts` pin every rule.

The **snapshot** (`SyncState`) records, per canonical verse, the colour each
version had after the last sync, and per canonical chapter which versions took
part. A version's change is anything different from its own snapshot. That's
what separates "removed" from "never highlighted", and it's why the snapshot is
per version: storing one colour per verse turned a version keeping its own
colour into a phantom change on the next run.

Safety rules, all tested:

- **A failed read skips the whole book.** Otherwise an unread chapter looks
  exactly like "every highlight in it was removed".
- **A version's own change is never overridden,** and an existing highlight is
  never recoloured because another version differs.
- **Membership is per chapter.** A version added later has no snapshot, which
  would otherwise read as "removed everywhere"; `members` tells the two apart.
- **A write the API rejects** (4xx) is remembered in `unwritable` so it isn't
  mistaken for a removal next time; a retryable failure keeps the old snapshot
  so the next run tries again.
- **Removals above a limit per run** (25 by default) need explicit consent.
- **A version whose verse mapping changed is re-added, not diffed.** The
  snapshot is keyed by canonical verse, so after a mapping change (new
  numbering support, better counts) a version's old colours sit on the wrong
  verses and would read as removals and recolours. `maps` fingerprints each
  version's mapping per book; when it differs, that version is planned as a
  newcomer in that book and its old snapshot there is dropped. A snapshot
  saved before fingerprints existed counts as changed wherever it has data.
- **A version with unsupported numbering is left out, snapshot and all.**
  `runSync` and `planBook` skip a version whose map is flagged `unsupported`:
  nothing is read or written for it, its snapshot is carried over untouched,
  and `RunSummary.refused` names it.

## The YouVersion API: things that will bite you

Each of these was found the hard way.

**Highlights can only be read a chapter at a time.** `GET /v1/highlights` with
a single verse (`JHN.3.16`) is a 400: "Get highlights only supports
single-chapter requests". Writes and deletes take single verses.

**There is no "list my highlights".** Every sync reads every chapter it covers,
in every version — about 1,200 requests per version for a whole Bible.

**An expired token looks like a network error in the browser.** YouVersion's
401 responses carry no CORS header, so `fetch` rejects with a `TypeError`
instead of returning the 401. Successful responses and other errors do have the
header. The client therefore treats a failed authenticated request as a likely
expired token: refresh once and retry; if the refresh is rejected, report
"sign-in expired"; after three network failures, give up. The runner stops the
whole run on the first auth or network failure rather than failing every book.

**The refresh grant works** (`grant_type=refresh_token`), though the docs don't
describe it. Tokens last an hour.

**Sign-in is a two-hop callback.** The first redirect to `/callback` carries
only `state`; the app sends the browser to `/auth/callback?state=…`, which
redirects back with the `code`. `interpretCallback` in
`packages/core/src/auth.ts` handles both. React StrictMode runs effects twice in
development, so the callback page guards against exchanging the code twice.

**Most Bible text is licensed per app key.** For NIV, AMP and S21,
`/v1/bibles/{id}` and `/index` return 403 or 404 — yet their highlights read and
write fine. That's why verse counts are bundled rather than fetched.

**Errors come in three shapes:** `{"message"}` from the API,
`{"error","error_description"}` from the auth layer and
`{"fault":{"faultstring"}}` from the gateway. `errorMessage()` reads all three.

**No highlights is a 204**, not an empty list.

**The API doesn't say how a version numbers its verses.** YouVersion labels
each version (`vrs`: `eng`, `org`, `rso`, `rsc`, `lxx`, `vul`), but only its
unofficial bible.com API exposes the label; see
[tools/versification-survey](tools/versification-survey/README.md). The app
bundles the label of every version YouVersion listed in Sept 2026 (3,082 of
3,864; the rest have none), packed as gaps between ids to keep it to 1.6 KB
gzipped. A version without one is treated as `eng`/`org`, or refused when its
counts say otherwise.

**`/v1/bibles` lists only the platform's subset.** Spanish has 9 versions there
(no Reina-Valera 1960) against 30 in the app, and `page_size` must be at most
99. Versions missing from the list still read and write highlights, so don't
validate a version against it.

**Abbreviations aren't unique.** `NVI-S` is both 128 and 2664, `ARC` both 212
and 3407. Key anything version-specific by bible id.

## Things that will bite you elsewhere

**Nahum is `NAM`, not `NAH`.** Use the USFM book codes exactly as `BOOKS` in
`versification.ts` lists them. A wrong code silently drops the book.

**English Psalm titles are verse 0.** `eng.vrs` maps them (`PSA 51:0 = PSA
51:1`), but a verse 0 can't be highlighted, so those mappings are ignored.

**bible.com blocks scripted clients.** `curl` gets a "Client Challenge" page.
Collect data from a real browser session instead.

**The Content-Security-Policy forbids inline scripts.** That's why the theme's
pre-paint script is `apps/pwa/public/theme-init.js`, a file, rather than inline
like in most apps. It mirrors `resolveTheme()` in `apps/pwa/src/theme.ts`; keep
the two in step.

**Tailwind v4 can't `@apply` a custom class from a plain layer.** Shared styles
(`card`, `btn`, `input`, `picker`…) are declared with `@utility` in
`apps/pwa/src/index.css` for that reason.

**Dark mode is a class, not a media query.** `@custom-variant dark` keys off
`.dark` on `<html>`, so the picker can override the system.

**Some embedded browsers don't allow service workers.** Test offline support in
a real Chrome. For screenshots of signed-in screens without a real account, a
throwaway headless Chrome (fresh `--user-data-dir`, driven over the DevTools
protocol) with a fake token written to IndexedDB works well; any API call then
exercises the sign-in-expired path.

## Localisation

`apps/pwa/src/i18n/en.ts` is the canonical shape; `fr.ts` is typed against it,
so a missing key is a build error. Strings are data: placeholders are `{name}`,
filled by `f()`, and counts are `[singular, plural]` pairs picked by
`Intl.PluralRules` (French takes the singular for zero). Tests assert that the
locales share every key, placeholders match, nothing French is accidentally
still English, and French punctuation (`:` `;` `?` `!`) is preceded by a
no-break space.

**Never build a sentence in `packages/core`.** The engine returns structured
data (`Difference`, `blocked`, `SignInError` codes) and the app phrases it, so
switching language re-renders everything.

## Colour and contrast

Colours come from Tailwind's default palette: stone for neutrals, amber for the
accent. `apps/pwa/src/__tests__/contrast.test.ts` reads Tailwind's own values
and checks every text/background pairing the components use against WCAG AA,
in both themes. It's why light mode uses amber-600 for focus rings and amber-700
for the progress bar. Add a pairing there when you add a colour.

## Conventions

- **`npm run check` must pass** before every commit.
- **No licence headers in source files.** The licence lives in `LICENSE` and the
  `license` field of each `package.json`.
- **Comments explain why, not what.**
- **Every user-visible string goes in both dictionaries.**
- **Never commit an app key, tokens or someone's highlights.** `.env.local`,
  `tools/python-cli/config.json` and `.yvsync/` are gitignored for this.
- **Commit messages are prose.** Explain the reasoning and what went wrong, not
  a changelog line.

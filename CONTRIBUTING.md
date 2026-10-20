# Developing Bible Version Sync

Everything a contributor needs. The [README](README.md) is for people using the
app; this is for people changing it; [AGENTS.md](AGENTS.md) holds the handful
of rules that bind coding agents specifically.

## Running it

Needs Node and a YouVersion Platform app key. Which Node is set in two
places: `engines` in [package.json](package.json) is the minimum, which
`engine-strict` in [.npmrc](.npmrc) enforces (so `npm install` refuses a
Node the project or a dependency doesn't support), and [.nvmrc](.nvmrc) is
the version CI uses; `nvm use` picks it, so the bundled data regenerates
exactly as in CI. npm 10 crashes installing this workspace ("Cannot read
properties of null (reading 'edgesOut')"); with a Node that ships it,
`npx npm@11 install` works. npm 11 holds back
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
`http://localhost:8001/callback` stays valid. `PORT` moves it (when another
checkout's server has 8001), but signing in only works on 8001 unless that
port's callback is registered for the key too. The key isn't a secret — it's
an OAuth client id and ends up in the built JavaScript — but keep your real
value out of the repository anyway.

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
  both are skipped rather than guessed, unless one system maps both chapters
  as they're mapped: Isaiah 63 maps the same under `eng` and `org`, so an
  `org` 63:19 may share Hebrew 63:19 with an `eng` 64:1.
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
`packages/core/test/survey.test.ts` runs the engine over all 353 scanned
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
(the 46 verified versions in `scripts/verified.mjs` and the rest scanned
for the survey: 54 widely used, 56 more from the hand-made ranking in
`scripts/popular.mjs`, four more bundled when they were verified, 18 that
print many merged verses, and 221 smaller unlabelled ones scanned for
coverage, by bible id), then the
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
system anyway, which keeps the 353 versions to about 36,500 entries.

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
BCP 47 equivalent, like `gax_ars` for Arsi Oromo, is dropped), by a fixed
table in `scripts/language-tags.mjs` rather than `Intl`'s canonical form,
which changes with Node's ICU (it turned `mnk`, Mandinka, into `man` on one
Node and `gom`, Goan Konkani, into `kok` on another). Those two keep
YouVersion's more precise tag; a test flags any other tag the runtime would
write differently. YouVersion has
two abbreviations per version, and bible.com shows
`local_abbreviation` (NIV, НРП), not `abbreviation` (NIV11, NRT); the survey's
`names.py` records it. The verified versions are named the same way, and
`gen-data.mjs` checks that `verified.mjs` agrees. A version is named by its
abbreviation, worked out from its id and never saved (`labelVersions` in
`apps/pwa/src/lib/db.ts`); two in the list that share one get their
language, or their number when that's shared too: NVI (es), ARC (212). The
app shows the title beside it and falls back to "Version {id}" once the
names are loaded and don't have it. Titles are in the version's own script,
so they're rendered with `lang` (Japanese glyphs rather than Chinese) and
`dir="auto"` (Arabic). The add field searches these names
(`searchVersions`): every word must appear in the number, abbreviation or
title, accents and case aside; an exact number comes first, then the
reader's languages in their order, then exact and leading abbreviation
matches, then popularity. A number bible.com doesn't name is still offered.

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
most used version of each of the browser's first seven languages. A sync
needs two, so when that gives one, the next most used version in its
language joins it (NIV and KJV for English alone), or NIV and AMP when its
language has no other; NIV and AMP are also the list when none of the
languages is known. AMP is an arbitrary favourite. Converting a snapshot
saved by name still uses the old rule (first three languages, then AMP),
since that's the list whose names it holds.

**Verifying a version.** Also add an entry to `VERIFIED` in
`packages/core/scripts/verified.mjs`, and for each chapter that matches neither
system, write the correction table: first check whether a shared table in
`overrides/shared/` describes it, by reading the verses at its boundaries in
the version (not just comparing counts), and `use` it if so. Matching counts
aren't enough: RVR1960 numbers Psalm 47 the English way in Hebrew's 10
verses, and was mapped a verse off until its text was read. The survey's
`text.py`, `sheets.ts` and `REVIEW.md` do the reading (see
[its README](tools/versification-survey/README.md#verifying-a-versions-numbering)):
every verse where the numbering could go wrong, beside the NIV and LSG
verses the engine pairs it with, plus the stretches a verse-length aligner
suspects. The LSG tables were first built by aligning the text verse by verse
with S21 (by word overlap), then against NIV. Bible text isn't committed,
and comments quote only public-domain text (KJV, Douay-Rheims). Then add
test cases to `packages/core/test/versification.test.ts` for the verses you
checked by eye, and run `npm run check`. A verified version maps every
chapter it has; a test checks that.

## The sync rules

The engine is in `packages/core/src/sync.ts`; the reasoning is in its header
comment and the tests in `packages/core/test/sync.test.ts` pin every rule.

The **snapshot** (`SyncState`) records, per canonical verse, the colour each
version had after the last sync, and per canonical chapter which versions took
part. A version's change is anything different from its own snapshot. That's
what separates "removed" from "never highlighted", and it's why the snapshot is
per version: storing one colour per verse turned a version keeping its own
colour into a phantom change on the next run. Versions are keyed by bible id,
in the snapshot and in plans. It used to be the name the person gave each
version, until names stopped being chosen; `migrateState` converts a
snapshot from then using the names saved with the settings, and drops what
it can't place, which only makes that version a newcomer.

**Which colour blank versions get.** When versions changed a verse to
different colours, the one blank versions follow is the first listed
version's, or, given a colour order (`PlanOptions.colorOrder`, the app's
"which wins?" card), the colour ranked first, with the
versions' order breaking ties. A removal ranks after every colour. Either
way only blanks and the sync's own copies follow it; each version keeps its
own colour. Colours are ranked by the nearest of the ten in
`HIGHLIGHT_COLORS` (`packages/core/src/colors.ts`), not by equality: the
five the web offers are exact, but the five only the mobile apps offer were
recovered from a screenshot of the Android picker, which draws them at about
55% opacity, and may be a unit or two out.

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
- **A stop never leaves a book half planned.** The abort signal goes into
  every read (the client hands it to `fetch` and to its back-off sleeps), so
  reading stops at once, and a book stopped mid-read is dropped from the
  summary unplanned (`readBook` checks the signal once more before it
  returns, so a book is either read in full or not at all). Writes take no
  signal: a book being written is finished first, since a
  request cut off mid-flight may or may not have landed.

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
"sign-in expired"; if the refresh can't get through either, it isn't the
sign-in (a stale refresh token gets a readable 400), so stop at once as
unreachable; after three network failures, give up. The runner stops the
whole run on the first auth, network or rate-limit failure rather than
failing every book. A write that fails that way stops the rest of its book
too, and those verses keep their old snapshot so the next run retries them.
A failed read stops the book's other readers from starting new reads.

**The rate limit is small, and in a browser it's invisible.** In Oct 2026 an
app key got a 429 with `Retry-After: 300` after about 120 requests, whether
they came in 5 seconds or over two minutes, so the limit counts requests over
minutes, and pacing only delays it. A "Find my versions" scan in English can
need 270 reads, so it can trip the limit on its own. The 429 has no CORS
header, for `/auth/token` too, so the browser reports only "Failed to fetch".
That's the case above where the refresh can't get through. Every request
during the lock-out seems to extend it, which is why the client stops
instead of retrying. Outside a browser the 429 is visible: the client waits
out a `Retry-After` of up to a minute itself, and hands a longer one back so
the app can say how long to wait. The app phrases failures by status in
`problemText` (`apps/pwa/src/lib/versions.ts`), never with the client's
detail, which is English and sometimes the browser's.

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
(no Reina-Valera 1960) against 30 in the app, and a numeric `page_size` must be
at most 99. Versions missing from the list still read and write highlights, so
don't validate a version against it.

**YouVersion's own agent skill is vendored, but this section overrides it.**
`.agents/skills/youversion-platform-api` is copied from
[youversion/platform-skills](https://github.com/youversion/platform-skills)
(Apache-2.0, its `LICENSE` alongside, the commit in `.upstream`). Skills live
in `.agents/skills`, which Codex and other agents read, and `.claude/skills`
is a symlink to it because Claude Code reads only that; add new skills to
`.agents/skills`. The SDK and React skills upstream aren't copied, since the
app calls the API with plain `fetch` and shows no Bible text. The skill
covers only `/v1/bibles` and passages, not highlights or sign-in, and it's
written for apps that show text: it treats `/v1/bibles` as the only source of
version ids, where here the list is a subset and versions are bundled
(above). One trick it documents is worth knowing: `page_size=*` is accepted
when at most three `fields[]` are asked for, so
`/v1/bibles?language_ranges[]=*&fields[]=id&fields[]=abbreviation&page_size=*`
lists every version the app key may read in one request (360 in Sept 2026).
`tools/youversion-skill.sh` refreshes the copy, and `--check` fails when
upstream has changed it; the "YouVersion skill / Up to date" check runs that on
every PR. It isn't a required check, so an upstream change shows red without
blocking unrelated PRs: run the script, read what changed against this
section, and commit it. Don't edit the copy by hand; the check fails on
that too.

**Some versions id chapters `BOOK.<n>_1`.** NR2006's Psalms and Job are
`PSA.1_1`, `JOB.1_1`…; so are GNA2025's Psalms and Philemon and TUKARA84's
Matthew, while BFC does it only in Psalms 10–147 and DHH94I only in Psalms
42–43. Their highlights live under those ids (`PSA.1_1.5`): reading
`PSA.1` there gives an empty list, not an error, so the rule that a failed
read skips the book never fires, and writing `PSA.1.2` is a 502. The engine
speaks plain `BOOK.<n>` throughout, and `YouVersionClient` translates at the
edge (`toYouVersionId`, `fromYouVersionId`), chapter by chapter, using
`data/suffixed_chapters.json` from the survey's scan. A version that isn't
bundled gets them from its API index instead (`suffixedFromIndex`, kept on
`VersionMap.suffixed`), and `resolveVersion` hands them to the client
(`useSuffixedChapters`). The index gives such a chapter `"id": "1_1"` and
`"passage_id": "PS2.1_1"` (WEBUS's Psalm 151, seen in October 2026; PS2
isn't one of the engine's books, so that chapter itself isn't synced). None
of the five bundled versions' indexes are licensed to the app key (404), so
for them the bundled list is what counts; a version whose index the app key
may not read still needs a scan and an `import-survey`. The sync's mapping
fingerprint includes the suffixed chapters, so such a version is re-added once in those books
when they first become known, rather than diffed against a snapshot made
with the plain ids.

**Abbreviations aren't unique.** `NVI-S` is both 128 and 2664, `ARC` both 212
and 3407. Key anything version-specific by bible id.

## Claude review on PRs

`.github/workflows/claude-review.yml` runs Claude's `/code-review` and
`/security-review`, from the shared actions in
[eugenius1/actions](https://github.com/eugenius1/actions), on every non-draft
PR from this repo and posts findings as
inline comments, using the owner's Claude plan through the
`CLAUDE_CODE_OAUTH_TOKEN` secret (made with `claude setup-token`; renew it
when it expires). Fork and Dependabot PRs are skipped, since they can't read
the secret. It reports but isn't a required check: a job that fails because
the token expired or the plan's usage ran out would block every merge, and a
finding is advice, not a pass or fail.

**A green tick on a PR that edits `claude-review.yml` means nothing.** The
action refuses to run when the workflow file differs from the one on `main`
("Workflow validation failed"), and then exits successfully having done
nothing, in about ten seconds. So the PR that changes the workflow, including
the one that added it, is never reviewed by it, and neither is a PR that
touches the file later. Check the job log for that message before trusting the
tick, and test a change to the workflow on a later PR that doesn't touch it.
Because of that, keep a PR that edits the workflow minimal and free of
production code: it gets no Claude review, so anything else in it gets none
either. Put the code in its own PR.

A change to the shared actions isn't checked that way: once merged there, it
runs on every repo's next PR.

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

`apps/pwa/src/i18n/en.ts` is the canonical shape; every other locale is typed
against it, so a missing key is a build error. Strings are data: placeholders
are `{name}`, filled by `f()`, and counts are `[singular, plural]` pairs picked
by `Intl.PluralRules` (French and Brazilian Portuguese take the singular for
zero; Indonesian has no plural, so both forms are the same). Russian counts
take three forms, `[one, few, many]` (1 стих, 2 стиха, 5 стихов); the tests
allow a third form only in a language whose plural rules have a "few". Tests
assert that the locales share every key, placeholders match, nothing is
accidentally still English, and French punctuation (`:` `;` `?` `!`) is
preceded by a no-break space. Book names live in `packages/core/src/books.ts`,
one list of 66 per language, each from that language's most read Bible.

British English (`en-gb.ts`) isn't written out: it's `en.ts` respelled
(colour, grey), so it can't fall behind. It's the default for English
readers in the UK, Ireland and the Commonwealth countries that teach British
spelling (`BRITISH_REGIONS` in `i18n/core.ts`); Canada stays American.

Adding a language: a dictionary in `apps/pwa/src/i18n/`, its book names in
`books.ts`, and the code in `Lang` there. The picker orders itself as
concurrent-counter-next's does: English first, then the reader's own
languages, then the rest by their own names. Chinese and Korean are left out
for now: their text doesn't break at spaces, and the layout hasn't been
checked for it.

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

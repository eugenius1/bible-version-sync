# Bible versions

How the engine matches verses across versions, how a version gets verified, and how versions are named and found. Part of the [developer docs](../CONTRIBUTING.md).

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

### A version no system explains is refused

Without a label, only `eng`
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

### Where the verse counts come from

They come from, in order: `packages/core/data/known_counts.json`
(the verified versions in `scripts/verified.mjs` and the ones scanned for the
survey, listed in [its README](../tools/versification-survey/README.md)), then the
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

[docs/versification-survey.md](versification-survey.md) records how 54
widely used versions in 20 languages fared against the original
`eng`/`org` engine; it's why `rso`, `rsc`, `lxx` and `vul` were added. The scanner and data behind it are in [tools/versification-survey](../tools/versification-survey/README.md).

## Adding or verifying a version

To add a version's verse counts, so it shows "Verse counts known":

1. Scan it with `tools/versification-survey/scan.py`, and add it to the
   survey's `data/counts.json` with `scan.py --add`.
2. Run `npm run import-survey -w @bvs/core`, which rewrites the files listed
   in [`packages/core/data`'s README](../packages/core/data/README.md).
3. Review the diff: the app never reads `tools/` itself, so what ships is
   exactly what's in `packages/core/data`. `survey.test.ts` fails if the
   bundle stops reproducing the scan.

To verify its numbering, so it shows "Verified numbering", also:

4. Add an entry to `VERIFIED` in `packages/core/scripts/verified.mjs`.
5. For each chapter that matches neither system, write the correction table.
   First check whether a shared table in `overrides/shared/` describes it, by
   reading the verses at its boundaries in the version (not just comparing
   counts), and `use` it if so. Matching counts aren't enough: RVR1960
   numbers Psalm 47 the English way in Hebrew's 10 verses, and was mapped a
   verse off until its text was read. The survey's `text.py`, `sheets.ts` and
   `REVIEW.md` do the reading (see
   [its README](../tools/versification-survey/README.md#verifying-a-versions-numbering)).
   Bible text isn't committed, and comments quote only public-domain text
   (KJV, Douay-Rheims).
6. Add test cases to `packages/core/test/versification.test.ts` for the
   verses you checked by eye, and run `npm run check`. A verified version
   maps every chapter it has; a test checks that.

The LSG tables were first built by aligning the text verse by verse with S21
(by word overlap), then against NIV.

## Version names and discovery

### Version names

The official API doesn't name most versions (their text
isn't licensed to the app key), so `names.json` has the abbreviation, title
and language bible.com shows for all 3,864 versions YouVersion lists. That's
100 KB gzipped, more than half the rest of the app, so it isn't in the main
bundle: `gen-data.mjs` writes it to `src/names.generated.ts`, which
`loadVersionNames()` imports on demand, and Vite makes a chunk of its own.
The versions card starts the load when it mounts, and `versionName()`
returns nothing until it's done.

YouVersion's language tags become BCP 47 (`eng` → `en`, `zho_tw` → `zh-TW`,
`hin_ro` → `hi-Latn`; a suffix with no BCP 47 equivalent is dropped) by a
fixed table in `scripts/language-tags.mjs`, never `Intl`, whose canonical
form changes with Node's ICU (one Node turned `mnk`, Mandinka, into `man`). A
test flags any tag the runtime would write differently.

YouVersion has two abbreviations per version, and bible.com shows
`local_abbreviation` (NIV, НРП), not `abbreviation` (NIV11, NRT); the survey's
`names.py` records it. The verified versions are named the same way, and
`gen-data.mjs` checks that `verified.mjs` agrees.

A version is named by its
abbreviation, worked out from its id and never saved (`labelVersions` in
`apps/web/src/lib/db.ts`); two in the list that share one get their
language, or their number when that's shared too: NVI (es), ARC (212). The
app shows the title beside it and falls back to "Version {id}" once the
names are loaded and don't have it. Titles are in the version's own script,
so they're rendered with `lang` (Japanese glyphs rather than Chinese) and
`dir="auto"` (Arabic).

The add field searches these names
(`searchVersions`): every word must appear in the number, abbreviation or
title, accents and case aside; an exact number comes first, then the
reader's languages in their order, then exact and leading abbreviation
matches, then popularity. A number bible.com doesn't name is still offered.

### Finding the person's versions

There's no "list my highlights", so
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
snapshots.

Versions are asked about, and listed, most used first
(`byPopularity`): YouVersion publishes no ranking, so 20 big languages
have a hand-made one in `packages/core/scripts/popular.mjs`, and every other
language has only its default version, the one bible.com opens for it
(`data/defaults.json`, from the survey's `languages.py`, which reads
`default_versions` in bible.com's `configuration.json`), ranked first. A
default that a hand-made list leaves out ranks just after it. Both ride in
the names chunk.

### The example list

The example list shown before the person chooses (`defaultVersions` in
`apps/web/src/lib/db.ts`) is the most used version of each of the browser's
first seven languages, padded to the two a sync needs with the next most used
in the same language, and NIV and AMP when nothing else fits. Converting a
snapshot saved by name still uses the old rule (first three languages, then
AMP), since that's the list whose names it holds.

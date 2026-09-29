# Verse-numbering data

Everything the app bundles, and nothing else: the versification survey in
`tools/` is research data, copied here only by a deliberate import. Versions
are keyed by bible id throughout; abbreviations aren't unique.

- `eng.vrs`, `org.vrs`, `rso.vrs`, `rsc.vrs`, `lxx.vrs`, `vul.vrs`: Paratext
  versification files (English, Hebrew/Greek "original", Russian Synodal
  Orthodox and Protestant, Septuagint, Vulgate) from SIL's
  [libpalaso](https://github.com/sillsdev/libpalaso), MIT licence. The survey's
  `analyse.py` reads them from here too.
- `known_counts.json`: real verse counts by bible id, for every chapter where a
  version differs from English numbering or where its candidate systems
  disagree (0 for a chapter it lacks, `"BOOK": 0` for a whole book).
  Collected from bible.com in Sept 2026; LSG matches the YouVersion API index
  exactly. The four verified versions
  are listed in `scripts/verified.mjs`; the rest are scanned only.
- `labels.json`: YouVersion's numbering label (`vrs`) by bible id, which the
  official API doesn't expose, for every version YouVersion lists (3,082 of
  3,864 have one). Bundled packed, as gaps between ids.
- `names.json`: every version's abbreviation, title (in its own script) and
  BCP 47 language by bible id, as bible.com shows them (NIV, not YouVersion's
  internal NIV11), so the app can name a version added by number. Bundled
  into `src/names.generated.ts`, which the app loads as a chunk of its own.
- `defaults.json`: the version bible.com opens for each of YouVersion's 2,462
  languages (Sept 2026), by bible id; the one popularity signal YouVersion
  publishes. Ranks those versions first when looking for the person's
  versions, after the hand-made ranking in `scripts/popular.mjs`.
- `overrides/<bible id>.map`: hand-checked corrections for chapters that follow
  no system. Format: `LOCAL = CANONICAL` (canonical = org numbering), plus
  `use <name>` lines naming shared tables.
- `overrides/shared/<name>.map`: corrections several versions share, named
  after the local verse that gives them away (`rev-12-17`: Revelation 12 ends
  at 17). A version gets one only through a `use` line, once its text has
  been read.

`known_counts.json` (for scanned versions), `labels.json`, `names.json` and
`defaults.json` are written by `npm run import-survey -w @bvs/core` from the survey's
`counts.json` and `candidates.json`. After editing anything here, run `npm run gen -w @bvs/core`
to regenerate `src/data.generated.ts` and `src/names.generated.ts`.

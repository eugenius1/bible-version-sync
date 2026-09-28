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
  disagree (0 for a chapter it lacks). Collected from bible.com in Sept 2026;
  LSG matches the YouVersion API index exactly. The four verified versions
  are listed in `scripts/gen-data.mjs`; the rest are scanned only.
- `labels.json`: YouVersion's numbering label (`vrs`) by bible id, which the
  official API doesn't expose.
- `overrides/<bible id>.map`: hand-checked corrections for chapters that follow
  no system. Format: `LOCAL = CANONICAL` (canonical = org numbering).

`known_counts.json` (for scanned versions) and `labels.json` are written by
`npm run import-survey -w @bvs/core` from the survey's `counts.json` and
`candidates.json`. After editing anything here, run `npm run gen -w @bvs/core`
to regenerate `src/data.generated.ts`.

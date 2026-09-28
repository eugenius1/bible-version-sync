# Verse-numbering data

- `eng.vrs`, `org.vrs`: Paratext versification files (English and Hebrew/Greek
  "original" numbering) from SIL's [libpalaso](https://github.com/sillsdev/libpalaso),
  MIT licence. The Synodal (`rso`, `rsc`), Septuagint (`lxx`) and Vulgate
  (`vul`) files, and YouVersion's numbering label per version, are read from
  `tools/versification-survey/` instead of being copied here.
- `known_counts.json`: real verse counts per version, for every chapter where a
  version differs from English numbering or where English and Hebrew numbering
  differ. Collected from bible.com in Sept 2026; LSG matches the YouVersion API
  index exactly.
- `overrides/<ABBR>.map`: hand-checked corrections for chapters that follow
  neither system. Format: `LOCAL = CANONICAL` (canonical = org numbering).

After editing anything here, run `npm run gen -w @bvs/core` to regenerate
`src/data.generated.ts`. New versions also need an entry in
`scripts/gen-data.mjs`.

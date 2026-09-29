# Versification survey tools

The scanner and analysis behind
[docs/versification-survey.md](../../docs/versification-survey.md): how
widely used YouVersion versions number their verses, and how the sync engine
handles each.

## Files

| Path | What |
|---|---|
| `scan.py` | Scans every chapter of the given versions. `python3 scan.py <bible ids…>` writes `out/<id>.json` (gitignored); resumable, ~50 s per Bible at 6 concurrent requests. `python3 scan.py --add <bible ids…>` copies those scans into `data/counts.json`, counting a chapter YouVersion ids `PSA.1_1` as Psalm 1 (and refusing any other suffix, or a suffixed chapter beside a plain one with verses). |
| `languages.py` | Lists every version of every language YouVersion has into `data/candidates.json`, with its label and name, and each language's default version into `data/defaults.json`, and prints the label coverage. One cached request per language, sequential and paced. |
| `unlabelled.py` | For the unlabelled, unscanned versions, reads which chapters each has (one cached `version.json` each) and prints the ids to scan, cheapest languages first, to reach a share of languages fully known (`python3 unlabelled.py 0.8`). |
| `names.py` | Adds the abbreviation bible.com shows (`local_abbreviation`: NIV, where the internal `abbreviation` is NIV11) to `data/counts.json` as `local_abbr`. One cached request per language. |
| `analyse.py` | Classifies every chapter against six numbering systems and simulates the engine. Reads `out/` if present, else `data/counts.json`; writes `data/analysis.json` and prints a summary. Reads the six SIL [libpalaso](https://github.com/sillsdev/libpalaso) `.vrs` files (MIT) from `packages/core/data/`, the copies the app ships. |
| `data/counts.json` | The scan (Sept 2026), compact: the survey's 54 widely used versions, GNA2025 and NR2006, and 221 unlabelled ones scanned for label coverage. |
| `data/analysis.json` | `analyse.py`'s output for that scan. |
| `data/defaults.json` | The version bible.com opens for each language (Sept 2026), by language tag. |
| `data/candidates.json` | Every version of every language YouVersion lists (3,864 in 2,462 languages, Sept 2026), by language tag, with its numbering label and name. |

`analyse.py` simulates the engine as it was at the survey: the Python
prototype (`tools/python-cli`), eng/org only, which maps those versions
identically to `packages/core` (checked verse for verse for AMP, NIV, LSG and
S21). It doesn't know the `rso`/`rsc`/`lxx`/`vul` support added since;
`packages/core/test/survey.test.ts` runs the real engine over `counts.json`
and is the measurement to trust.

The app doesn't read this folder. `npm run import-survey -w @bvs/core` copies
each scanned version's exception counts, every `vrs` label and version
name (from `counts.json` and `candidates.json`) and every language's default
version (from `defaults.json`), into `packages/core/data/`, so a new scan
changes the app only through a reviewed diff there.

## `counts.json`

```json
{ "<bible id>": {
    "abbr": "NIV11", "local_abbr": "NIV", "title": "…", "lang": "eng", "vrs": "eng",
    "counts": { "GEN": [31, 25, …] },
    "gaps": { "MAT.17": [21] },
    "merged": ["JHN.3.1+JHN.3.2"] } }
```

`counts` holds the **highest verse number present** in each chapter (0 when
the chapter doesn't exist), not the number of verses, so an omitted verse
(NIV Matthew 17:21) doesn't shift anything. `gaps` lists verse numbers missing
below that maximum; `merged` lists verses printed as one span. `abbr` is
YouVersion's internal abbreviation and `local_abbr` the one bible.com shows,
which is what the app bundles.

Key versions by bible id: YouVersion abbreviations aren't unique (`NVI-S` is
both 128 and 2664, `ARC` both 212 and 3407).

## Where the data comes from

The official Platform API can't be used for this: it doesn't expose a
version's numbering system, and serves verse counts (`/v1/bibles/{id}/index`)
only for versions licensed to the app key. So the scan uses the API behind
bible.com, which is unofficial: fine for occasional research at a gentle rate,
not something the app should depend on.

- Base `https://bible.youversionapi.com/3.1/`, with headers
  `Accept: application/json`, `Referer: https://web.youversionapi.com`,
  `User-Agent: Web App: Production`, `X-YouVersion-Client: youversion`,
  `X-YouVersion-App-Platform: web`, `X-YouVersion-App-Version: 3`.
  Responses are wrapped in `{"response": {"data": …}}`. It works from plain
  scripts; bible.com's own pages answer scripts with a bot challenge.
- `version.json?id=<id>`: metadata, the `vrs` label, and
  `books[].chapters[]` with `canonical` flags (no verse counts).
- `chapter.json?id=<id>&reference=JHN.3`: about 12 KB. `content` is HTML where
  each verse carries `data-usfm="JHN.3.16"`, and merged verses
  `data-usfm="JHN.3.16+JHN.3.17"`. 404 when the chapter doesn't exist.
- `configuration.json`: every language (`default_versions`, 2,462 in Sept
  2026) with its `language_tag` and `total_versions`, and the totals.
- `versions.json?language_tag=<tag>&type=all`: versions per language, with
  `vrs`. Chinese is `zho` (Simplified) and
  `zho_tw` (Traditional).
- From a page on bible.com, `/api/bible/version/<id>` returns the same metadata.

The scanner reproduced the official API's verse counts for LSG exactly, for
all 1,189 chapters.

## YouVersion's numbering label (`vrs`)

One of `eng`, `org`, `rso`, `rsc`, `lxx`, `vul`, or `null`, per version. It's a
good prior but not the truth: LSG is labelled `org` yet uses English numbering
in Malachi and Joel and neither in Job 38–41, so the engine still has to decide
chapter by chapter.

## `.vrs` files

Mapping lines read `<this scheme> = <org>`, one verse or equal-length range per
line. Psalm titles are verse 0, sometimes on both sides (`rso`:
`PSA 10:0-7 = PSA 11:0-7`); a verse 0 can't be highlighted, so drop pairs where
either side is 0. Uneven ranges and lettered splits (`ESG 1:1a`) only occur
outside the 66-book canon or at titles, and the parsers skip them.

# Versification survey tools

The scanner and analysis behind
[docs/versification-survey.md](../../docs/versification-survey.md): how
widely used YouVersion versions number their verses, and how the sync engine
handles each.

## Files

| Path | What |
|---|---|
| `scan.py` | Scans every chapter of the given versions. `python3 scan.py <bible ids…>` writes `out/<id>.json` (gitignored); resumable, ~50 s per version at 6 concurrent requests. |
| `analyse.py` | Classifies every chapter against six numbering systems and simulates the engine. Reads `out/` if present, else `data/counts.json`; writes `data/analysis.json` and prints a summary. |
| `vrs/` | SIL [libpalaso](https://github.com/sillsdev/libpalaso) versification files (MIT): `eng`, `org` (also bundled in `packages/core/data/`), `rso`, `rsc` (Russian Synodal), `lxx` (Septuagint), `vul` (Vulgate). |
| `data/counts.json` | The scan of 54 versions (Sept 2026), compact. |
| `data/analysis.json` | `analyse.py`'s output for that scan. |
| `data/candidates.json` | Every text version for 20 language codes, with YouVersion's numbering label; a starting point for choosing more versions. |

`analyse.py` uses the engine from the Python prototype (`tools/python-cli`),
which maps verses identically to `packages/core` (checked verse for verse for
AMP, NIV, LSG and S21). Anything the app ships still needs tests in
`packages/core`.

## `counts.json`

```json
{ "<bible id>": {
    "abbr": "NIV11", "title": "…", "lang": "eng", "vrs": "eng",
    "counts": { "GEN": [31, 25, …] },
    "gaps": { "MAT.17": [21] },
    "merged": ["JHN.3.1+JHN.3.2"] } }
```

`counts` holds the **highest verse number present** in each chapter (0 when
the chapter doesn't exist), not the number of verses, so an omitted verse
(NIV Matthew 17:21) doesn't shift anything. `gaps` lists verse numbers missing
below that maximum; `merged` lists verses printed as one span.

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
- `versions.json?language_tag=<tag>&type=all`: versions per language, with
  `vrs`. There's no language list endpoint. Chinese is `zho` (Simplified) and
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

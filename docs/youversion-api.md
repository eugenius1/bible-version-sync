# The YouVersion API

The things about YouVersion's API that will bite you, each found the hard way. Part of the [developer docs](../CONTRIBUTING.md).

Each of these was found the hard way.

**Highlights can only be read a chapter at a time.** `GET /v1/highlights` with
a single verse (`JHN.3.16`) is a 400: "Get highlights only supports
single-chapter requests". Writes and deletes take single verses.

**There is no "list my highlights".** Every sync reads every chapter it covers,
in every version — about 1,200 requests per version for a whole Bible.
How long that takes is estimated in `packages/core/src/estimate.ts`: before a
run, from the chapters it will read at the rate this browser measured last
time (`apps/web/src/lib/pace.ts`, in localStorage), else an assumed 100 ms a
read; during it, by `RunClock`, which times reads and writes apart and eases
the measured rate in from that prior. Writes in books not yet read can't be
known, so a sync's time is a range (`WriteForecast`), before it starts as
well as while it runs; a preview's is the reads alone. The range is at least
the reads and the writes left in the book being written, at most those plus
a write of every highlighted verse in every other version, as if nothing
were in sync. A
book's highlighted verses are taken as the most of what the sync memory has
for it, the share seen in the books read so far and 10%. Nothing that looks
like taking under five seconds, writes included, shows one.

**An expired token looks like a network error in the browser.** YouVersion's
401 responses carry no CORS header, so `fetch` rejects with a `TypeError`
instead of returning the 401. Successful responses and other errors do have the
header. The client therefore treats a failed authenticated request as a likely
expired token:

- refresh once and retry;
- refresh rejected: report "sign-in expired";
- refresh can't get through either: it isn't the sign-in (a stale refresh
  token gets a readable 400), so stop at once as unreachable;
- three network failures in a row: give up.

The runner stops the
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
`problemText` (`apps/web/src/lib/versions.ts`), never with the client's
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
[tools/versification-survey](../tools/versification-survey/README.md). The app
bundles the label of every version YouVersion listed in Sept 2026 (3,082 of
3,864; the rest have none), packed as gaps between ids to keep it to 1.6 KB
gzipped. A version without one is treated as `eng`/`org`, or refused when its
counts say otherwise.

**`/v1/bibles` lists only the platform's subset.** Spanish has 9 versions there
(no Reina-Valera 1960) against 30 in the app, and a numeric `page_size` must be
at most 99. Versions missing from the list still read and write highlights, so
don't validate a version against it.

**`page_size=*` lists everything in one request** when at most three
`fields[]` are asked for:
`/v1/bibles?language_ranges[]=*&fields[]=id&fields[]=abbreviation&page_size=*`
gives every version the app key may read (360 in Sept 2026).

**Some versions id chapters `BOOK.<n>_1`.** NR2006's Psalms, for one, are
`PSA.1_1`, `PSA.2_1`…; which versions and chapters do it is in
`data/suffixed_chapters.json`. Their highlights live under those ids (`PSA.1_1.5`): reading
`PSA.1` there gives an empty list, not an error, so the rule that a failed
read skips the book never fires, and writing `PSA.1.2` is a 502. The engine
speaks plain `BOOK.<n>` throughout, and `YouVersionClient` translates at the
edge (`toYouVersionId`, `fromYouVersionId`), chapter by chapter, using
`data/suffixed_chapters.json` from the survey's scan. A version that isn't
bundled gets them from its API index instead (`suffixedFromIndex`, kept on
`VersionMap.suffixed`), and `resolveVersion` hands them to the client
(`useSuffixedChapters`). The index gives such a chapter `"id": "1_1"` and
`"passage_id": "PS2.1_1"` (WEBUS's Psalm 151; PS2 isn't one of the engine's
books, so that chapter isn't synced). A version whose index the app key may
not read, which includes every bundled one so far, needs a scan and an
`import-survey` instead. The sync's mapping
fingerprint includes the suffixed chapters, so such a version is re-added once in those books
when they first become known, rather than diffed against a snapshot made
with the plain ids.

**Abbreviations aren't unique.** `NVI-S` is both 128 and 2664, `ARC` both 212
and 3407. Key anything version-specific by bible id.

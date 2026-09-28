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
`<origin>/callback`; the dev server is pinned to port 8001 so that
`http://localhost:8001/callback` stays valid. The key isn't a secret — it's an
OAuth client id and ends up in the built JavaScript — but keep your real value
out of the repository anyway.

**Deploying.** `npm run build` writes a static site to `apps/pwa/dist/`. Set
`VITE_YV_APP_KEY` at build time, register `https://<domain>/callback` in the
portal, and serve it with a fallback to `index.html` so `/callback` resolves.
The production build carries a strict Content-Security-Policy (see
`apps/pwa/vite.config.ts`).

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

The `rso`, `rsc`, `lxx` and `vul` tables are read from
`packages/core/data/`, with a few corrections checked against the
text (`SUPPLEMENTAL` in `versification.ts`), and a mapping into another of the
66 books is dropped: the sync plans one book at a time, so such a verse would
look unread, and so removed, when the other book syncs.
`packages/core/test/survey.test.ts` runs the engine over all 54 surveyed
versions and pins what each one skips.

Verse counts come from, in order: `packages/core/data/known_counts.json`
(the four verified versions and the other 50 surveyed, by bible id), then the
YouVersion API's `/v1/bibles/{id}/index` (only for versions the app key may
read), then an assumption of the version's label or English numbering. The
app shows which as a badge: "Verified numbering", "Verse counts known",
"Numbering from YouVersion" or "Numbering assumed". `known_counts.json` holds
only the chapters the engine can't infer: those where a version differs from
English, and those where its candidate systems disagree (the engine needs
those to pick each book's system). A chapter the version lacks is stored as
0 so it isn't read. Everything else would get the same count and system
anyway, which keeps the 54 versions to about 8,100 chapters.

[docs/versification-survey.md](docs/versification-survey.md) records how 54
widely used versions in 20 languages fared against the two-system engine,
which is what led to the other four. The scanner and data behind it are in [tools/versification-survey](tools/versification-survey/README.md).

**Adding a version's counts.** Scan it (`tools/versification-survey/scan.py`),
add it to the survey's `data/counts.json`, and run
`npm run import-survey -w @bvs/core`, which rewrites that version's
exceptions in `known_counts.json` and every label in `labels.json`. Review the
diff: the app never reads `tools/` itself, so what ships is exactly what's in
`packages/core/data`. `survey.test.ts` fails if the bundle stops reproducing
the scan. The version then shows "Verse counts known".

**Verifying a version.** Also add an entry to `VERIFIED` in
`packages/core/scripts/gen-data.mjs`, and for each chapter that matches neither
system, write the correction table. The LSG tables were built by aligning the
text verse by verse with a closely related version whose numbering is known
(LSG against S21, by word overlap), then against NIV, and reading every
boundary by eye. Then add test cases to `packages/core/test/versification.test.ts` for
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
uses a bundled copy for the 282 versions surveyed; any other version is
treated as `eng`/`org`.

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

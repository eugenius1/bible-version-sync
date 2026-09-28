# Developing Bible Version Sync

Everything a contributor needs. The [README](README.md) is for people using the
app; this is for people changing it; [AGENTS.md](AGENTS.md) holds the handful
of rules that bind coding agents specifically.

## Running it

Needs Node 20+ and a YouVersion Platform app key.

```bash
npm install
cp apps/pwa/.env.example apps/pwa/.env.local   # put your app key in it
npm run dev                                     # http://localhost:8001
```

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
real verse count with both systems' counts
(`VersionMap.build` in `packages/core/src/versification.ts`):

- A chapter matching one system uses it; one matching both inherits its book's
  majority; one matching neither is skipped.
- If two chapters on different systems would claim the same canonical verse,
  both are skipped rather than guessed.
- Chapters that follow neither system are described by hand in a **correction
  table**, `packages/core/data/overrides/<ABBR>.map`, in `.vrs` mapping syntax:
  `LOCAL = CANONICAL`. Every chapter such a table touches uses only the table.

Verse counts come from, in order: the YouVersion API's
`/v1/bibles/{id}/index` (only for versions the app key may read), then
`packages/core/data/known_counts.json`, then an assumption of English
numbering. `known_counts.json` holds only the chapters where a version differs
from English or where English and original differ; everywhere else the counts
agree, so nothing more is needed.

[docs/versification-survey.md](docs/versification-survey.md) records how 54
widely used versions in 20 languages fare against this, and what's still
missing (Synodal and Septuagint numbering in particular).

**Adding a verified version.** Collect its verse count for every chapter
(bible.com's chapter pages carry one `data-usfm` per verse), add the
exceptions to `known_counts.json` and an entry to `BUILTIN` in
`packages/core/scripts/gen-data.mjs`, and for each chapter that matches neither
system, read the text against a version you trust and write the correction
table. Then add test cases to `packages/core/test/versification.test.ts` for
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
a real Chrome.

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

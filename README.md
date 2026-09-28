# Bible Version Sync

Keep your YouVersion highlights in sync across Bible versions. Highlight a verse
in one version (say AMP) and it shows up in the others you read (NIV, LSG, S21…),
on the right verse even where versions number verses differently.

Not affiliated with YouVersion. Uses the [YouVersion Platform API](https://developers.youversion.com)
with the user's permission.

## Layout

| Path | What |
|---|---|
| `packages/core` | Sync engine: verse-number mapping, merge rules, API client, sign-in helpers. Framework-free TypeScript, used by the PWA (and later a server). |
| `apps/pwa` | The web app (Vite, React, Tailwind, installable PWA). Runs entirely in the browser. |
| `tools/python-cli` | The original Python prototype, kept for reference. |

## Getting started

Needs Node 20+.

```bash
npm install
cp apps/pwa/.env.example apps/pwa/.env.local   # then put your app key in it
npm run dev                                     # http://localhost:8001
npm test
```

In the [YouVersion Platform portal](https://platform.youversion.com), the app's
callback URL must be `<origin>/callback`, e.g. `http://localhost:8001/callback`
for development. Register your production URL the same way before deploying.

`npm run build` produces a static site in `apps/pwa/dist/`. Host it anywhere
that serves static files with a fallback to `index.html` (Coolify static site,
Cloudflare Pages, …).

## How syncing works

- Every verse is converted to a *canonical* reference (Hebrew/Greek "original"
  numbering), so e.g. NIV Malachi 4:5 = S21 Malachi 3:23 = LSG Malachi 4:5.
  The numbering system is detected per chapter; chapters that follow neither
  system use hand-checked correction tables (`packages/core/data/overrides`).
- The app remembers each version's color per verse after every sync (the
  "sync memory"). Comparing against it tells a new highlight from a removed one.
- Rules:
  - Existing highlights are never recolored because another version differs;
    blank verses get the color of the first listed version.
  - Removing or recoloring a highlight that the sync put in place spreads to
    the versions that still have the synced color.
  - A version added later gets its blanks filled; it never undoes removals.
  - If any chapter of a book can't be read, the whole book is skipped.
  - Large batches of removals need an extra confirmation.

The rules and the verse mapping are covered by `packages/core/test`
(`npm test`).

## Verse-numbering data

See [`packages/core/data/README.md`](packages/core/data/README.md). Verified
versions today: AMP, NIV, LSG, S21. Other versions use the API's verse counts
when the app key may read them, otherwise English numbering is assumed (and the
app says so).

## Known limitations

- YouVersion has no "list all highlights" endpoint, so a whole-Bible sync reads
  every chapter of every version (~1,200 requests per version).
- In the browser, an expired sign-in looks like a network error (YouVersion's
  401 responses carry no CORS header). The client refreshes the token and
  retries; if that fails the run stops and asks you to sign in again.
- iOS home-screen apps keep storage separate from Safari. If sign-in finishes
  in Safari instead of the installed app, open the app and sign in again.

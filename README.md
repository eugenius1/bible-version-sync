# Bible Version Sync

[![CI](https://github.com/eugenius1/bible-version-sync/actions/workflows/ci.yml/badge.svg)](https://github.com/eugenius1/bible-version-sync/actions/workflows/ci.yml)
[![Deploy](https://github.com/eugenius1/bible-version-sync/actions/workflows/deploy.yml/badge.svg)](https://github.com/eugenius1/bible-version-sync/actions/workflows/deploy.yml)
[![codecov](https://codecov.io/gh/eugenius1/bible-version-sync/graph/badge.svg)](https://codecov.io/gh/eugenius1/bible-version-sync)

Keep your YouVersion highlights in sync across Bible versions. Highlight a verse
in one version and it shows up in the others you read, on the right verse even
where versions number their verses differently.

Everything runs in your browser. There is no server: your sign-in and your
highlights go only between your browser and YouVersion.

Use it at <https://eusebius.tech/bible-version-sync/>. To run it yourself, see
[CONTRIBUTING.md](CONTRIBUTING.md).

## What it does

If you read the Amplified Bible in the morning and the Louis Segond in the
evening, YouVersion keeps two separate sets of highlights: one per version.
Bible Version Sync copies them across, so a verse highlighted in one version is
highlighted in all of them.

Verse numbers don't always line up between versions, and the app accounts for
that. English Malachi 4:5 is Malachi 3:23 in Segond 21, which follows the Hebrew
numbering; English Psalm 51:1 is 51:3 in French Bibles, which number the
psalm's title; Louis Segond places the chapter breaks in Job 38–41 differently
again. A highlight lands on the same *words* in every version.

## How syncing behaves

- **You see every change first.** Preview a chapter, a book or the whole Bible,
  then apply.
- **Your first sync only fills in blanks.** Nothing you've already highlighted
  is removed or recoloured.
- **When versions disagree, each keeps its own colour.** Versions with no
  highlight on that verse get the colour from the version listed first; you
  choose the order.
- **Later changes follow you.** Remove or recolour a highlight in one version
  and the next sync does the same in the others — but only where the verse
  still has the colour the sync put there. A colour you picked yourself in one
  version is left alone.
- **Adding a version later** fills it in without bringing back anything you've
  removed.
- **Nothing half-done.** If any chapter of a book can't be read, that whole
  book is skipped. Removing a lot of highlights at once asks you to confirm.

The app remembers what each sync did (its "sync memory"), which is how it tells
"you removed this" from "this was never highlighted". Resetting it is safe: the
next sync simply goes back to only filling in blanks.

## Versions

Verse numbering has been checked chapter by chapter, for every chapter, for
**Amplified Bible (AMP)**, **New International Version (NIV)**,
**Louis Segond 1910 (LSG)** and **Segond 21 (S21)**.

You can add any other YouVersion version by pasting its bible.com link. The app
tells you how sure it is of that version's numbering:

- **Verified numbering**: checked chapter by chapter.
- **Verse counts known**: the app comes with the verse count of every chapter
  for 50 more widely used versions (KJV, ESV, NLT, Reina-Valera 1960, Synodal
  and others), scanned in Sept 2026 but not checked by hand. Chapters that
  follow no standard pattern are skipped rather than guessed.
- **Numbering from YouVersion**: worked out from YouVersion's own verse counts.
  Chapters that follow no standard pattern are skipped rather than guessed.
- **Numbering assumed**: YouVersion wouldn't share the verse counts, so English
  numbering is assumed (or Russian Synodal, Septuagint or Vulgate numbering,
  for versions YouVersion marks as using it). Fine for most of the Bible; in
  the Psalms and a few Old Testament chapters a highlight could land a verse
  or two off.

## Languages and appearance

English and French. The default comes from your device; the picker at the
bottom of the page overrides it and the choice is remembered. Light and dark
themes follow your device too, unless you pick one.

## Good to know

- YouVersion offers no way to ask "which verses have I highlighted?", so a sync
  reads every chapter it covers, in every version. A whole-Bible sync is about
  1,200 requests per version and takes a while; keep the page open.
- You sign in with your YouVersion account and allow access to your highlights.
  Notes and bookmarks aren't touched; YouVersion doesn't offer them to apps.
- On iPhone, an app added to the home screen keeps its storage separate from
  Safari. If signing in finishes in Safari, open the app and sign in again.

## Status

Working: sign-in, sync with preview for a chapter, book or the whole Bible,
English and French, light and dark. Syncing runs when you press the button;
automatic background syncing needs a server and is planned.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — how the verse mapping and the sync
rules work, the YouVersion API's quirks, and the traps worth knowing before
changing anything. Coding agents should start at [AGENTS.md](AGENTS.md).

## Licence

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details. You
should have received a copy of the licence along with this program — see
[LICENSE](LICENSE), or <https://www.gnu.org/licenses/>.

The verse-numbering files `packages/core/data/eng.vrs` and `org.vrs` come from
SIL's [libpalaso](https://github.com/sillsdev/libpalaso) under the MIT licence,
which is GPL-compatible.

---

Not affiliated with YouVersion. Uses the
[YouVersion Platform API](https://developers.youversion.com) with your
permission.

# yvsync (Python prototype)

> The first prototype of Bible Version Sync, kept for reference. The maintained
> code is `packages/core` (TypeScript). Differences: this version doesn't track
> which versions took part in each chapter's sync, so a version added later
> isn't filled in on verses synced before it was added.

Keeps your YouVersion highlights in sync across Bible versions (configured for
NIV, AMP, LSG, S21). Highlight a verse in any one of them, run `sync`, and it
shows up in the others, in the right place even where verse numbers differ.

Python 3 standard library only; nothing to install.

## Setup

1. Create a developer account and an app at <https://platform.youversion.com>.
   - Set the app's callback URL to `http://localhost:8001/callback`.
   - Copy the **app key**.
2. `cp config.example.json config.json` and paste the app key in.
3. Sign in (opens your browser; approve the *highlights* permission):
   ```
   python3 -m yvsync login
   ```
4. Check what the API lets you do with each version:
   ```
   python3 -m yvsync check                # read access + caches verse counts
   python3 -m yvsync check --write-test   # also writes/removes a test highlight
   ```
   `--write-test` only touches Obadiah 1:21, and only if it isn't already highlighted.
   "n/a" for Bible metadata/index is normal for versions your key isn't licensed
   to read (NIV, AMP, S21); highlights still work.

## Syncing

```
python3 -m yvsync sync --books JHN            # preview (no writes)
python3 -m yvsync sync --books JHN -v         # preview, every verse listed
python3 -m yvsync sync --books JHN --apply    # do it
python3 -m yvsync sync --all --apply          # all 66 books (~4,800 API reads)
```

How it decides what to do, per verse:

- **First sync of a book:** union. Anything highlighted in any version gets
  copied to the others. Nothing is removed.
- **Later syncs:** compared against a snapshot of the last sync
  (`.yvsync/state.json`). If you add, recolor or **remove** a highlight in one
  version, that change is copied to the others.
- **Conflicts** (same verse changed differently in two versions): the version
  listed first in `config.json` wins, and the conflict is reported.

Safety:

- Dry run unless `--apply`.
- If any chapter of a book can't be read, that book is skipped entirely, so a
  failed read can never look like "you removed this highlight".
- Removing more than `max_removals` (default 25) highlights in one run is
  refused unless you pass `--allow-removals`.

## Verse numbering

Versions don't all number verses the same way:

| | NIV / AMP | LSG | S21 |
|---|---|---|---|
| Psalm titles | not numbered | verse 1 (so Ps 51:1 EN = 51:3) | verse 1 |
| Malachi 4:5 | 4:5 | 4:5 | 3:23 |
| Joel 2:28 | 2:28 | 2:28 | 3:1 |
| Exodus 22:1 | 22:1 | 22:1 | 21:37 |

LSG mixes the English and Hebrew systems chapter by chapter. yvsync detects
which system each chapter uses by comparing its verse count against both
standard systems. Verse counts come from the API's index where your app key
can read it (LSG), otherwise from a built-in table taken from bible.com for
every chapter of NIV, AMP, LSG and S21.

A few chapters follow neither system; those are handled by hand-checked
correction tables in `yvsync/data/overrides/`:

- **LSG:** 1 Sam 20–21, Job 34 and 38–41 (different chapter breaks), Eccl 11–12,
  Mark 9–10 (split verses)
- **NIV / AMP:** Revelation 12 (17 verses; "the dragon stood on the shore" is in 13:1)

```
python3 -m yvsync numbering --version LSG     # what was detected
python3 -m yvsync numbering --book MAL        # verse-by-verse examples
```

Where one version splits a verse that another combines (e.g. 2 Cor 13:12–13
in English is 13:12 in French), highlighting the combined verse highlights
both halves.

## Not yet verified against the live API

These need a real app key to confirm; `check` and a one-book `sync` will show:

- Whether NIV / AMP / LSG / S21 highlights are readable and writable with your
  key (licensing may restrict some versions).
- Token refresh uses the standard OAuth `refresh_token` grant, which the docs
  don't spell out. If it fails you'll just need to `login` again.
- Rate limits aren't documented; the client backs off on HTTP 429.

## Tests

```
python3 -m unittest discover -s tests -t .
```

## Credits

`yvsync/data/eng.vrs` and `org.vrs` are Paratext versification files from
SIL's [libpalaso](https://github.com/sillsdev/libpalaso) (MIT licence).
YouVersion API use is subject to its non-commercial terms.

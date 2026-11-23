# The sync rules

What a sync does to each verse and the safety rules around it. Part of the [developer docs](../CONTRIBUTING.md).

The engine is in `packages/core/src/sync.ts`; the reasoning is in its header
comment and the tests in `packages/core/test/sync.test.ts` pin every rule.

The **snapshot** (`SyncState`) records, per canonical verse, the colour each
version had after the last sync, and per canonical chapter which versions took
part. A version's change is anything different from its own snapshot. That's
what separates "removed" from "never highlighted", and it's why the snapshot is
per version: storing one colour per verse turned a version keeping its own
colour into a phantom change on the next run. Versions are keyed by bible id,
in the snapshot and in plans. It used to be the name the person gave each
version, until names stopped being chosen; `migrateState` converts a
snapshot from then using the names saved with the settings, and drops what
it can't place, which only makes that version a newcomer.

The snapshot also keeps **what the sync added** (`added`): per version, each
highlight it wrote into a blank verse, by the version's own reference, with
the colour. The sync's own recolour of one follows it and its removal drops
it; one the person recolours or removes is dropped the next time its chapter
is read, being theirs now. The person's own highlights are never in it. It's
kept when a version leaves the list, since its highlights stay at YouVersion
and it may be added back. It's the only record of where a highlight
came from, and starts from when it was introduced: additions made before
can't be told apart. Every planned action also carries the colour it
replaces (`previous`), and `BookResult.written` lists the ones that landed.

**Which colour blank versions get.** When versions changed a verse to
different colours, the one blank versions follow is the first listed
version's, or, given a colour order (`PlanOptions.colorOrder`, the app's
"which wins?" card), the colour ranked first, with the
versions' order breaking ties. A removal ranks after every colour. Either
way only blanks and the sync's own copies follow it; each version keeps its
own colour. Colours are ranked by the nearest of the ten in
`HIGHLIGHT_COLORS` (`packages/core/src/colors.ts`), not by equality: the
five the web offers are exact, but the five only the mobile apps offer were
recovered from a screenshot of the Android picker, which draws them at about
55% opacity, and may be a unit or two out.

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
- **A version with unsupported numbering is left out, snapshot and all.**
  `runSync` and `planBook` skip a version whose map is flagged `unsupported`:
  nothing is read or written for it, its snapshot is carried over untouched,
  and `RunSummary.refused` names it.
- **A stop never leaves a book half planned.** Every read takes the abort
  signal (down to `fetch` and the back-off sleeps), and a book stopped
  mid-read is dropped unplanned; `readBook` checks the signal once more before
  it returns. Writes don't take it: a book being written is finished, since a
  request cut off mid-flight may or may not have landed.
- **A stopped run picks up where it stopped, a book at a time.** A whole-Bible
  preview or sync that stops (Stop, a rate limit, a closed page) is saved as
  each book finishes (`Unfinished` in `apps/web/src/lib/db.ts`), and the next
  one of the same kind, books, versions and colour order passes those results
  as `RunOptions.resume`. `runSync` keeps the books they finished
  (`finishedBooks`) and reads only the rest, so the report covers every
  attempt. A book that failed to read, or whose writes didn't all land, is
  done again, and what it did write stays in the report. The limit on
  removals counts every attempt, as if the run had never stopped (a run
  started over counts from nothing, as any new run does); a book held back by
  it is done again once removals are allowed. A sync, removing a version and
  resetting the sync memory drop a stopped run, since the snapshot it was
  planned against has changed; "Apply" under a preview reads afresh rather
  than pick up an older stopped sync.

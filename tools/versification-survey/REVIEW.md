# Reviewing a version's verse numbering

Instructions for whoever reads a review sheet, person or agent; see the
README's "Verifying a version's numbering".

You are checking, by reading the text, that a Bible sync engine pairs each verse
of one YouVersion Bible version with the right verse of every other version.
Every verse is mapped to a **canonical** reference in the Hebrew/Greek
"original" numbering (`org`); two versions' verses are the same verse when they
map to the same canonical reference. Psalm titles are verse 1 (sometimes 1-2)
in `org` and unnumbered in English numbering, so NIV Psalm 51:1 is canonical
51:3. Mistakes here move people's highlights onto the wrong verse, so read
carefully and don't guess.

Paths are relative to `tools/versification-survey/`.

Your input is a sheet, `out/sheets/<bible id>.md` (written by `sheets.ts`). Read the WHOLE sheet, every
entry. It has three sections.

## 1. Boundaries

For every chapter whose numbering isn't plain, the verses where numbering could
go wrong (first, last, and each side of any point where the mapping jumps).
Each line is

    <VERSION> <BOOK c:v> → <canonical>: <text>
        NIV <BOOK c:v>: <text>      (NIV's verse with that canonical ref)
        LSG <BOOK c:v>: <text>      (Louis Segond 1910, French)

Check that the version's verse says the same thing as the NIV and LSG verses
shown under it. NIV and LSG are verified and trusted. Translations differ in
wording, and a clause may sit on the other side of a verse boundary: that's
fine. Report a line only when the version's verse is really a different verse
(its content is the NIV/LSG verse before or after, or another chapter's), or
when a version's verse clearly holds two whole reference verses, or half of
one while the next verse has the rest. `—` means the version has no text
there; `(no verse at canonical …)` means the reference lacks that verse, which
is fine unless the version's text shows a problem. A line where the version's
verse is a Psalm title while NIV/LSG shows the psalm's first line (or the
reverse) IS a mistake.

A version's text marked `[16+17]` is a **merged span**: the version prints
verses 16 and 17 as one block. The engine still maps each of the two verse
numbers on its own (16 to one canonical verse, 17 to the next), so a span
that holds the two reference verses it's numbered for is correct, even though
the sheet shows it under only one of its numbers. Don't report those.

## 2. Flagged by the aligner

Stretches where an automatic verse-length comparison suspects the numbering.
Most are false alarms (lists of names, paraphrase, verses of unusual length).
Read every verse of each stretch against NIV and LSG and give a verdict:
`correct` or `misnumbered` with what each misnumbered verse really is.

## 3. Skipped chapters

Chapters the engine can't map, so it skips them today. The version's whole
chapter is given, then NIV's and LSG's with each verse's canonical ref after
`→`. For each, work out verse by verse which canonical verse each of the
version's verses is, and write a correction table in this syntax (one mapping
per line; ranges must be the same length on both sides; canonical is `org`):

    BOOK c:v = BOOK c:v
    BOOK c:v-w = BOOK c:x-y

Rules for tables: every verse of the version's chapter gets exactly one line
(ranges allowed). If one of the version's verses contains two canonical
verses, map it to the one it starts with (the other canonical verse then has
no verse in this version). If two of the version's verses split one canonical
verse, map both to it. Before writing a table, look in the repo's shared
tables, `../../packages/core/data/overrides/shared/*.map`
(each has a comment saying what it describes), and if one describes this
chapter exactly, check its boundary verses against this version's text and
say `use <name>` instead.

If you need more context than the sheet gives (a whole chapter), the full text
of each version is in
`out/text/<bible id>.json`
(`{"chapters": {"BOOK.c": {"verse": "text"}}}`, verse "0" is a Psalm title,
"16+17" a merged span; NIV is 111, LSG is 93). Read them with a short
`python3 -c` command. Don't use the network, and don't edit anything in the
repository.

## Output

Write `out/findings/<bible id>.md` with exactly these sections:

    # <abbr> (<bible id>)
    ## Boundaries
    <"All correct." or one bullet per problem: local ref, what it really is
    (canonical ref), and a short quote-free explanation>
    ## Flagged
    <one bullet per stretch: first–last local ref: correct | misnumbered: …>
    ## Skipped
    <per chapter: the table in a ```vrs block, or `use <name>`, plus one line
    on how you checked the boundaries>
    ## Notes
    <anything else odd: missing text, merged verses, doubts>

Don't quote more than a few words of any modern translation; describe
content instead. Your final reply should be a three-line summary per
version (problems found, flag verdicts, skipped chapters handled).

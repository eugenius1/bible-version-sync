# Versification survey: 54 versions, 20 languages

Sept 2026. Every chapter of 54 widely used YouVersion versions was scanned
(verse numbers present in each chapter, via the API behind bible.com) and
compared with the six standard numbering systems from SIL's libpalaso:
English (`eng`), Hebrew/Greek original (`org`), Russian Synodal (`rso`, `rsc`),
Septuagint (`lxx`) and Vulgate (`vul`). YouVersion labels each version with
one of these (`vrs`).

**Since then** the engine also supports `rso`, `rsc`, `lxx` and `vul` for
versions labelled with them ([below](#synodal-and-septuagint-support)), and
shared correction tables map most chapters that fit no system
([below](#shared-correction-tables)). The app now knows the label of every
version YouVersion lists, and the numbering of the versions in 84% of its
languages ([below](#label-coverage)); a version whose counts no available
system explains is refused ([below](#refusing-what-cant-be-mapped)). The
tables here are the survey as taken, against the two-system engine.

The rest of the app's hand-made ranking (`packages/core/scripts/popular.mjs`)
was scanned later the same way and 56 of its versions bundled; none is
refused, and none has a misplaced verse. Three depart from their label in
one verse on purpose: Synod (167), BTI (313) and CARS (385) keep Nehemiah
7:68 (horses and mules) with English 7:68, as SYNO and NRT do, since their
7:67–7:73 match NIV verse for verse, where `rso`/`rsc` would fold 7:68 into
7:67. Two of the 56, GNA2025 (67) and NR2006 (4833), id some chapters
`PSA.1_1`, like TUKARA84 below, and were bundled once `scan.py` counted
those as ordinary chapters. Held back: 19 that print many merged verses
(over 100 spans, or a Living Bible paraphrase), until merged-verse
highlighting is tested (#3, task 5).

**Columns.** *Label*: YouVersion's system for the version. *Fits*: of the ~348
chapters where the systems disagree, how many match the label / another system
/ none. *Skipped*: verses the engine of the time (eng/org detection plus our
correction tables) leaves unsynced. *Misplaced*: verses the current engine maps
differently from the version's labelled system, counting only chapters whose
verse count fits the label (so the label is very likely right there); the
deliberate Acts 19:41 and 2 Cor 13:12–14 merges are excluded. *Merged*: verse
spans printed as one (e.g. `GEN.1.1+GEN.1.2`).

## Findings

**1. English-numbered versions map correctly (38 of 54).** Every version YouVersion
labels `eng` (English, Spanish, Portuguese, German Luther, Korean, Chinese,
Japanese, Hindi, Swahili, Tagalog, Arabic, Romanian, Italian, Vietnamese,
Ukrainian Kulish, Polish Gdańska) has **zero misplaced verses**. What gets
skipped is small and recurring: Revelation 12 in versions with 17 verses (the
NIV/AMP correction table generalises) and 3 John in KJV-tradition versions
(14 verses rather than 15). A few older translations (VIE1925, PBG, RDV24,
UKRK, NR06) differ from English numbering in dozens of chapters; those are
skipped, so they're safe but incomplete.

**2. `org`-labelled versions map correctly but mix systems, like LSG.** French,
German (Hfa, SCH2000), Dutch (HSV, Het Boek), Indonesian (TB, BIMK) and NABRE:
**zero misplaced verses**. Several share the same departures from both systems:
Exodus 5–6, 1 Samuel 20, Nehemiah 8, Job 38–41, Hosea 1–2 and Haggai 1–2
(HSV, TB and Het Boek almost identically), so one correction table per
tradition would cover a family of versions.

**3. Russian and Ukrainian versions were not safe (fixed since).** SYNO (`rso`), NRT
(`rsc`) and UBIO (`lxx`) got **87–169 verses placed in the wrong spot**, where a
chapter's verse count coincides with an English or Hebrew chapter that holds
different text. Synodal Psalm 91 *is* English Psalm 92 (checked on the text);
Daniel 5–6 and Jeremiah 34/36 shift too. Another 2,300–3,000 verses were skipped.
Anyone adding one of these versions by link would have got misplaced
highlights.

**4. YouVersion's label is a useful prior, not the truth.** It's per version:
LSG is labelled `org` but follows English numbering in Malachi and Joel, and
neither in Job 38–41. Per-chapter detection is still needed.

**5. Merged verses are common in paraphrases.** MSG prints 8,085 verses as
merged spans, JCB 2,020, Het Boek 1,285, BIMK 643. How YouVersion stores a
highlight on a merged span (one verse, or each) hasn't been tested.

## Recommendations

Tracked in [#3](https://github.com/eugenius1/bible-version-sync/issues/3).

The scanner and data behind this survey are in
[tools/versification-survey](../tools/versification-survey/README.md);
`python3 analyse.py` there reproduces it.


1. **Guard now:** refuse or clearly block versions whose numbering is Synodal,
   Septuagint or Vulgate until they're supported. Superseded by 2 for the
   labelled versions; done for unlabelled ones with counts, see
   [below](#refusing-what-cant-be-mapped).
2. **Support `rso`, `rsc`, `lxx` and `vul`:** done; see
   [below](#synodal-and-septuagint-support).
3. **Bundle the scanned counts** for all 54 versions so they get
   count-based numbering without the API: done, shown as "Verse counts
   known".
4. **Write shared correction tables** for the Dutch/Indonesian tradition
   (Job 38–41, Hosea 1–2, Nehemiah 8 …): done, along with Revelation 12 and
   3 John; see [below](#shared-correction-tables).
5. **Test merged-verse highlighting** against a paraphrase (MSG) before
   promoting those versions.

## Results

| Language | Version | Label | Fits label/other/none | Skipped | Misplaced | Merged |
|---|---|---|---|---:|---:|---:|
| English | AMP (1588) | eng | 347/1/0 | 0 | 0 | 0 |
| English | ESV (59) | eng | 347/1/0 | 17 | 0 | 1 |
| English | KJV (1) | eng | 347/1/0 | 31 | 0 | 0 |
| English | MSG (97) | eng | 347/1/0 | 86 | 0 | 8,085 |
| English | NABRE (463) | org | 333/4/1 | 318 | 0 | 0 |
| English | NIV11 (111) | eng | 347/1/0 | 0 | 0 | 3 |
| English | NKJV (114) | eng | 347/1/0 | 31 | 0 | 0 |
| English | NLT (116) | eng | 348/0/0 | 0 | 0 | 24 |
| Spanish | LBLA (89) | eng | 347/1/0 | 17 | 0 | 0 |
| Spanish | NTV (127) | eng | 348/0/0 | 0 | 0 | 24 |
| Spanish | NVI-S (128) | eng | 347/1/0 | 17 | 0 | 1 |
| Spanish | RVR1960 (149) | eng | 346/2/0 | 17 | 0 | 1 |
| Portuguese | ARA (1608) | eng | 344/4/0 | 60 | 0 | 1 |
| Portuguese | ARC (212) | eng | 343/5/0 | 92 | 0 | 144 |
| Portuguese | NAA (1840) | eng | 345/3/0 | 43 | 0 | 13 |
| Portuguese | NVI (129) | eng | 347/1/0 | 17 | 0 | 96 |
| French | BDS (21) | org | 348/0/0 | 0 | 0 | 32 |
| French | LSG (93) | org | 298/48/2 | 0 | 0 | 0 |
| French | NBS (104) | org | 348/0/0 | 0 | 0 | 0 |
| French | PDV2017 (133) | org | 347/1/0 | 0 | 0 | 177 |
| French | S21 (152) | org | 347/1/0 | 0 | 0 | 0 |
| German | DELUT (51) | eng | 347/1/0 | 31 | 0 | 0 |
| German | Hfa (73) | org | 348/0/0 | 0 | 0 | 476 |
| German | SCH2000 (157) | org | 343/5/0 | 0 | 0 | 608 |
| Korean | KRV (88) | eng | 345/2/1 | 31 | 0 | 0 |
| Korean | RNKSV (142) | eng | 347/1/0 | 7 | 0 | 6 |
| Chinese (Simpl.) | CUNPSS-Shen (48) | eng | 348/0/0 | 52 | 0 | 70 |
| Chinese (Trad.) | CUNP-Shen (46) | eng | 348/0/0 | 52 | 0 | 70 |
| Indonesian | BIMK (27) | org | 285/63/0 | 99 | 0 | 643 |
| Indonesian | TB (306) | org | 281/63/4 | 342 | 0 | 1 |
| Russian | NRT (143) | rsc | 346/2/0 | 2,670 | **87** | 5 |
| Russian | SYNO (400) | rso | 348/0/0 | 3,052 | **124** | 0 |
| Tagalog | MBB05 (144) | eng | 347/1/0 | 20 | 0 | 157 |
| Tagalog | RTPV05 (399) | eng | 347/1/0 | 20 | 0 | 157 |
| Swahili | NEN (1627) | eng | 347/1/0 | 17 | 0 | 1 |
| Swahili | SUV (164) | eng | 347/1/0 | 69 | 0 | 14 |
| Hindi | HCV (1628) | eng | 347/1/0 | 17 | 0 | 19 |
| Hindi | HINOVBSI (1683) | eng | 347/1/0 | 17 | 0 | 1 |
| Japanese | JA1955 (81) | eng | 347/1/0 | 0 | 0 | 0 |
| Japanese | JCB (83) | eng | 345/3/0 | 35 | 0 | 2,020 |
| Arabic | AVD (13) | eng | 346/1/1 | 101 | 0 | 0 |
| Arabic | NAV (101) | eng | 347/1/0 | 39 | 0 | 1 |
| Italian | NR06 (122) | eng | 321/26/1 | 97 | 0 | 0 |
| Italian | RDV24 (141) | eng | 323/21/4 | 353 | 0 | 0 |
| Dutch | HSVU (1990) | org | 281/63/4 | 394 | 0 | 0 |
| Dutch | HTB (75) | org | 284/61/3 | 294 | 0 | 1,285 |
| Romanian | BDC (191) | eng | 347/1/0 | 31 | 0 | 0 |
| Romanian | NTR (126) | eng | 347/1/0 | 0 | 0 | 6 |
| Ukrainian | UBIO (186) | lxx | 252/96/0 | 2,329 | **169** | 0 |
| Ukrainian | UKRK (188) | eng | 314/22/12 | 1,065 | 0 | 0 |
| Polish | NBG (319) | org | 325/18/5 | 315 | 0 | 0 |
| Polish | PBG (132) | eng | 335/12/1 | 412 | 0 | 0 |
| Vietnamese | VIE1925 (193) | eng | 326/19/3 | 485 | 0 | 23 |
| Vietnamese | VIE2010 (151) | eng | 328/19/1 | 172 | 0 | 5 |

## Chapters fitting no system

- **NABRE**: PSA.2(11)
- **LSG**: JOB.39(38), MRK.9(51)
- **KRV**: SNG.6(14)
- **TB**: NEH.8(19), JOB.39(38), HOS.1(12), HOS.2(22)
- **AVD**: PSA.72(19)
- **NR06**: PSA.13(5)
- **RDV24**: NEH.13(32), PSA.13(5), PSA.123(5), MRK.9(51)
- **HSVU**: NEH.8(19), JOB.39(38), HOS.1(12), HOS.2(22)
- **HTB**: JOB.39(38), HOS.1(12), HOS.2(22)
- **UKRK**: LEV.5(27), LEV.6(22), LEV.14(55), NUM.20(28), NUM.25(17), PSA.13(5), PSA.24(9), PSA.29(10), PSA.54(6), PSA.89(51), PSA.106(47), ISA.9(22)
- **NBG**: EXO.38(30), PSA.93(6), PSA.109(32), JER.30(25), JER.31(39)
- **PBG**: JER.29(31)
- **VIE1925**: 1KI.6(37), JOB.39(38), MRK.9(51)
- **VIE2010**: JOB.39(38)

## Misplaced verses by chapter (non-eng/org labels)

- **NRT** (rsc), 87 verses: PSA.91 (16), PSA.57 (12), PSA.62 (12), PSA.63 (11), PSA.111 (10), PSA.98 (9), PSA.129 (8), PSA.133 (3), NUM.26 (1), 1KI.22 (1), 1CH.12 (1), NEH.7 (1), ISA.64 (1), REV.13 (1)
- **SYNO** (rso), 124 verses: DAN.6 (28), PSA.91 (16), PSA.57 (12), PSA.62 (12), PSA.63 (11), PSA.111 (10), PSA.98 (9), PSA.114 (8), PSA.129 (8), PSA.133 (3), NUM.26 (1), 1KI.22 (1), 1CH.12 (1), NEH.7 (1), ISA.64 (1), DAN.5 (1), REV.13 (1)
- **UBIO** (lxx), 169 verses: JER.36 (32), EXO.36 (27), JER.34 (22), PSA.91 (16), PSA.57 (12), PSA.62 (12), PSA.63 (11), PSA.111 (10), PSA.98 (9), PSA.129 (8), EXO.20 (3), PSA.133 (3), EXO.21 (2), DEU.5 (2)

## Synodal and Septuagint support

The engine now offers `rso`, `rsc`, `lxx` or `vul` as a per-chapter candidate
alongside `eng` and `org` for versions YouVersion labels with them (labels are
bundled by bible id; unlabelled versions keep `eng`/`org` only). Measured by
`packages/core/test/survey.test.ts`, which runs the TypeScript engine over
`counts.json`:

| Version | Skipped (before → after) | Misplaced (before → after) |
|---|---:|---:|
| NRT (143, `rsc`) | 2,670 → 0 | 87 → 0 |
| SYNO (400, `rso`) | 3,052 → 0 | 124 → 0 |
| UBIO (186, `lxx`) | 2,329 → 0 | 169 → 0 |

The other 51 versions map exactly as before. "Misplaced" here is checked on
the text, not against the label: the label turned out to be wrong for a few
chapters whose counts fit it by coincidence, and the survey's column counted
those as misplaced although the old engine had them right. UBIO follows
Hebrew order in Exodus 36 and Jeremiah 34 and 36 (the `lxx` table would move
them), and SYNO and NRT Nehemiah 7:68 (horses and mules, absent from the
Hebrew) is kept with English 7:68. Two of SIL's tables needed corrections,
also checked on the text: `rso` doesn't shift Daniel 5:31–6:28 as Synodal
does, and `lxx` puts the commandments in Greek order where UBIO keeps the
Hebrew. Psalms, Daniel 5–6 and Jeremiah 34–36 were spot-checked against NIV.

## Shared correction tables

A departure several versions share is written once, in
`packages/core/data/overrides/shared/`, and each version that follows it names
it in its own table. Every version was checked on its text (boundary verses
read against NIV on bible.com) before being given a table; none gets one from
its counts alone. Skipped verses, measured by `survey.test.ts` (no version
gained a misplaced verse):

| Version | Skipped (before → after) | Tables | Still skipped |
|---|---:|---|---|
| KJV (1), DELUT (51), NKJV (114), BDC (191) | 31 → 0 | Revelation 12, 3 John | |
| ESV, LBLA, NVI-S, NVI, RVR1960, NEN, HCV, HINOVBSI | 17 → 0 | Revelation 12 | |
| KRV (88) | 31 → 0 | Revelation 12, Song 6 (own) | |
| MSG (97) | 86 → 55 | Revelation 12, 3 John | 1 Chr 21, 2 Chr 35 |
| AVD (13) | 101 → 84 | Revelation 12 | 2 Kgs 4, Ps 72, 1 Tim 6 |
| NAV (101) | 39 → 22 | Revelation 12 | 1 Tim 6 |
| SUV (164) | 69 → 52 | Revelation 12 | John 7 |
| PBG (132) | 412 → 350 | Revelation 12, 3 John, Jeremiah 29 (own) | 11 chapters |
| ARC (212) | 92 → 32 | Revelation 12, 1 Samuel 20 | Judges 5 |
| ARA (1608) | 60 → 0 | Revelation 12, 1 Samuel 20 | |
| NAA (1840) | 43 → 0 | 1 Samuel 20 | |
| UKRK (188) | 1,065 → 1,000 | Revelation 12, 1 Samuel 20, Psalm 13 | 37 chapters |
| NR06 (122) | 97 → 25 | 1 Samuel 20, Psalm 13, Ecclesiastes 11–12 | 2 Sam 20 |
| RDV24 (141) | 353 → 230 | 1 Samuel 20, Psalm 13, Ecclesiastes 11–12, Mark 9 | 10 chapters |
| VIE2010 (151) | 172 → 0 | 1 Samuel 20, Job 38–41 | |
| VIE1925 (193) | 485 → 172 | 1 Samuel 20, Job 38–41, Mark 9–10, 1 Kings 6 (own) | 6 chapters |
| TB (306) | 342 → 0 | Exodus 5–6, 1 Samuel 20, Nehemiah 7–8, Job 38–41, Hosea 1–2, Haggai 1–2, Romans 7 | |
| HSVU (1990) | 394 → 0 | as TB, and John 1 (own) | |
| HTB (75) | 294 → 88 | 1 Samuel 20, Job 38–41, Hosea 1–2 | Exodus 6, Leviticus 16, Haggai 2 |
| BIMK (27) | 99 → 20 | Exodus 5–6, Romans 7 | Isaiah 38 |
| NABRE (463) | 318 → 307 | Psalm 2 (own) | Daniel 3, 13, 14 (Greek additions), John 7, Acts 10 |

LSG's own table was split into the shared 1 Samuel 20, Job 38–41,
Ecclesiastes 11–12 and Mark 9–10 tables, with only Job 34 left its own; NIV
and AMP now use the shared Revelation 12 table. Their maps are unchanged.

Het Boek is a paraphrase whose verse numbers drift inside the chapters it
renumbers (its Exodus 6:2 holds 6:2–3, its 6:3 is 6:4, and so on), so only
the chapters whose boundaries match HSV's exactly were given tables; the rest
waits for the merged-verse work (#3, task 5).

## Label coverage

The engine needs YouVersion's label to use `rso`, `rsc`, `lxx` or `vul`, and
the label is only on the unofficial bible.com API, so the app bundles it.
`configuration.json` there lists every language YouVersion has, with its
version count, and `versions.json` gives each language's versions with their
labels (one request per language, cached; `tools/versification-survey/languages.py`).
In Sept 2026: **2,462 languages, 3,864 versions**.

A language counts as covered when every one of its versions has a known
numbering: YouVersion's label, or a scan of its verse counts (bundled, so the
engine maps it, or refuses it, from its real counts).

| | Versions known | Languages fully known |
|---|---:|---:|
| Before (the 20 surveyed languages' labels) | 282 (7.3%) | 12 (0.5%) |
| Every label bundled | 3,082 (79.8%) | 1,862 (75.6%) |
| And 221 unlabelled versions scanned | **3,303 (85.5%)** | **2,070 (84.1%)** |

782 versions carry no label. Most are small: a single Gospel, Ruth and Jonah
read aloud, a psalter. `unlabelled.py` orders the uncovered languages by how
many chapters their unlabelled versions have; scanning the cheapest 200
languages' took 4,173 chapter requests and, with TUKARA84 below, covers all of them. They include the Russian oral
versions CAROS (3830), DROT (3873) and ROT (3764), which are Ruth and Jonah
only: there Hebrew and Synodal numbering agree, and Jonah 2:1 is the fish
swallowing Jonah, as mapped. The 11 unlabelled versions in Orthodox and
Eastern-rite languages (Adyghe, Altai, Bashkir, Buryat, Kabardian,
Macedonian, Greek, two Arabic) were scanned as well, being the ones an
English assumption is most likely to get wrong. One, TUKARA84 (3404, the
Iranian Turkmen language's only version), ids its chapters `MAT.1_1`,
`MAT.2_1`…, which isn't USFM, and was left out at first. The ids turned out
to be ordinary chapters with a `_1` suffix (GNA2025 does the same in its
Psalms and Philemon, NR2006 in its Psalms and Job, where an empty `PSA.1`,
`PSA.73`, `PSA.90` and `PSA.107` hold only a heading, "Libro primo" and so
on), so `scan.py` now counts `MAT.1_1` as Matthew 1
and TUKARA84 is scanned too. Whether YouVersion stores a highlight in such a
chapter under `MAT.1.5` or `MAT.1_1.5` hasn't been tested; if the latter,
the app's reads of those chapters find nothing, as for a version assumed
English.

`survey.test.ts` checks each unlabelled scan against all six systems:
wherever another system fits a chapter's count, would map it differently,
and fits the version's chapters of that book as well as the engine's choice,
the counts couldn't tell them apart and a verse could be misplaced. That
happened in Jonah 2 against `vul` (SIL's `vul.vrs` counts 11 verses there
but maps 10), until that was corrected (below), and happens now only in
Kabardian Nehemiah 7:68, mapped as English on purpose as in SYNO. So every unlabelled scan either maps with no verse misplaced or is
refused (next section).

**Bundle size.** The 3,082 labels as `{"id": "eng"}` would add 8 KB to the
gzipped app; packed per scheme as base-36 gaps between sorted ids, 1.6 KB.
Names for every version are 100 KB gzipped (titles in their own scripts
don't compress well), so they moved out of the main bundle into a chunk the
app loads when the versions card mounts, and the main bundle names none. The
221 scanned versions' counts add 6.4 KB (a book a version lacks is stored as
one `"BOOK": 0`; TUKARA84, added since, is 33 bytes of that, gzipped). Built with an app key (without one the UI is tree-shaken
away and sizes mislead), the main bundle is 166.2 KB gzipped against 166.0 KB
before, plus the 100.7 KB names chunk.

**Still unknown:** 561 unlabelled, unscanned versions in 392 languages. When
the app key can't read their verse counts they're assumed English, as before.
48 of them are in languages where YouVersion labels some version `rso`, `rsc`,
`lxx` or `vul`, mostly Welsh, Scottish Gaelic and English psalters and
Albanian, Slovenian and Romani portions: Protestant traditions, so likely
English or Hebrew numbered, but unchecked. A language hint wasn't added: the
languages are in the names chunk, not the engine, and for the Orthodox-region
languages a scan was cheaper and says more. Versions published after the scan
have no label or name at all.

## Refusing what can't be mapped

Without a label only `eng` and `org` are candidates, and counts alone can't
say which of the other four a version follows (UBIO fits `lxx` in 131
chapters and `rsc` in 130). So `buildVersionMap` refuses a version, with the
source `"unsupported"` and an empty map, when its known counts leave more than
80 chapters fitting neither `eng` nor `org` (leaving out chapters it lacks and
those a correction table describes) and it isn't labelled `rso`, `rsc`, `lxx`
or `vul`. The sync leaves it out entirely, keeping its snapshot; the add form
refuses it, and a saved one shows "Numbering not supported".

| | Chapters fitting neither `eng` nor `org` |
|---|---:|
| English and Hebrew numbered versions, most | 35 (UKRK; 38 before its correction tables) |
| The next | 11 (PBG, NBG) |
| Unlabelled scans, not refused, most | 23 (TMA-C, Arabic selections) |
| **Threshold** | **80** |
| Synodal and Septuagint versions (labelled, so not refused) | 131 (UBIO), 143 (NRT), 153 (SYNO) |
| Unlabelled scans refused | 132 (MAK2024PS), 133 (AdyBBL), 136 (BOTp), 187 (grcbrent) |
| The label-only tables themselves | 145 (`rsc`), 153 (`rso`), 180 (`vul`), 187 (`lxx`) |

80 is over twice the English/Hebrew maximum and 50 below the lowest Synodal
or Septuagint version. The four refused versions are a Macedonian psalter,
an Adyghe selection, a Bashkir Old Testament and Brenton's Greek Septuagint;
in each, Psalm 22 is "The Lord is my shepherd" (bible.com, Sept 2026), Psalm
23 in English, which the engine would otherwise have mapped as English Psalm
22. No English or Hebrew numbered version, labelled or scanned, is refused.

Two Synodal-numbered scans aren't refused, rightly: Kabardian and Altai have
none of the books where Synodal renumbers verses that English or Hebrew also
counts alike, so every chapter either maps as those would or is skipped.
The threshold is absolute, so a small Synodal selection whose books do hold
such chapters (a few psalms) could stay under it; the scans have none, and a
version with no counts at all can't be checked.

## Verified on the text (Sept 2026)

Counts only say which system a chapter fits. The two most used versions of
each language in `scripts/popular.mjs`, the two most used of each numbering
label (`rsc`: НРП, RSP; `vul`: DRC1752, CPDV) and NCV, 42 versions in all,
were checked on their text: every verse where numbering could go wrong
beside the NIV and LSG verses the engine pairs it with, every chapter the
engine skipped, and every stretch a verse-length aligner suspected
(`tools/versification-survey`, "Verifying a version's numbering"). They're
now listed in `scripts/verified.mjs` and skip no chapter.

**Mapped a verse off, though their counts fit a system:**

| Version | Chapter | What the text does |
|---|---|---|
| RVR1960 (149), NJB (4869) | Psalm 47 | English numbering (title unnumbered) in Hebrew's 10 verses: English 47:9 split in two |
| BW1975 (3490) | Jonah 2 | Hebrew division (the fish in 2:1) in English's 10 verses |
| VIE1925 (193) | Job 39:1-2 | English 38:39-40 in reverse order, under the shared Job table |
| KEH (101), HHBD (819), UBIO (186) | Judges 3, Matthew 1, 2 Kings 8 | a verse split differently, so a few verses run one off |
| SYNO (400) | Esther 1, Revelation 20 | the Synodal text's own divisions (Синод and НРП share Revelation 20) |
| НПУ (3269) | Psalms 86, 89 | the title numbered as verse 1, where its `lxx` label has verse 0 |
| DRC1752 (55), CPDV (42) | eleven chapters, Exodus 39 to Revelation 20 (most in `shared/vulgate-verses.map`) | the Vulgate's own divisions; Exodus 39 ran two verses off for twenty verses |
| CPDV (42) | Song of Songs 6, Psalms 71 and 99 | Song 6 one verse behind; the psalm's title a verse of its own |

**Corrections to SIL's tables** (`SUPPLEMENTAL` and `parseVrs` in
`versification.ts`), each affecting every version with that label:

- An uneven range starting at a Psalm title (`rso`: `PSA 115:0-10 = PSA
  116:10-19`) was paired from the start, putting every verse one late and
  Synodal 86:1 (Psalm 87's title) on Hebrew 86:1. The title is now folded
  into the first verse.
- `rso`: `ISA 3:20-25 = ISA 3:16-21`, a slip for `rsc`'s 3:21-26.
- `rsc`: Psalm 89:1, Moses' title, mapped to Hebrew 90's verse 0, which can't
  be highlighted, so it fell back to Hebrew 89:1, another psalm.
- `vul`: Jonah counted in the Hebrew division (16 and 11 verses) but mapped
  as English.

The rest needed tables only for chapters they skipped: a last verse running
on through the next (2 Samuel 20 in NR06 and NR2006, John 7 in CUNP and
SUV), a closing greeting given its own verse (1 Timothy 6 in AVD and KEH), a
chapter printed twice (HHBD's Judges 10) or a verse missing from the text
(UBIO's 2 Kings 8:6). Fifteen needed nothing. Six of the new tables are
shared: `1ti-6-22`, `2sa-20-25`, `jhn-1-52` (HSV's, now with NBG51),
`jhn-7-52`, `rev-20-8` and `vulgate-verses`.

CPDV's Esther is in the Greek order, with the Hebrew text in chapters 3-5,
6:8-7:19, 9:17-12:12 and 13:25-15:3. Its Greek additions have no Hebrew verse,
so its table sends them to Greek Esther (ESG), outside the 66 synced books,
as `vul.vrs` does with Daniel 13-14 (Susanna, Bel): they pair with no other
version's verse, so a highlight there stays in CPDV.

Left as they are: English verses that hold two Hebrew verses map to the
later one (1 Samuel 20:42, 1 Kings 22:43, 1 Chronicles 12:4), like Isaiah
64:1 (issue #6); and verses added from the Septuagint (Synodal Proverbs
13:14) share the canonical verse of their neighbour.

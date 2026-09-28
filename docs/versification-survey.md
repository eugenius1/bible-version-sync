# Versification survey: 54 versions, 20 languages

Sept 2026. Every chapter of 54 widely used YouVersion versions was scanned
(verse numbers present in each chapter, via the API behind bible.com) and
compared with the six standard numbering systems from SIL's libpalaso:
English (`eng`), Hebrew/Greek original (`org`), Russian Synodal (`rso`, `rsc`),
Septuagint (`lxx`) and Vulgate (`vul`). YouVersion labels each version with
one of these (`vrs`).

**Since then** the engine also supports `rso`, `rsc`, `lxx` and `vul` for
versions labelled with them ([below](#synodal-and-septuagint-support)). The
tables here are the survey as taken, against the two-system engine.

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
   282 labelled versions.
2. **Support `rso`, `rsc`, `lxx` and `vul`:** done; see
   [below](#synodal-and-septuagint-support).
3. **Bundle the scanned counts** for all 54 versions so they get
   count-based numbering without the API, and promote the English-numbered
   ones to "verified" once REV 12 / 3 John are handled generically.
4. **Write shared correction tables** for the Dutch/Indonesian tradition
   (Job 38–41, Hosea 1–2, Nehemiah 8 …).
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

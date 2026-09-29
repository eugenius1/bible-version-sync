// The most used versions of a few big languages, most used first. YouVersion
// publishes no ranking, so this is judgement: English follows the ECPA/Circana
// bestseller lists, the others what those languages' churches mostly read.
// Each list starts with, or includes, the version bible.com opens for the
// language (data/defaults.json). Ranks every version of a language in the
// scan for the person's versions (versionRank); gen-data checks each `abbr`
// against the bundled name, like verified.mjs.
export const POPULAR = {
  en: [
    { abbr: "NIV", bibleId: 111 },
    { abbr: "KJV", bibleId: 1 },
    { abbr: "ESV", bibleId: 59 },
    { abbr: "NLT", bibleId: 116 },
    { abbr: "NKJV", bibleId: 114 },
    { abbr: "CSB", bibleId: 1713 },
    { abbr: "AMP", bibleId: 1588 },
    { abbr: "NASB2020", bibleId: 2692 },
    { abbr: "NASB1995", bibleId: 100 },
    { abbr: "MSG", bibleId: 97 },
    { abbr: "NIrV", bibleId: 110 },
    { abbr: "CEV", bibleId: 392 },
    { abbr: "GNT", bibleId: 68 },
    { abbr: "NET", bibleId: 107 },
  ],
  es: [
    { abbr: "RVR1960", bibleId: 149 },
    { abbr: "NVI", bibleId: 128 },
    { abbr: "NTV", bibleId: 127 },
    { abbr: "LBLA", bibleId: 89 },
    { abbr: "NBLA", bibleId: 103 },
    { abbr: "DHH94I", bibleId: 52 },
    { abbr: "RVC", bibleId: 146 },
    { abbr: "TLA", bibleId: 176 },
    { abbr: "PDT", bibleId: 197 },
    { abbr: "NVI", bibleId: 1637 },
  ],
  pt: [
    { abbr: "NVI", bibleId: 129 },
    { abbr: "ARC", bibleId: 212 },
    { abbr: "ARA", bibleId: 1608 },
    { abbr: "NVT", bibleId: 1930 },
    { abbr: "NAA", bibleId: 1840 },
    { abbr: "NTLH", bibleId: 211 },
    { abbr: "A21", bibleId: 2645 },
  ],
  fr: [
    { abbr: "LSG", bibleId: 93 },
    { abbr: "S21", bibleId: 152 },
    { abbr: "BDS", bibleId: 21 },
    { abbr: "NEG79", bibleId: 106 },
    { abbr: "PDV2017", bibleId: 133 },
    { abbr: "NBS", bibleId: 104 },
    { abbr: "BFC", bibleId: 63 },
  ],
  de: [
    { abbr: "DELUT", bibleId: 51 },
    { abbr: "SCH2000", bibleId: 157 },
    { abbr: "Hfa", bibleId: 73 },
    { abbr: "NGU2011", bibleId: 108 },
    { abbr: "ELB", bibleId: 57 },
  ],
};

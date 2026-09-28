import { BOOKS } from "./versification";

export type Lang = "en" | "fr";

const NAMES: Record<Lang, string[]> = {
  en: [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
    "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
    "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
    "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
    "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
    "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John",
    "2 John", "3 John", "Jude", "Revelation",
  ],
  // Names as in the Louis Segond Bible.
  fr: [
    "Genèse", "Exode", "Lévitique", "Nombres", "Deutéronome", "Josué", "Juges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Rois", "2 Rois", "1 Chroniques", "2 Chroniques", "Esdras",
    "Néhémie", "Esther", "Job", "Psaumes", "Proverbes", "Ecclésiaste", "Cantique des cantiques",
    "Ésaïe", "Jérémie", "Lamentations", "Ézéchiel", "Daniel", "Osée", "Joël", "Amos", "Abdias",
    "Jonas", "Michée", "Nahum", "Habacuc", "Sophonie", "Aggée", "Zacharie", "Malachie", "Matthieu",
    "Marc", "Luc", "Jean", "Actes", "Romains", "1 Corinthiens", "2 Corinthiens", "Galates",
    "Éphésiens", "Philippiens", "Colossiens", "1 Thessaloniciens", "2 Thessaloniciens",
    "1 Timothée", "2 Timothée", "Tite", "Philémon", "Hébreux", "Jacques", "1 Pierre", "2 Pierre",
    "1 Jean", "2 Jean", "3 Jean", "Jude", "Apocalypse",
  ],
};

/** Book names keyed by USFM code (GEN -> Genesis), per language. */
export const BOOK_NAMES_BY_LANG: Record<Lang, Record<string, string>> = {
  en: Object.fromEntries(BOOKS.map((b, i) => [b, NAMES.en[i]])),
  fr: Object.fromEntries(BOOKS.map((b, i) => [b, NAMES.fr[i]])),
};

/** English book names keyed by USFM code. */
export const BOOK_NAMES = BOOK_NAMES_BY_LANG.en;

export const bookName = (code: string, lang: Lang = "en") => BOOK_NAMES_BY_LANG[lang][code] ?? code;

/** "PSA.51.3" -> "Psalms 51:3" (or "Psaumes 51:3") */
export function displayRef(ref: string, lang: Lang = "en"): string {
  const [b, c, v] = ref.split(".");
  return `${bookName(b, lang)} ${c}${v ? `:${v}` : ""}`;
}

/**
 * Parse a bible.com link (https://www.bible.com/bible/111/JHN.3.NIV) or
 * "111 NIV" / "111" into a version id and abbreviation.
 */
export function parseVersionInput(input: string): { bibleId: number; abbr?: string } | null {
  const s = input.trim();
  const link = /bible\/(\d+)\/[0-9A-Z]{3}(?:\.\d+)*\.([0-9A-Za-z-]+)/i.exec(s);
  if (link) return { bibleId: Number(link[1]), abbr: link[2].toUpperCase() };
  const plain = /^(\d+)(?:\s+([0-9A-Za-z-]+))?$/.exec(s);
  if (plain) return { bibleId: Number(plain[1]), abbr: plain[2]?.toUpperCase() };
  return null;
}

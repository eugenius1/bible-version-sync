import { BOOKS } from "./versification";

const NAMES = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah",
  "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
  "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
  "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
  "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
  "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John",
  "2 John", "3 John", "Jude", "Revelation",
];

/** English book names keyed by USFM code (GEN -> Genesis). */
export const BOOK_NAMES: Record<string, string> = Object.fromEntries(BOOKS.map((b, i) => [b, NAMES[i]]));

/** "PSA.51.3" -> "Psalms 51:3" */
export function displayRef(ref: string): string {
  const [b, c, v] = ref.split(".");
  return `${BOOK_NAMES[b] ?? b} ${c}${v ? `:${v}` : ""}`;
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

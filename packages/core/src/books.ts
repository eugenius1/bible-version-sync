import { BOOKS } from "./versification";

export type Lang = "en" | "es" | "pt" | "fr" | "id" | "sw" | "de" | "ru";

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
  // Reina-Valera 1960.
  es: [
    "Génesis", "Éxodo", "Levítico", "Números", "Deuteronomio", "Josué", "Jueces", "Rut",
    "1 Samuel", "2 Samuel", "1 Reyes", "2 Reyes", "1 Crónicas", "2 Crónicas", "Esdras",
    "Nehemías", "Ester", "Job", "Salmos", "Proverbios", "Eclesiastés", "Cantares", "Isaías",
    "Jeremías", "Lamentaciones", "Ezequiel", "Daniel", "Oseas", "Joel", "Amós", "Abdías", "Jonás",
    "Miqueas", "Nahúm", "Habacuc", "Sofonías", "Hageo", "Zacarías", "Malaquías", "Mateo",
    "Marcos", "Lucas", "Juan", "Hechos", "Romanos", "1 Corintios", "2 Corintios", "Gálatas",
    "Efesios", "Filipenses", "Colosenses", "1 Tesalonicenses", "2 Tesalonicenses", "1 Timoteo",
    "2 Timoteo", "Tito", "Filemón", "Hebreos", "Santiago", "1 Pedro", "2 Pedro", "1 Juan",
    "2 Juan", "3 Juan", "Judas", "Apocalipsis",
  ],
  // Almeida Revista e Corrigida, in Brazilian spelling.
  pt: [
    "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute",
    "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras",
    "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cânticos", "Isaías",
    "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oseias", "Joel", "Amós", "Obadias", "Jonas",
    "Miqueias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus",
    "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas",
    "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo",
    "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João",
    "2 João", "3 João", "Judas", "Apocalipse",
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
  // Terjemahan Baru.
  id: [
    "Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan", "Yosua", "Hakim-hakim", "Rut",
    "1 Samuel", "2 Samuel", "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh", "Ezra",
    "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal", "Pengkhotbah", "Kidung Agung", "Yesaya",
    "Yeremia", "Ratapan", "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja", "Yunus",
    "Mikha", "Nahum", "Habakuk", "Zefanya", "Hagai", "Zakharia", "Maleakhi", "Matius",
    "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "2 Korintus", "Galatia",
    "Efesus", "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius",
    "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus", "1 Petrus", "2 Petrus", "1 Yohanes",
    "2 Yohanes", "3 Yohanes", "Yudas", "Wahyu",
  ],
  // Swahili Union Version.
  sw: [
    "Mwanzo", "Kutoka", "Mambo ya Walawi", "Hesabu", "Kumbukumbu la Torati", "Yoshua", "Waamuzi",
    "Ruthu", "1 Samweli", "2 Samweli", "1 Wafalme", "2 Wafalme", "1 Mambo ya Nyakati",
    "2 Mambo ya Nyakati", "Ezra", "Nehemia", "Esta", "Ayubu", "Zaburi", "Mithali", "Mhubiri",
    "Wimbo Ulio Bora", "Isaya", "Yeremia", "Maombolezo", "Ezekieli", "Danieli", "Hosea", "Yoeli",
    "Amosi", "Obadia", "Yona", "Mika", "Nahumu", "Habakuki", "Sefania", "Hagai", "Zekaria",
    "Malaki", "Mathayo", "Marko", "Luka", "Yohana", "Matendo ya Mitume", "Warumi",
    "1 Wakorintho", "2 Wakorintho", "Wagalatia", "Waefeso", "Wafilipi", "Wakolosai",
    "1 Wathesalonike", "2 Wathesalonike", "1 Timotheo", "2 Timotheo", "Tito", "Filemoni",
    "Waebrania", "Yakobo", "1 Petro", "2 Petro", "1 Yohana", "2 Yohana", "3 Yohana", "Yuda",
    "Ufunuo",
  ],
  // Luther 2017, with "Psalm" as references write it (Psalm 23:1).
  de: [
    "1. Mose", "2. Mose", "3. Mose", "4. Mose", "5. Mose", "Josua", "Richter", "Rut",
    "1. Samuel", "2. Samuel", "1. Könige", "2. Könige", "1. Chronik", "2. Chronik", "Esra",
    "Nehemia", "Ester", "Hiob", "Psalm", "Sprüche", "Prediger", "Hoheslied", "Jesaja",
    "Jeremia", "Klagelieder", "Hesekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadja", "Jona",
    "Micha", "Nahum", "Habakuk", "Zefanja", "Haggai", "Sacharja", "Maleachi", "Matthäus",
    "Markus", "Lukas", "Johannes", "Apostelgeschichte", "Römer", "1. Korinther", "2. Korinther",
    "Galater", "Epheser", "Philipper", "Kolosser", "1. Thessalonicher", "2. Thessalonicher",
    "1. Timotheus", "2. Timotheus", "Titus", "Philemon", "Hebräer", "Jakobus", "1. Petrus",
    "2. Petrus", "1. Johannes", "2. Johannes", "3. Johannes", "Judas", "Offenbarung",
  ],
  // Synodal, with "Псалом" as references write it (Псалом 22:1). Samuel and
  // Kings are 1–4 Царств there.
  ru: [
    "Бытие", "Исход", "Левит", "Числа", "Второзаконие", "Иисус Навин", "Судьи", "Руфь",
    "1 Царств", "2 Царств", "3 Царств", "4 Царств", "1 Паралипоменон", "2 Паралипоменон", "Ездра",
    "Неемия", "Есфирь", "Иов", "Псалом", "Притчи", "Екклесиаст", "Песнь песней", "Исаия",
    "Иеремия", "Плач Иеремии", "Иезекииль", "Даниил", "Осия", "Иоиль", "Амос", "Авдий", "Иона",
    "Михей", "Наум", "Аввакум", "Софония", "Аггей", "Захария", "Малахия", "От Матфея",
    "От Марка", "От Луки", "От Иоанна", "Деяния", "Римлянам", "1 Коринфянам", "2 Коринфянам",
    "Галатам", "Ефесянам", "Филиппийцам", "Колоссянам", "1 Фессалоникийцам", "2 Фессалоникийцам",
    "1 Тимофею", "2 Тимофею", "Титу", "Филимону", "Евреям", "Иакова", "1 Петра", "2 Петра",
    "1 Иоанна", "2 Иоанна", "3 Иоанна", "Иуды", "Откровение",
  ],
};

/** Book names keyed by USFM code (GEN -> Genesis), per language. */
export const BOOK_NAMES_BY_LANG = Object.fromEntries(
  Object.entries(NAMES).map(([lang, names]) => [lang, Object.fromEntries(BOOKS.map((b, i) => [b, names[i]]))]),
) as Record<Lang, Record<string, string>>;

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

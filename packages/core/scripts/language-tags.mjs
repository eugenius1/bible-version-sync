// How import-survey.mjs turns YouVersion's language tags (ISO 639-3, some
// with a suffix of its own) into BCP 47, without asking Intl to canonicalise.
// Intl.getCanonicalLocales and new Intl.Locale both apply CLDR's aliases,
// which change with Node's ICU: Node 22 and 23 turn mnk (Mandinka) into man
// (the Mandingo macrolanguage) and keep gom (Goan Konkani), while the import
// that wrote names.json before had kok for gom and kept mnk. names.json then
// changed with whichever Node ran the import. Written out here, the result
// is the same everywhere.

// ISO 639-3 codes that aren't BCP 47's preferred tag, with the tag the app
// uses: the two-letter code where there is one (eng -> en), and where
// YouVersion tags an individual language of a macrolanguage that browsers
// report by the macrolanguage (cmn -> zh, arb -> ar, swh -> sw, pes -> fa),
// the macrolanguage, so a reader whose browser says zh finds the Chinese
// versions. This is what CLDR gave in Sept 2026, frozen. gom and mnk are
// deliberately absent: YouVersion's own, more precise tags are kept.
export const LANGUAGE_ALIASES = {
  aar: "aa", afr: "af", aka: "ak", als: "sq", amh: "am", arb: "ar", asm: "as", ava: "av",
  ayr: "ay", azj: "az", bak: "ba", bcc: "bal", bcl: "bik", bel: "be", ben: "bn", bis: "bi",
  bod: "bo", bos: "bs", bre: "br", bul: "bg", bxk: "luy", bxr: "bua", cat: "ca", ces: "cs",
  che: "ce", chv: "cv", cmn: "zh", cor: "kw", cos: "co", cym: "cy", daf: "dnj", dan: "da",
  deu: "de", dgo: "doi", dhd: "mwr", dik: "din", diq: "zza", div: "dv", dzo: "dz", ekk: "et",
  ell: "el", eng: "en", epo: "eo", esk: "ik", est: "et", eus: "eu", ewe: "ee", fao: "fo",
  fas: "fa", fat: "ak", fij: "fj", fin: "fi", fra: "fr", gaz: "om", gbo: "grb", gla: "gd",
  gle: "ga", glg: "gl", glv: "gv", gug: "gn", guj: "gu", gya: "gba", hat: "ht", hau: "ha",
  heb: "he", her: "hz", hin: "hi", hmo: "ho", hrv: "hr", hun: "hu", hye: "hy", ibo: "ig",
  iii: "ii", ike: "iu", ind: "id", isl: "is", ita: "it", jav: "jv", jpn: "ja", kan: "kn",
  kat: "ka", kaz: "kk", khk: "mn", khm: "km", kik: "ki", kin: "rw", kir: "ky", kmr: "ku",
  kor: "ko", kpv: "kv", kua: "kj", lao: "lo", lat: "la", lav: "lv", lbk: "bnc", leg: "enl",
  lin: "ln", lit: "lt", lug: "lg", lvs: "lv", mal: "ml", mar: "mr", mhr: "chm", mkd: "mk",
  mlt: "mt", mri: "mi", msa: "ms", mya: "my", nav: "nv", nbl: "nr", nde: "nd", ndo: "ng",
  nld: "nl", nno: "nn", nob: "nb", npi: "ne", nya: "ny", oci: "oc", ori: "or", orm: "om",
  ory: "or", oss: "os", pan: "pa", pbu: "ps", pes: "fa", plt: "mg", pnb: "lah", pol: "pl",
  por: "pt", prs: "fa-AF", pus: "ps", quz: "qu", rmy: "rom", ron: "ro", run: "rn", rus: "ru",
  sag: "sg", san: "sa", sin: "si", slk: "sk", slv: "sl", smo: "sm", sna: "sn", snd: "sd",
  som: "so", sot: "st", spa: "es", sqi: "sq", srp: "sr", ssw: "ss", sun: "su", swc: "sw-CD",
  swe: "sv", swh: "sw", tam: "ta", tat: "tt", tel: "te", tgk: "tg", tgl: "fil", tha: "th",
  tir: "ti", ton: "to", tsn: "tn", tso: "ts", ttq: "tmh", tuk: "tk", tur: "tr", twi: "ak",
  uig: "ug", ukr: "uk", urd: "ur", uzb: "uz", ven: "ve", vie: "vi", vol: "vo", wol: "wo",
  xho: "xh", xpe: "kpe", ybd: "rki", ydd: "yi", yid: "yi", yor: "yo", zai: "zap", zho: "zh",
  zsm: "ms", zul: "zu", zyb: "za",
};

// YouVersion's suffixes for the script or the country (hin_ro is Hindi in
// Roman script, fuv_ar Fulfulde in Arabic script, spa_es Spanish of Spain).
// The clear ones become the BCP 47 script or region; any other suffix
// (gax_ars, Arsi Oromo) is a variety BCP 47 has no subtag for, and the base
// language is enough.
const TAG_SUFFIX = {
  rom: "Latn", ro: "Latn", lat: "Latn", latn: "Latn", ltr: "Latn",
  ar: "Arab", arb: "Arab", kur: "Arab",
  cyr: "Cyrl",
  dev: "Deva", dv: "Deva",
  es: "ES", pt: "PT", tw: "TW", mz: "MZ",
};

/** language[-Script][-REGION], conventionally cased. */
export const TAG = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;

/**
 * The BCP 47 tag for a YouVersion language tag (eng -> en, zho_tw -> zh-TW,
 * hin_ro -> hi-Latn). Throws on one that doesn't make a well-formed tag.
 * Intl only checks the result is valid; its canonical form isn't used.
 */
export function bcp47(youVersionTag) {
  const [base, suffix] = String(youVersionTag).split("_");
  const [language, region] = (LANGUAGE_ALIASES[base] ?? base).split("-");
  const extra = suffix === undefined ? undefined : TAG_SUFFIX[suffix];
  const script = extra?.length === 4 ? extra : undefined;
  const country = extra?.length === 2 ? extra : undefined;
  if (region && country) throw new Error(`${youVersionTag}: two regions`);
  const tag = [language, script, region ?? country].filter(Boolean).join("-");
  if (!TAG.test(tag)) throw new Error(`${youVersionTag}: ${tag} isn't a well-formed tag`);
  new Intl.Locale(tag); // throws if not valid BCP 47
  return tag;
}

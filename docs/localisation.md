# Localisation

How strings, plurals and languages work. Part of the [developer docs](../CONTRIBUTING.md).

`apps/web/src/i18n/en.ts` is the canonical shape; every other locale is typed
against it, so a missing key is a build error. Strings are data: placeholders
are `{name}`, filled by `f()`, and counts are `[singular, plural]` pairs picked
by `Intl.PluralRules` (French and Brazilian Portuguese take the singular for
zero; Indonesian has no plural, so both forms are the same). Russian counts
take three forms, `[one, few, many]` (1 стих, 2 стиха, 5 стихов); the tests
allow a third form only in a language whose plural rules have a "few". Tests
assert that the locales share every key, placeholders match, nothing is
accidentally still English, and French punctuation (`:` `;` `?` `!`) is
preceded by a no-break space. Book names live in `packages/core/src/books.ts`,
one list of 66 per language, each from that language's most read Bible.

British English (`en-gb.ts`) isn't written out: it's `en.ts` respelled
(colour, grey), so it can't fall behind. It's the default for English
readers in the UK, Ireland and the Commonwealth countries that teach British
spelling (`BRITISH_REGIONS` in `i18n/core.ts`); Canada stays American.

Adding a language: a dictionary in `apps/web/src/i18n/`, its book names in
`books.ts`, the code in `Lang` there, and the dictionary imported and added
to `DICTIONARIES` in `apps/web/src/i18n/core.ts`, which the picker and the
language detection read (the `Lang` change fails to typecheck until it's
there). The picker lists English first,
then the reader's own languages, then the rest by their own names. Chinese and Korean are left out
for now: their text doesn't break at spaces, and the layout hasn't been
checked for it.

**Never build a sentence in `packages/core`.** The engine returns structured
data (`Difference`, `blocked`, `SignInError` codes) and the app phrases it, so
switching language re-renders everything.

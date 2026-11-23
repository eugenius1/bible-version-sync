---
paths:
  - "apps/web/src/**/*.{ts,tsx}"
---

# The web app

- **Every user-visible string goes in `i18n/en.ts`**, and every other locale
  gets it translated in the same change; `i18n.test.ts` fails on a string left
  in English.
- **A new component gets a component test** in its `__tests__` folder,
  rendered inside `I18nProvider`.
- **A new text/background colour pairing goes in `contrast.test.ts`.**
- **Development-only code is checked with `import.meta.env.DEV` where it's
  used**, not only where its data is loaded, so production never shows it and
  the build leaves it out.

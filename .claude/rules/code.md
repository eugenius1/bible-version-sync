---
paths:
  - "**/*.{ts,tsx,mjs}"
---

# Code in this repository

- **Comments explain why, not what**, at the density of the code around them.
- **Reuse before writing.** Most things a change needs already exist; search
  `packages/core/src` and `apps/web/src/lib` before adding a helper:
  - verses and chapters: `ref`, `parseRef`, `chapterKey`, `chapterRef`,
    `parseChapter` (`versification.ts`); a chapter is a `ChapterKey`, never a
    `Ref`;
  - showing them: the i18n `ref`, `book`, `plural`, `num`, `duration`;
  - colours: `HIGHLIGHT_COLORS`, `HIGHLIGHT_HEX`, `nearestColor`;
  - the sync memory: `emptyState`, `migrateState`.
- **No licence header** in any source file, generated ones included.

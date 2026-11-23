---
paths:
  - "packages/core/src/**/*.ts"
---

# The engine

- **The engine returns structured data and the app phrases it**: no sentence
  is built in `packages/core`, so switching language re-renders everything.
- **The sync's safety rules hold** ([docs/sync-rules.md](../../docs/sync-rules.md)).
  Each has a test; when one fails, the code is what changes.

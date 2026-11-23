# Notes for coding agents

Before changing code, read [CONTRIBUTING.md](CONTRIBUTING.md): running the
app, its conventions (commit messages, credentials), and which doc in `docs/`
explains the part you're changing: the sync rules, the YouVersion API, verse
matching, or localisation. Read that doc too. The rules for code itself are in
`.claude/rules/`, each scoped by its `paths:` to the files it covers: Claude
Code loads them as you touch those files; any other agent reads the matching
ones before editing.

A browser-only PWA that syncs YouVersion highlights across Bible versions.
npm workspaces: `packages/core` (engine), `apps/web` (Vite, React, Tailwind).
No server.

## Before every commit

```bash
npm run check
```

## Before every push

Unless the change is trivial, strongly recommended: run `/code-review --fix`
(or an equivalent review-and-fix pass) over the branch's changes, using Claude
Sonnet or a model of similar strength, then commit its fixes and re-run the
pre-commit check above. It catches bugs, duplication, dead code and needless
complexity that the checks don't.

## Attribution

End every commit message with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Use the model that actually did the work.

## Never touch someone's highlights without being asked

Highlights are a person's years of reading and can't be recovered once removed.

- Against a real account, only **read** (previews, `check`) unless the user
  asks for a specific sync. Never run a whole-Bible apply on your own.
- Don't weaken the engine's safety rules in `packages/core/src/sync.ts`: a
  failed read skips the whole book; a version's own change and an existing
  highlight are never overridden; the first sync never removes or recolours;
  unread, unwritable or newly added versions are never treated as removals;
  large removals need consent. Each has a test — if one fails, fix the code,
  not the test.

## Never commit credentials

The app key (`apps/web/.env.local`, `tools/python-cli/config.json`) and sign-in
tokens (`tools/python-cli/.yvsync/`, IndexedDB) stay out of the repository.
They're gitignored; check `git status` before committing anyway. The
vendored `youversion-platform-api` skill says app keys can go in source code;
here they don't, and where that skill and
[docs/youversion-api.md](docs/youversion-api.md) disagree about the API, the
doc wins.

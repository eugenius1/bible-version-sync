# Developing Bible Version Sync

Everything a contributor needs. The [README](README.md) is for people using the
app; this is for people changing it; [AGENTS.md](AGENTS.md) holds the handful
of rules that bind coding agents specifically.

## Running it

Needs Node and a YouVersion Platform app key.

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # put your app key in it
npm run dev                                     # http://localhost:8001
```

If the install fails:

- The minimum Node is `engines` in [package.json](package.json), and
  `engine-strict` in [.npmrc](.npmrc) makes `npm install` refuse an older
  one. [.nvmrc](.nvmrc) is the version CI uses; `nvm use` picks it, so the
  bundled data regenerates exactly as in CI.
- npm 10 crashes on this workspace ("Cannot read properties of null (reading
  'edgesOut')"); `npx npm@11 install` works. npm 11 holds back esbuild's
  install script by default, which the build doesn't need.

`npm run dev` is for editing: instant reload, but no Content-Security-Policy
and no service worker. `npm run preview` serves the production build from
`apps/web/dist/` (run `npm run build` first) with both, so use it to check
what users will get.

To look at the stats page without an account or a sync, open `#stats?demo`
on the dev server: made-up data, never saved, and left out of production
builds. Each port is its own origin with its own IndexedDB, so if the dev
server moves off 8001 (`PORT`, or a port already in use), you start with no
settings, no sync memory and no sign-in.

`npm test` runs every workspace's tests in one vitest run, from the root
[vitest.config.ts](vitest.config.ts); each workspace keeps its own environment
and setup. `npm run coverage` adds coverage, one lcov report in the root
`coverage/`, which CI uploads to Codecov; [codecov.yml](codecov.yml) splits it
back into core and web by path.

`npm run lint` runs oxlint ([.oxlintrc.json](.oxlintrc.json)); a rule that is
only noise here is turned off there with a comment saying why.

`npm run check` is the gate: it regenerates the bundled data, lints,
typechecks every package, runs all tests and builds the app. Run it before
every commit.

The tooling every workspace uses (vitest, TypeScript, Vite, `@types/node`,
oxlint) is a dev dependency of the root only, so there is one version of each.
A workspace's own `package.json` still lists everything its code imports.

**App key and callback.** Create an app at
<https://platform.youversion.com>. The key goes in `apps/web/.env.local` as
`VITE_YV_APP_KEY` (git ignores that file). The app's callback URL must be
`<origin><base>callback`, where the base is `/` unless the app is served
below a domain's root (`BASE_PATH`). The dev server is pinned to port 8001 so
that `http://localhost:8001/callback` stays valid. `PORT` moves it, but sign-in
only works on a port whose callback is registered for the key. The key isn't a secret — it's
an OAuth client id and ends up in the built JavaScript — but keep your real
value out of the repository anyway.

**Deploying.** Pushes to `main` deploy to GitHub Pages at
<https://eusebius.tech/bible-version-sync/> (`.github/workflows/deploy.yml`).
The custom domain belongs to the `eugenius1.github.io` user site, so this
project is served under `/bible-version-sync/`, and the build is run with
`BASE_PATH=/bible-version-sync/`. The app key comes from the `VITE_YV_APP_KEY`
repository variable (Settings → Secrets and variables → Actions → Variables),
and `https://eusebius.tech/bible-version-sync/callback` must be registered in
the portal. Pages has no SPA fallback, so the build copies `index.html` to
`callback.html`, which Pages serves at `/callback`.

To host it elsewhere, `npm run build` writes a static site to `apps/web/dist/`.
Set `BASE_PATH` and `VITE_YV_APP_KEY` at build time and register the
callback as above. The production build carries a strict
Content-Security-Policy (see `apps/web/vite.config.ts`).

## Conventions

The rules for code are in [.agents/rules/](.agents/rules): one file for all
code, one for the web app, one for the engine, each scoped to its files.
Claude Code reads them through the `.claude/rules` symlink, loading each when
it touches a matching file, and CodeRabbit reviews against them
([.coderabbit.yaml](.coderabbit.yaml) maps each file to the same globs as its
`paths:` frontmatter; keep the two in step). Add a rule there rather than
here, and make a rule a check instead when a lint or test can catch it.

- **Never commit an app key, tokens or someone's highlights.** `.env.local`,
  `tools/python-cli/config.json` and `.yvsync/` are gitignored for this.
- **Commit messages are prose.** Explain the reasoning and what went wrong, not
  a changelog line.

## Layout

| Path | What |
|---|---|
| `packages/core` | The sync engine: verse mapping, merge rules, API client, sign-in helpers, and the runner that ties them together. Framework-free TypeScript, so a future server can use it unchanged. |
| `packages/core/data` | Verse-numbering data and correction tables, bundled into `src/data.generated.ts` by `npm run gen -w @bvs/core`. |
| `apps/web` | The web app: Vite, React, Tailwind CSS v4, lucide icons, Dexie (IndexedDB), dnd-kit, vite-plugin-pwa. |
| `tools/python-cli` | The original Python prototype, kept for reference. The TypeScript mapping was checked against it verse for verse. |
| `tools/versification-survey` | The scanner and data behind the bundled verse counts, labels and names. The app never reads it; `import-survey` copies from it. |
| `tools/youversion-skill.sh` | Refreshes the vendored YouVersion agent skill (see below). |

## Where things are explained

Read the one your change touches:

- [docs/sync-rules.md](docs/sync-rules.md): what a sync does to each verse,
  the snapshot, and the safety rules. For `packages/core/src/sync.ts` and
  `runner.ts`.
- [docs/youversion-api.md](docs/youversion-api.md): the API's traps (reads a
  chapter at a time, expired tokens that look like network errors, the rate
  limit, `PSA.1_1` ids). For `api.ts`, `auth.ts` and anything that calls them.
- [docs/versions.md](docs/versions.md): matching verses across numbering
  systems, verifying a version, and naming and finding versions. For
  `versification.ts`, `discover.ts` and `packages/core/data`.
- [docs/localisation.md](docs/localisation.md): strings, plurals and adding a
  language. For `apps/web/src/i18n` and `books.ts`.

## Things that will bite you elsewhere

**Nahum is `NAM`, not `NAH`.** Use the USFM book codes exactly as `BOOKS` in
`versification.ts` lists them. A wrong code silently drops the book.

**Node's types stop at the tests.** `packages/core` runs in the browser, so its
`tsconfig.json` sets `"types": []`, and a stray `process` or `Buffer` fails
the typecheck instead of the app. Its tests get Node from
`tsconfig.test.json`; the web app does the same, and its Vite configs are
typechecked by the root `tsconfig.node.json`. Each workspace's `typecheck`
covers both its configs.

**English Psalm titles are verse 0.** `eng.vrs` maps them (`PSA 51:0 = PSA
51:1`), but a verse 0 can't be highlighted, so those mappings are ignored.

**bible.com's pages answer scripts with a bot challenge**, but the API behind
them works from plain scripts; the survey uses that (see
[its README](tools/versification-survey/README.md)).

**The Content-Security-Policy forbids inline scripts.** That's why the theme's
pre-paint script is `apps/web/public/theme-init.js`, a file, rather than inline
like in most apps. It mirrors `resolveTheme()` in `apps/web/src/theme.ts`; keep
the two in step.

**Tailwind v4 can't `@apply` a custom class from a plain layer.** Shared styles
(`card`, `btn`, `input`, `picker`…) are declared with `@utility` in
`apps/web/src/index.css` for that reason.

**Dark mode is a class, not a media query.** `@custom-variant dark` keys off
`.dark` on `<html>`, so the theme icon in the header can override the system.

**Reordering uses dnd-kit's pointer sensor, not HTML drag and drop**, which
touch screens never fire (`apps/web/src/components/Sortable.tsx`). Only the
grip handle starts a drag, so the rest of the row still scrolls the page. The
handles take the arrow keys themselves rather than dnd-kit's keyboard sensor,
and dnd-kit's announcements are silenced, since they're English only. In
jsdom, give the `<ol>` a size as well as the rows: the drag is kept inside
the list, and an unmeasured list clamps every drop to the top.

**Some embedded browsers don't allow service workers.** Test offline support in
a real Chrome. For screenshots of signed-in screens without a real account
(other than the stats page, which has `#stats?demo`), a throwaway headless Chrome (fresh `--user-data-dir`, driven over the DevTools
protocol) with a fake token written to IndexedDB works well; any API call then
exercises the sign-in-expired path.

## Colour and contrast

Colours come from Tailwind's default palette: stone for neutrals, amber for the
accent. `apps/web/src/__tests__/contrast.test.ts` reads Tailwind's own values
and checks every text/background pairing the components use against WCAG AA,
in both themes. It's why light mode uses amber-600 for focus rings and amber-700
for the progress bar. Add a pairing there when you add a colour.

## The vendored YouVersion skill

`.agents/skills/youversion-platform-api` is copied from
[youversion/platform-skills](https://github.com/youversion/platform-skills)
(Apache-2.0, its `LICENSE` alongside, the commit in `.upstream`). Skills live
in `.agents/skills`, which Codex and other agents read, and `.claude/skills`
is a symlink to it because Claude Code reads only that; add new skills to
`.agents/skills`. The SDK and React skills upstream aren't copied, since the
app calls the API with plain `fetch` and shows no Bible text.

**[docs/youversion-api.md](docs/youversion-api.md) overrides it.** The skill covers only `/v1/bibles`
and passages, not highlights or sign-in, and it's written for apps that show
text: it treats `/v1/bibles` as the only source of version ids, where here
the list is a subset and versions are bundled.

`tools/youversion-skill.sh` refreshes the copy, and `--check` fails when
upstream has changed it; the "YouVersion skill / Up to date" check runs that on
every PR. It isn't a required check, so an upstream change shows red without
blocking unrelated PRs: run the script, read what changed against
[docs/youversion-api.md](docs/youversion-api.md), and commit it. Don't edit the copy by hand; the check fails on that
too.

## Claude review on PRs

`.github/workflows/claude-review.yml` runs Claude's `/security-review`, from
the shared action in
[eugenius1/actions](https://github.com/eugenius1/actions), on every non-draft
PR from this repo and posts findings as
inline comments, using the owner's Claude plan through the
`CLAUDE_CODE_OAUTH_TOKEN` secret (made with `claude setup-token`; renew it
when it expires). Fork and Dependabot PRs are skipped, since they can't read
the secret. It reports but isn't a required check: a job that fails because
the token expired or the plan's usage ran out would block every merge, and a
finding is advice, not a pass or fail.

**A green tick on a PR that edits `claude-review.yml` means nothing.** The
action refuses to run when the workflow file differs from the one on `main`
("Workflow validation failed"), and then exits successfully having done
nothing, in about ten seconds. So the PR that changes the workflow, including
the one that added it, is never reviewed by it, and neither is a PR that
touches the file later. Check the job log for that message before trusting the
tick, and test a change to the workflow on a later PR that doesn't touch it.
Because of that, keep a PR that edits the workflow minimal and free of
production code: it gets no Claude review, so anything else in it gets none
either. Put the code in its own PR.

A change to the shared actions isn't checked that way: once merged there, it
runs on every repo's next PR.

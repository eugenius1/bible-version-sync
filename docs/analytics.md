# Analytics, errors and feedback

What the app sends to PostHog and the rules for adding to it. Part of the
[developer docs](../CONTRIBUTING.md). The reasons are in
[ADR 0001](adr/0001-posthog-for-usage-errors-and-feedback.md).

The app sends usage events, errors and feedback to PostHog Cloud EU, in the
project it shares with the author's other sites. All of it goes through one
module, `apps/web/src/lib/analytics.ts`; nothing else imports `posthog-js`.
With no `VITE_POSTHOG_KEY` (in dev, tests and forks) it does nothing.

## Adding an event

Add it only to answer a question you actually have. Before adding one, check:

- **Counts and states, nothing personal.** No verse references, highlight
  colours, version names or ids, YouVersion user ids, or text typed or
  shown on screen. `{ highlighted: 12, versions: 3 }` is fine; `{ verse: "JHN.3.16" }`
  isn't.
- **A name in snake_case, past tense**: `sync_applied`, not `clickSync`.
- **No raw error messages in events.** Pass a short reason you chose, such
  as `reason: "network"`. Errors go through `trackError`, whose messages lose
  their API paths.
- **No new URLs.** Anything with a query string is stripped before it's sent;
  don't work around that.

Then add it to `Events` and the table below, and to the Privacy page's text
(`privacy` in `i18n/en.ts`, in every language) if it sends something the page
doesn't already describe.

## Events

Defined in `Events` in `apps/web/src/lib/analytics.ts`, which types every
`track()` call.

| Event | Properties | When |
|---|---|---|
| `$pageview` | — | Each page, including hash changes (not the sign-in callback) |
| `signed_in` | — | Sign-in completes |
| `version_added` | `versions` | A version is added |
| `preview_run` | `versions`, `books`, `differences`, `failedBooks`, `stopped` | A preview finishes or is stopped |
| `sync_applied` | `versions`, `books`, `highlighted`, `removed`, `failedBooks`, `writeErrors`, `stopped` | A sync finishes or is stopped |
| `sync_failed` | `reason` (`auth`, `network`, `rateLimited`, `unexpected`) | A preview or sync stops on an error |
| `app_installed` | — | The PWA is installed |
| `$exception` | PostHog's | An uncaught error, or one the app caught and showed (`trackError`) |
| `survey sent` | the Feedback survey's | Feedback is sent (`sendFeedback`, not through the SDK) |

Every event also carries `app: "bible-version-sync"`.

## The person's choice

The switch on the Privacy page (`#privacy`) is kept in `localStorage`
(`bvs-usage-data`), the only thing stored for analytics. It starts on, or off
when the browser sends Do Not Track or Global Privacy Control. Turned off,
`before_send` drops every event. Feedback doesn't go through the SDK, so it
still goes: the person sends it on purpose. PostHog's own opt-out does nothing
in cookieless `always` mode, which is why the check is ours.

## Feedback

The Feedback page (`#feedback`) is the app's own form, translated like the
rest. It sends a `survey sent` event to the "Feedback" API survey, whose ids
are in `FEEDBACK_SURVEY`; answers show in PostHog under Surveys, filtered by
`app`. A changed question in PostHog keeps its id, so the code doesn't change.

`sendFeedback` posts the event itself (`/i/v0/e/`) rather than through the
SDK, whose queue reports nothing back, and the page says "sent" only once
PostHog answers OK. Otherwise, as when an ad blocker stops the request, it
says it couldn't be sent and keeps what was typed. Each response has a
random one-off `distinct_id` and no person profile, so it isn't tied to the
visitor's events, and nothing is stored.

## The PostHog project

One project, "Web apps" on PostHog Cloud EU, shared with the author's other
sites. Its settings match the code: cookieless tracking on, autocapture,
heatmaps, dead clicks, console and performance capture off, exception capture
on, and surveys not shown by PostHog. The token is the `VITE_POSTHOG_KEY`
repository variable that the deploy workflow builds with; without it the app
sends nothing.

## Checking it end to end

Unit tests (`lib/__tests__/analytics.test.ts`) cover the scrubbing and the
switch; tests always run without a key, so they never reach PostHog. To see
what a real build sends:

1. Put the project token in `apps/web/.env.local` as `VITE_POSTHOG_KEY` (it's
   on the project's settings page, or `vars.VITE_POSTHOG_KEY` in the repo).
2. `npm run build` then `npm run preview`. `npm run dev` works too, but has
   no Content-Security-Policy, so it won't catch a blocked request.
3. Open the app with `?__posthog_debug=true` before the hash, e.g.
   `http://localhost:8001/?__posthog_debug=true#privacy`. PostHog logs each
   event as it sends it, after `scrub()`, and keeps a `ph_debug` flag in
   `localStorage` until you remove it. The query itself is never sent.
4. Check, in DevTools:
   - Network: requests go only to `eu.i.posthog.com/e/`, and no script loads
     from PostHog.
   - Console: no Content-Security-Policy errors.
   - Application: no PostHog cookie, and nothing in `localStorage` but
     `bvs-usage-data` (and `ph_debug`), even after sending feedback.
   - Feedback with a blocker on (or `eu.i.posthog.com` blocked in DevTools'
     Network request blocking) says it couldn't be sent.
5. To test error capture, dispatch an error in the console, since one thrown
   from DevTools isn't attributed to the page:
   `dispatchEvent(new ErrorEvent("error", { error: new Error("Test: HTTP 404 on /v1/bibles/1/passages/JHN.3") }))`.
   It should arrive with the path as `/…`.
6. Confirm arrival in PostHog: Activity, or with the PostHog MCP server (the
   PostHog Claude Code plugin), an `execute-sql` such as
   `SELECT event, timestamp, properties.$current_url FROM events WHERE timestamp > now() - INTERVAL 10 MINUTE ORDER BY timestamp DESC`.
   Events take up to a minute to show.

Insights and Web analytics hide traffic from `localhost` and `127.0.0.1` by
default (the project's test-account filters), so local checks don't count as
use. Feedback sent while testing still shows under Surveys: say in it that
it's a test.

A service worker from an earlier preview can keep serving the old build.
Unregister it in DevTools (Application → Service workers) after rebuilding.

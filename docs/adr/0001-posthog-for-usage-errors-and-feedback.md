# PostHog, cookieless and with named events only, for usage, errors and feedback

The app needs three things it doesn't have: usage numbers, reports of errors
users hit, and a way for users to send feedback (#76). The site that hosts it
(eusebius.tech) needs cookieless analytics to replace Google Analytics
(eugenius1/eugenius1.github.io#59), and later web apps will want the same. So
one service should cover all of them. It must be free under about 100 users
and cost under $20 a month above that.

We use **PostHog Cloud EU** for all three, in **one project shared by every
app**. Each app adds an `app` property to every event (`app:
"bible-version-sync"`). The free plan is enough: 1M events, 100k exceptions
and 1,500 survey responses a month, with no card. Its terms allow commercial
use.

The privacy rules are the hard-to-reverse part, because data can't be
recalled once sent:

- **Cookieless** (`cookieless_mode: "always"`): nothing is stored in the
  browser and there is no consent banner. The cost is weak retention and
  funnel figures across days.
- **Only events we name**. No autocapture and no session replay: they record
  text on screen, and here that text includes verses and someone's
  highlights. Using a Bible app at all hints at religious belief, which
  UK GDPR treats as special-category data. So events carry counts, never
  verse references, highlight colours, version names or YouVersion user ids,
  and we never call `identify`.
- **Query strings are removed** from every URL before an event is sent. The
  sign-in callback's `?code=` must never leave the browser. Error messages
  lose their API paths, which name versions and chapters.
- **Users can turn it off** with a switch on the app's own Privacy page,
  which travels with the app wherever it's hosted. Do Not Track and Global
  Privacy Control turn it off until the person chooses.

`posthog-js` is bundled from npm rather than loaded from PostHog, so the
Content-Security-Policy keeps `script-src 'self'` and only gains the EU
ingest host in `connect-src`. That rules out PostHog's survey pop-up, which
loads its own script and shows only the text typed into PostHog, in one
language. Feedback is instead our own form, translated like the rest of the
app, that sends answers to an API survey. The answers still appear in
PostHog's Surveys view.

## Considered options

- **Umami** (Cloud or self-hosted on an existing VPS, MIT licence): simpler
  and lighter, and also cookieless. But it has no surveys, and its error
  tracking hasn't been checked. Its free Cloud plan allows one website, and
  the Pro plan, needed for more, is $20 a month. It stays the fallback, and
  self-hosting it costs nothing beyond the VPS.
- **One PostHog project per app**: keeps errors and dashboards apart, but
  needs the pay-as-you-go plan (a card, 6 projects) and gains no extra free
  allowance. Data can't be moved between projects, so an app that later
  needs its own project starts it empty.
- **A reverse proxy** to get past ad blockers: there's no server, so it
  would be new infrastructure (say, a Cloudflare Worker). We accept the lost
  events for now. A proxy can be added later without changing the app.
- **Autocapture or session replay**: rejected for the reasons above.

## Consequences

- Every new event is reviewed against the rules above. See
  [docs/analytics.md](../analytics.md).
- PostHog's terms let it use customer data to train its models unless the
  account opts out. Opt out in the organisation's settings.
- The README stops saying that nothing leaves the browser, and the app's
  Privacy page describes PostHog. The site's privacy policy covers only the
  site.

/**
 * English strings. This file is the canonical shape: every other locale is
 * typed against it, so a missing key fails the build.
 *
 * Counts use `plural`: [singular, plural], with the count as `{n}`.
 * Other placeholders are `{name}`, filled with `f()`.
 */
export const en = {
  meta: {
    localeTag: "en",
    name: "English (US)",
  },

  app: {
    back: "Back",
    languageLabel: "Language",
    themeLabel: "Appearance",
    copyright: "© {years}",
    licence: "Open source",
    licenceTitle: "GNU General Public License, version 3 or later",
    notAffiliated: "Not affiliated with YouVersion.",
  },

  themes: {
    system: "System",
    light: "Light",
    dark: "Dark",
  },

  signIn: {
    intro:
      "Highlight a verse in one Bible version and see it in the others you read. Verses line up even where versions number them differently (Psalm titles, Job and more).",
    points: [
      "Your first sync never recolors or removes existing highlights.",
      "Preview changes before anything is saved.",
      "Your sign-in and data stay in this browser and go only to YouVersion.",
    ],
    button: "Sign in with YouVersion",
    opening: "Opening YouVersion…",
    disclaimer: "Connects to YouVersion only with your permission.",
    reelTitle: "Video showing how Bible Version Sync works",
    missingKey: "Missing app key. Set VITE_YV_APP_KEY in apps/web/.env.local and restart.",
  },

  callback: {
    finishing: "Finishing sign-in…",
    failed: "Sign-in didn't complete",
    stateMismatch: "This sign-in didn't match the one we started, or it took too long. Please try again.",
    noPermission:
      "Access to your highlights wasn't allowed, and the app needs it. Please sign in again and allow it.",
    provider: "YouVersion reported a problem: {detail}",
  },

  priority: {
    title: "When a verse's colors differ, which wins?",
    toggle: "Prioritize by color instead of by version",
    byVersion: "Version priority",
    byColor: "Color priority",
    helpByVersion: "Existing highlights keep their color. A version without one gets the color from the first version in your list that has one.",
    helpByColor: "Existing highlights keep their color. A version without one gets whichever of the verse's colors is highest in this list.",
    note: "bible.com offers only yellow, green, blue, peach and pink; the others come from the mobile apps.",
    drag: "Reorder {color}: drag, or use the up and down arrow keys",
    names: {
      purple: "Purple",
      aqua: "Aqua",
      yellow: "Yellow",
      green: "Green",
      blue: "Blue",
      peach: "Peach",
      pink: "Pink",
      paleYellow: "Pale yellow",
      orange: "Orange",
      grey: "Gray",
    },
  },

  versions: {
    title: "Your versions",
    help: "The Bible versions to keep in sync. Verses line up even where versions number them differently.",
    source: {
      verified: {
        text: "Numbering checked",
        hint: "Verse numbering checked chapter by chapter for this version.",
      },
      scanned: {
        text: "Numbering known",
        hint: "This version's verse counts come with the app (scanned from bible.com, Sept 2026) but haven't been checked by hand. Chapters that follow no standard numbering are skipped.",
      },
      "api-index": {
        text: "Numbering from YouVersion",
        hint: "Verse counts come from YouVersion. Chapters that follow no standard numbering are skipped.",
      },
      assumed: {
        text: "Numbering guessed",
        hint: "We couldn't check this version's verse counts, so we're assuming {system} numbering. Highlights in Psalms and some Old Testament chapters may land on the wrong verse.",
      },
      unsupported: {
        text: "Can't be synced",
        hint: "{n} chapters of this version don't follow English or Hebrew numbering, and YouVersion doesn't say which system they use (Russian Synodal, Septuagint…), so highlights could land on the wrong verses. It's skipped in every sync and its highlights aren't touched.",
      },
    },
    /** Fills {system} in source.assumed.hint ({n} in source.unsupported.hint is a number of chapters). */
    systems: {
      eng: "English",
      org: "Hebrew",
      rso: "Russian Synodal",
      rsc: "Russian Synodal",
      lxx: "Septuagint",
      vul: "Vulgate",
    },
    checking: "Checking numbering…",
    unnamed: "Version {id}",
    drag: "Reorder {abbr}: drag, or use the up and down arrow keys",
    remove: "Remove {abbr}",
    confirmRemove: "Stop syncing {abbr}? Its highlights stay in YouVersion.",
    addLabel: "Add a version",
    addPlaceholder: "Name, abbreviation or number",
    add: "Add",
    adding: "Checking…",
    alreadyAdded: "Already added",
    number: "No. {id}",
    moreResults: "Showing {shown} of {total}. Keep typing to narrow it down.",
    noResults: "No version matches “{query}”.",
    find: {
      examples: "These are examples. Find the versions you actually highlight in, or add your own below.",
      button: "Find my versions",
      again: "Search again",
      help: "Checks a few well-known chapters in every version in your language to see where you've highlighted. Nothing is changed.",
      helpLabel: "How does this work?",
      starting: "Starting…",
      progress: "Finding your versions · {done} of {total}",
      stop: "Stop",
      stopping: "Stopping…",
      stoppingButton: "Stopping",
      stopped: "Stopped after checking {done} of {total}.",
      stoppedAtStart: "Stopped before anything was checked.",
      failed: "Couldn't finish searching: {problem}",
      none: "No highlights found in Isaiah 41, Philippians 4 or John 3. Add your versions below.",
      foundTitle: "Versions with your highlights",
      verses: ["{n} highlighted verse in the sample", "{n} highlighted verses in the sample"],
      unsupported: "Can't be synced: numbering not supported",
      inList: "In your list",
      add: "Add {abbr}",
      notFound: "In your list, but no highlights found: {list}.",
      useThese: ["Use this version", "Use these {n} versions instead"],
    },
    errors: {
      cantRead: "Couldn't check highlights for {abbr}: {problem}",
      unsupported:
        "{abbr} can't be synced: {n} of its chapters use a numbering we can't match.",
    },
  },

  sync: {
    title: "Sync",
    scopeLegend: "What to sync",
    chapter: "Chapter",
    book: "Book",
    bible: "Whole Bible",
    chapterCount: ["{book} has {n} chapter in {abbr}.", "{book} has {n} chapters in {abbr}."],
    labelled: "{label}: {value}",
    chaptersLabel: "Chapters × versions",
    about: "about {time}",
    durationTo: "{from} to {to}",
    keepOpen: "Keep this page open until it finishes.",
    preview: "Preview changes",
    syncNow: "Sync now",
    confirmBible: "Sync the whole Bible without previewing first?",
    previewing: "Previewing",
    syncing: "Syncing",
    starting: "Starting…",
    reading: "Checking {book}",
    remaining: "about {time} left",
    remainingRange: "{time} left",
    writing: "Updating {book}",
    stop: "Stop",
    stopping: "Stopping…",
    stoppingWriting: "Stopping once {book} is finished…",
    stoppingButton: "Stopping",
    stopNote: "A book that's being updated finishes first, so nothing is left half-done.",
    tooFew: "Add at least two supported versions to sync.",
    resumePreview: "The next preview picks up at {book}, where the last one stopped.",
    resumeSync: "The next sync picks up at {book}, where the last one stopped.",
    startOver: "Start over",
  },

  results: {
    previewTitle: "Preview",
    doneTitle: "Sync finished",
    viewStats: "View stats",
    stopped: "(stopped)",
    inSyncDone: "Everything was already in sync.",
    inSyncPreview: "Nothing to change: everything is already in sync.",
    inSyncStoppedDone: [
      "Nothing needed changing in the book synced before stopping.",
      "Nothing needed changing in the {n} books synced before stopping.",
    ],
    inSyncStoppedPreview: [
      "Nothing to change in the book checked before stopping.",
      "Nothing to change in the {n} books checked before stopping.",
    ],
    stoppedBeforeBook: "Stopped before a full book was checked, so there's nothing to show. Nothing was changed.",
    added: ["{n} highlight added", "{n} highlights added"],
    removedCount: ["{n} removed", "{n} removed"],
    toAdd: ["{n} highlight to add", "{n} highlights to add"],
    toRemove: ["{n} to remove", "{n} to remove"],
    differences: [
      "{n} verse has different colors; each version keeps its own.",
      "{n} verses have different colors; each version keeps its own.",
    ],
    booksSkipped: [
      "{n} book was skipped because its highlights couldn't be checked. Nothing in it was changed.",
      "{n} books were skipped because their highlights couldn't be checked. Nothing in them was changed.",
    ],
    writeErrors: ["{n} change couldn't be saved; the next sync will try again.", "{n} changes couldn't be saved; the next sync will try again."],
    stoppedBecause: "Stopped: {problem} Nothing more was changed.",
    signInAgain: "Sign in again",
    apply: ["Apply {n} change", "Apply {n} changes"],
    blocked: [
      "{n} book was left unchanged because syncing would remove many highlights at once. Continue only if you want them removed:",
      "{n} books were left unchanged because syncing would remove many highlights at once. Continue only if you want them removed:",
    ],
    applyWithRemovals: "Apply, including removals",
    skippedRead: "skipped: couldn't check highlights",
    notApplied: "not applied: would remove {removals} highlights (limit is {limit} per sync)",
    differentColors: "Different colors",
    differenceNote: "Each keeps its own; versions without a highlight get {winner}'s color.",
    removed: "removed",
    action: { fill: "add", recolor: "change color", remove: "remove" },
    more: "…and {n} more",
    refused: "Left out because their numbering isn't supported: {names}. Nothing was checked or changed in them.",
  },

  problems: {
    signInExpired: "your YouVersion sign-in expired. Sign in again.",
    unreachable:
      "can't reach YouVersion. Check your connection. If you're online, the app may have made too many requests and YouVersion is making it wait a few minutes.",
    rateLimited: [
      "YouVersion is limiting requests from this app. Try again in {n} minute.",
      "YouVersion is limiting requests from this app. Try again in {n} minutes.",
    ],
    rateLimitedSoon: "YouVersion is limiting requests from this app. Try again in a few minutes.",
  },

  stats: {
    title: "Your highlights",
    note: "Based on what this browser remembers from your last syncs, so it may differ from YouVersion now.",
    empty: "Nothing synced yet. Stats appear here after your first sync.",
    demo: "Made-up data for development; nothing here is saved.",
    verses: ["verse highlighted", "verses highlighted"],
    chapters: "chapters synced",
    chaptersOf: "of {total} ({percent})",
    versions: ["version", "versions"],
    perVersion: "By version",
    highlights: ["{n} highlight", "{n} highlights"],
    added: ["{n} added by syncing", "{n} added by syncing"],
    unwritable: ["{n} verse couldn't be highlighted", "{n} verses couldn't be highlighted"],
    colorCount: "{color}: {n}",
    overlap: "Across versions",
    everywhere: "In every version",
    some: "In some versions",
    one: "In only one version",
    differing: ["{n} verse is colored differently across versions.", "{n} verses are colored differently across versions."],
    byBook: "By book",
    bookRow: [
      "{book}: {n} verse highlighted, {synced} of {chapters} chapters synced",
      "{book}: {n} verses highlighted, {synced} of {chapters} chapters synced",
    ],
    topChapters: "Most highlighted chapters by count",
    topShare: "Most highlighted chapters by share",
    versesOf: "{n} of {total} verses",
    pace: "Speed",
    perRead: "{time} to check one chapter in one version",
    perWrite: "{time} to highlight a verse",
    seconds: "{n} s",
    noPace: "Not measured yet. Timings are recorded during a preview or sync.",
  },

  footer: {
    memory: ["Sync history: {n} verse", "Sync history: {n} verses"],
    stats: "Stats",
    reset: "Reset",
    confirmReset:
      "Reset your sync history? Your next sync will only add missing highlights. It won't remove or recolor any.",
    signOut: "Sign out",
  },
};

export type Dictionary = typeof en;

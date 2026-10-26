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
    copyright: "© {years} Eusebius Ngemera",
    licence: "GPLv3",
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
      "Highlight a verse in one Bible version, and have it show up in the others you read. Verse numbers are matched even where versions differ (Psalm titles, Joel, Malachi, Job and more).",
    points: [
      "Existing highlights are never recolored or removed on your first sync.",
      "Preview every change before anything is written.",
      "Your sign-in and data stay in this browser and go only to YouVersion.",
    ],
    button: "Sign in with YouVersion",
    opening: "Opening YouVersion…",
    disclaimer: "Uses the YouVersion Platform API with your permission.",
    missingKey: "Missing app key. Set VITE_YV_APP_KEY in apps/web/.env.local and restart.",
  },

  callback: {
    finishing: "Finishing sign-in…",
    failed: "Sign-in didn't complete",
    stateMismatch: "This sign-in doesn't match the one the app started, or it took too long. Please sign in again.",
    noPermission:
      "You signed in but didn't allow access to highlights, which this app needs. Please sign in again and allow it.",
    provider: "YouVersion reported a problem: {detail}",
  },

  priority: {
    title: "When a verse's colors differ, which wins?",
    toggle: "Use color priority instead of version priority",
    byVersion: "Version priority",
    byColor: "Color priority",
    helpByVersion: "Each version keeps its own color. Versions without a highlight get the color from the version listed first.",
    helpByColor: "Each version keeps its own color. Versions without a highlight get the color listed first, whichever version it's in; between two versions with the same color, the version order decides.",
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
    help: "The versions you highlight in. Verses are matched even where their numbering differs.",
    source: {
      verified: {
        text: "Verified numbering",
        hint: "Verse numbering checked chapter by chapter for this version.",
      },
      scanned: {
        text: "Verse counts known",
        hint: "This version's verse counts come with the app (scanned from bible.com, Sept 2026), but its numbering hasn't been checked by hand. Chapters that follow no standard system are skipped.",
      },
      "api-index": {
        text: "Numbering from YouVersion",
        hint: "Verse counts come from the YouVersion API. Chapters that follow no standard system are skipped.",
      },
      assumed: {
        text: "Numbering assumed",
        hint: "Couldn't read this version's verse counts, so {system} numbering is assumed. Highlights in Psalms and some Old Testament chapters may land on the wrong verse.",
      },
      unsupported: {
        text: "Numbering not supported",
        hint: "{n} chapters of this version match neither English nor Hebrew numbering, and YouVersion doesn't say which system it follows (Russian Synodal, Septuagint…), so highlights would land on the wrong verses. It's left out of every sync, and its highlights aren't touched.",
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
    confirmRemove: "Remove {abbr} from syncing? Its highlights stay in YouVersion.",
    addLabel: "Add a version",
    addPlaceholder: "Search by name, abbreviation or number",
    add: "Add",
    adding: "Checking…",
    addHelp: "Your languages come first. You can also paste a link from bible.com, like",
    alreadyAdded: "Already added",
    number: "No. {id}",
    moreResults: "Showing {shown} of {total}. Keep typing to narrow it down.",
    noResults: "No version matches “{query}”.",
    find: {
      examples: "These are example versions. Let the app find the ones you highlight in, or add your own below.",
      button: "Find my versions",
      again: "Look again",
      help: "Samples your highlights in a few well-known chapters of every version in your language. Nothing is changed.",
      starting: "Starting…",
      progress: "Looking for your highlights · {done} of {total}",
      stop: "Stop",
      stopping: "Stopping…",
      stoppingButton: "Stopping",
      stopped: "Stopped after checking {done} of {total}.",
      stoppedAtStart: "Stopped before anything was checked.",
      failed: "Couldn't finish looking: {problem}",
      none: "No highlights found in the chapters sampled (Isaiah 41, Philippians 4, John 3). Add your versions below.",
      foundTitle: "You highlight in",
      verses: ["{n} highlighted verse in the sample", "{n} highlighted verses in the sample"],
      unsupported: "Numbering not supported, so it can't be synced",
      inList: "In your list",
      add: "Add {abbr}",
      notFound: "No highlights found in {list} in the chapters sampled.",
      useThese: ["Use this version", "Use these {n} versions instead"],
    },
    errors: {
      cantRead: "Couldn't read highlights for version {id}: {problem}",
      unsupported:
        "Version {id} can't be synced: {n} of its chapters match neither English nor Hebrew numbering, and YouVersion doesn't say which system it follows, so highlights would land on the wrong verses.",
    },
  },

  sync: {
    title: "Sync",
    scopeLegend: "What to sync",
    chapter: "Chapter",
    book: "Book",
    bible: "Whole Bible",
    chapterCount: ["{book} has {n} chapter in {abbr}.", "{book} has {n} chapters in {abbr}."],
    estimate: [
      "Reads {n} chapter: about {preview} for a preview, {sync} for a sync. Keep this page open.",
      "Reads {n} chapters: about {preview} for a preview, {sync} for a sync. Keep this page open.",
    ],
    preview: "Preview changes",
    syncNow: "Sync now",
    confirmBible: "Sync the whole Bible now, without a preview?",
    previewing: "Previewing",
    syncing: "Syncing",
    starting: "Starting…",
    reading: "Reading {book}",
    remaining: "about {time} left",
    remainingRange: "{time} left",
    writing: "Writing {book}",
    bookProgress: "{doing} — {percent}",
    stop: "Stop",
    stopping: "Stopping…",
    stoppingWriting: "Stopping once {book} is written…",
    stoppingButton: "Stopping",
    stopNote: "Stopping now leaves a book that's being written to finish first, so nothing is left half-done.",
    tooFew: "At least two versions whose numbering is supported are needed to sync.",
    resumePreview: "The next preview picks up at {book}, where the last one stopped.",
    resumeSync: "The next sync picks up at {book}, where the last one stopped.",
    startOver: "Start over",
  },

  results: {
    previewTitle: "Preview",
    doneTitle: "Sync finished",
    stopped: "(stopped)",
    inSyncDone: "Everything was already in sync.",
    inSyncPreview: "Nothing to change — everything is in sync.",
    inSyncStoppedDone: [
      "Nothing needed changing in the book synced before stopping.",
      "Nothing needed changing in the {n} books synced before stopping.",
    ],
    inSyncStoppedPreview: [
      "Nothing to change in the book read before stopping.",
      "Nothing to change in the {n} books read before stopping.",
    ],
    stoppedBeforeBook: "Stopped before a whole book was read, so there's nothing to show. Nothing was changed.",
    added: ["{n} highlight added", "{n} highlights added"],
    removedCount: ["{n} removed", "{n} removed"],
    toAdd: ["{n} highlight to add", "{n} highlights to add"],
    toRemove: ["{n} to remove", "{n} to remove"],
    differences: [
      "{n} verse has different colors; each version keeps its own.",
      "{n} verses have different colors; each version keeps its own.",
    ],
    booksSkipped: [
      "{n} book was skipped because highlights couldn't be read. Nothing was changed in it.",
      "{n} books were skipped because highlights couldn't be read. Nothing was changed in them.",
    ],
    writeErrors: ["{n} change failed; the next sync retries it.", "{n} changes failed; the next sync retries them."],
    authExpired: "Stopped: your YouVersion sign-in has expired. Nothing more was changed.",
    network:
      "Stopped: YouVersion isn't answering. Check your connection. If you're online, the app has probably asked too often for now: YouVersion then makes it wait several minutes. Nothing more was changed.",
    rateLimited: [
      "Stopped: YouVersion has had too many requests from the app for now. Try again in {n} minute. Nothing more was changed.",
      "Stopped: YouVersion has had too many requests from the app for now. Try again in {n} minutes. Nothing more was changed.",
    ],
    rateLimitedSoon: "Stopped: YouVersion has had too many requests from the app for now. Try again in a few minutes. Nothing more was changed.",
    signInAgain: "Sign in again",
    apply: ["Apply {n} change", "Apply {n} changes"],
    blocked: [
      "{n} book was not changed because the sync would remove a lot of highlights at once. If you meant to remove them, continue:",
      "{n} books were not changed because the sync would remove a lot of highlights at once. If you meant to remove them, continue:",
    ],
    applyWithRemovals: "Apply, including removals",
    skippedRead: "skipped: couldn't read",
    notApplied: "not applied: would remove {removals} highlights (limit {limit} per run)",
    differentColors: "Different colors",
    differenceNote: "Each keeps its own; versions without a highlight get {winner}'s color.",
    removed: "removed",
    action: { fill: "add", recolor: "change color", remove: "remove" },
    more: "…and {n} more",
    refused: "Left out because their numbering isn't supported: {names}. Nothing was read or changed in them.",
  },

  problems: {
    signInExpired: "your YouVersion sign-in has expired. Sign in again.",
    unreachable:
      "YouVersion isn't answering. Check your connection. If you're online, the app has probably asked too often for now: YouVersion then makes it wait several minutes.",
    rateLimited: [
      "YouVersion has had too many requests from the app for now. Try again in {n} minute.",
      "YouVersion has had too many requests from the app for now. Try again in {n} minutes.",
    ],
    rateLimitedSoon: "YouVersion has had too many requests from the app for now. Try again in a few minutes.",
  },

  stats: {
    title: "Your highlights",
    note: "From the sync memory in this browser: each chapter as it was after its last sync, not as it is in YouVersion now.",
    empty: "Nothing synced yet. Stats appear here after your first sync.",
    demo: "Made-up data for development; nothing here is saved.",
    verses: ["verse highlighted", "verses highlighted"],
    chapters: "chapters synced",
    chaptersOf: "of {total} ({percent})",
    versions: ["version", "versions"],
    perVersion: "By version",
    highlights: ["{n} highlight", "{n} highlights"],
    added: ["{n} added by the sync", "{n} added by the sync"],
    unwritable: ["{n} verse YouVersion wouldn't take", "{n} verses YouVersion wouldn't take"],
    colorCount: "{color}: {n}",
    overlap: "Across versions",
    everywhere: "In every version",
    some: "In some",
    one: "In just one",
    differing: ["{n} verse has different colors in different versions.", "{n} verses have different colors in different versions."],
    byBook: "By book",
    bookRow: [
      "{book}: {n} verse highlighted, {synced} of {chapters} chapters synced",
      "{book}: {n} verses highlighted, {synced} of {chapters} chapters synced",
    ],
    topChapters: "Most highlighted chapters",
    topShare: "Most highlighted chapters by share",
    versesOf: "{n} of {total} verses",
    pace: "Speed",
    perRead: "{ms} ms to read a chapter",
    perWrite: "{ms} ms to write a highlight",
    noPace: "Not measured yet: it's timed during a preview or sync.",
  },

  footer: {
    memory: ["Sync memory: {n} verse", "Sync memory: {n} verses"],
    stats: "Stats",
    reset: "Reset",
    confirmReset:
      "Forget what previous syncs did? The next sync will only fill in blanks; it won't remove or recolor anything.",
    signOut: "Sign out",
  },
};

export type Dictionary = typeof en;

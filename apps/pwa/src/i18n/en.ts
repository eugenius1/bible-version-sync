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
    name: "English",
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
    missingKey: "Missing app key. Set VITE_YV_APP_KEY in apps/pwa/.env.local and restart.",
  },

  callback: {
    finishing: "Finishing sign-in…",
    failed: "Sign-in didn't complete",
    stateMismatch: "This sign-in doesn't match the one the app started, or it took too long. Please sign in again.",
    noPermission:
      "You signed in but didn't allow access to highlights, which this app needs. Please sign in again and allow it.",
    provider: "YouVersion reported a problem: {detail}",
  },

  versions: {
    title: "Your versions",
    help: "When a verse has different colors, each version keeps its own. Versions without a highlight get the color from the one listed first.",
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
    moveUp: "Move {abbr} up",
    moveDown: "Move {abbr} down",
    remove: "Remove {abbr}",
    confirmRemove: "Remove {abbr} from syncing? Its highlights stay in YouVersion.",
    addLabel: "Add a version",
    addPlaceholder: "bible.com link or version number",
    nameLabel: "Short name",
    namePlaceholder: "Name",
    add: "Add",
    adding: "Checking…",
    addHelp: "Open the version on bible.com and copy the address, for example:",
    errors: {
      unparseable: "Paste a bible.com link like bible.com/bible/111/JHN.3.NIV, or type the number (111).",
      needName: "Add a short name for this version, e.g. KJV.",
      duplicateVersion: "That version is already in the list.",
      duplicateName: "The name {name} is already used.",
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
    bibleNote: "Reads about {n} chapters. This can take a while; keep this page open.",
    preview: "Preview changes",
    syncNow: "Sync now",
    confirmBible: "Sync the whole Bible now, without a preview?",
    previewing: "Previewing",
    syncing: "Syncing",
    starting: "Starting…",
    reading: "Reading {book} · {done} of {total} chapters",
    writing: "Writing {book} · {done} of {total} changes",
    stop: "Stop",
    stopNote: "Stopping finishes the current book first, so nothing is left half-done.",
    tooFew: "At least two versions whose numbering is supported are needed to sync.",
  },

  results: {
    previewTitle: "Preview",
    doneTitle: "Sync finished",
    stopped: "(stopped)",
    inSyncDone: "Everything was already in sync.",
    inSyncPreview: "Nothing to change — everything is in sync.",
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
    network: "Stopped: couldn't reach YouVersion. Check your connection and try again. If it keeps happening, sign in again.",
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

  footer: {
    memory: ["Sync memory: {n} verse", "Sync memory: {n} verses"],
    reset: "Reset",
    confirmReset:
      "Forget what previous syncs did? The next sync will only fill in blanks; it won't remove or recolor anything.",
    signOut: "Sign out",
  },
};

export type Dictionary = typeof en;

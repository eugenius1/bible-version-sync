const num = (n: number) => n.toLocaleString("en");
const s = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const en = {
  langName: "English",
  back: "Back",

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
    disclaimer: "Not affiliated with YouVersion. Uses the YouVersion Platform API with your permission.",
    missingKey: "Missing app key. Set VITE_YV_APP_KEY in apps/pwa/.env.local and restart.",
  },

  callback: {
    finishing: "Finishing sign-in…",
    failed: "Sign-in didn't complete",
    stateMismatch: "This sign-in doesn't match the one the app started, or it took too long. Please sign in again.",
    noPermission:
      "You signed in but didn't allow access to highlights, which this app needs. Please sign in again and allow it.",
    provider: (detail: string) => `YouVersion reported a problem: ${detail}`,
  },

  versions: {
    title: "Your versions",
    help: "When a verse has different colors, each version keeps its own. Versions without a highlight get the color from the one listed first.",
    source: {
      builtin: {
        text: "Verified numbering",
        hint: "Verse numbering checked chapter by chapter for this version.",
      },
      "api-index": {
        text: "Numbering from YouVersion",
        hint: "Verse counts come from the YouVersion API. Chapters that follow neither standard system are skipped.",
      },
      assumed: {
        text: "Numbering assumed",
        hint: "Couldn't read this version's verse counts, so English numbering is assumed. Highlights in Psalms and some Old Testament chapters may land on the wrong verse.",
      },
    },
    checking: "Checking numbering…",
    fallbackTitle: (id: number) => `Version ${id}`,
    moveUp: (abbr: string) => `Move ${abbr} up`,
    moveDown: (abbr: string) => `Move ${abbr} down`,
    remove: (abbr: string) => `Remove ${abbr}`,
    confirmRemove: (abbr: string) => `Remove ${abbr} from syncing? Its highlights stay in YouVersion.`,
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
      duplicateName: (name: string) => `The name ${name} is already used.`,
      cantRead: (id: number, problem: string) => `Couldn't read highlights for version ${id}: ${problem}`,
    },
  },

  sync: {
    title: "Sync",
    scopeLegend: "What to sync",
    chapter: "Chapter",
    book: "Book",
    bible: "Whole Bible",
    chapterCount: (book: string, n: number, abbr: string) => `${book} has ${n} ${s(n, "chapter", "chapters")} in ${abbr}.`,
    bibleNote: (chapters: number) =>
      `Reads about ${num(chapters)} chapters. This can take a while; keep this page open.`,
    preview: "Preview changes",
    syncNow: "Sync now",
    confirmBible: "Sync the whole Bible now, without a preview?",
    previewing: "Previewing",
    syncing: "Syncing",
    starting: "Starting…",
    reading: (book: string, done: number, total: number) => `Reading ${book} · ${num(done)} of ${num(total)} chapters`,
    writing: (book: string, done: number, total: number) => `Writing ${book} · ${num(done)} of ${num(total)} changes`,
    stop: "Stop",
    stopNote: "Stopping finishes the current book first, so nothing is left half-done.",
  },

  results: {
    previewTitle: "Preview",
    doneTitle: "Sync finished",
    stopped: "(stopped)",
    inSyncDone: "Everything was already in sync.",
    inSyncPreview: "Nothing to change — everything is in sync.",
    counts: (applied: boolean, sets: number, removals: number) =>
      applied
        ? `${num(sets)} ${s(sets, "highlight", "highlights")} added, ${num(removals)} removed.`
        : `${num(sets)} ${s(sets, "highlight", "highlights")} to add, ${num(removals)} to remove.`,
    differences: (n: number) =>
      `${num(n)} ${s(n, "verse has", "verses have")} different colors; each version keeps its own.`,
    booksSkipped: (n: number) =>
      `${num(n)} ${s(n, "book was", "books were")} skipped because highlights couldn't be read. Nothing was changed in ${s(n, "it", "them")}.`,
    writeErrors: (n: number) => `${num(n)} ${s(n, "change", "changes")} failed; the next sync retries them.`,
    authExpired: "Stopped: your YouVersion sign-in has expired. Nothing more was changed.",
    network: "Stopped: couldn't reach YouVersion. Check your connection and try again. If it keeps happening, sign in again.",
    signInAgain: "Sign in again",
    apply: (n: number) => `Apply ${num(n)} ${s(n, "change", "changes")}`,
    blocked: (n: number) =>
      `${num(n)} ${s(n, "book was", "books were")} not changed because the sync would remove a lot of highlights at once. If you meant to remove them, continue:`,
    applyWithRemovals: "Apply, including removals",
    skippedRead: "skipped: couldn't read",
    notApplied: (removals: number, limit: number) =>
      `not applied: would remove ${num(removals)} highlights (limit ${num(limit)} per run)`,
    differentColors: "Different colors",
    differenceNote: (winner: string) => `Each keeps its own; versions without a highlight get ${winner}'s color.`,
    removed: "removed",
    action: { fill: "add", recolor: "change color", remove: "remove" },
    more: (n: number) => `…and ${num(n)} more`,
  },

  footer: {
    memory: (n: number) => `Sync memory: ${num(n)} ${s(n, "verse", "verses")}`,
    reset: "Reset",
    confirmReset:
      "Forget what previous syncs did? The next sync will only fill in blanks; it won't remove or recolor anything.",
    signOut: "Sign out",
    language: "Language",
    theme: "Theme",
    themes: { auto: "Auto", light: "Light", dark: "Dark" },
  },
};

export type Messages = typeof en;

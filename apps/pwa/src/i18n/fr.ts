import type { Messages } from "./en";

const num = (n: number) => n.toLocaleString("fr");
// In French, 0 and 1 take the singular.
const s = (n: number, one: string, many: string) => (n <= 1 ? one : many);

export const fr: Messages = {
  langName: "Français",
  back: "Retour",

  signIn: {
    intro:
      "Surlignez un verset dans une version de la Bible, et retrouvez-le dans les autres versions que vous lisez. Les numéros de versets sont mis en correspondance même quand les versions diffèrent (titres des Psaumes, Joël, Malachie, Job, etc.).",
    points: [
      "Lors de votre première synchronisation, aucun surlignage existant n'est recoloré ni supprimé.",
      "Vous voyez un aperçu de chaque modification avant que quoi que ce soit ne soit écrit.",
      "Votre connexion et vos données restent dans ce navigateur et ne sont envoyées qu'à YouVersion.",
    ],
    button: "Se connecter avec YouVersion",
    opening: "Ouverture de YouVersion…",
    disclaimer: "Non affilié à YouVersion. Utilise l'API YouVersion Platform avec votre autorisation.",
    missingKey: "Clé d'application manquante. Définissez VITE_YV_APP_KEY dans apps/pwa/.env.local puis redémarrez.",
  },

  callback: {
    finishing: "Finalisation de la connexion…",
    failed: "La connexion n'a pas abouti",
    stateMismatch:
      "Cette connexion ne correspond pas à celle lancée par l'application, ou elle a pris trop de temps. Veuillez vous reconnecter.",
    noPermission:
      "Vous êtes connecté, mais vous n'avez pas autorisé l'accès aux surlignages, dont l'application a besoin. Reconnectez-vous et autorisez-le.",
    provider: (detail) => `YouVersion a signalé un problème : ${detail}`,
  },

  versions: {
    title: "Vos versions",
    help: "Quand un verset a des couleurs différentes, chaque version garde la sienne. Les versions sans surlignage reçoivent la couleur de la première de la liste.",
    source: {
      builtin: {
        text: "Numérotation vérifiée",
        hint: "Numérotation des versets vérifiée chapitre par chapitre pour cette version.",
      },
      "api-index": {
        text: "Numérotation de YouVersion",
        hint: "Le nombre de versets vient de l'API YouVersion. Les chapitres qui ne suivent aucun des deux systèmes standard sont ignorés.",
      },
      assumed: {
        text: "Numérotation supposée",
        hint: "Impossible de lire le nombre de versets de cette version : la numérotation anglaise est supposée. Dans les Psaumes et certains chapitres de l'Ancien Testament, des surlignages pourraient tomber sur le mauvais verset.",
      },
    },
    checking: "Vérification de la numérotation…",
    fallbackTitle: (id) => `Version ${id}`,
    moveUp: (abbr) => `Monter ${abbr}`,
    moveDown: (abbr) => `Descendre ${abbr}`,
    remove: (abbr) => `Retirer ${abbr}`,
    confirmRemove: (abbr) => `Retirer ${abbr} de la synchronisation ? Ses surlignages restent dans YouVersion.`,
    addLabel: "Ajouter une version",
    addPlaceholder: "Lien bible.com ou numéro de version",
    nameLabel: "Nom court",
    namePlaceholder: "Nom",
    add: "Ajouter",
    adding: "Vérification…",
    addHelp: "Ouvrez la version sur bible.com et copiez l'adresse, par exemple :",
    errors: {
      unparseable: "Collez un lien bible.com comme bible.com/bible/93/JHN.3.LSG, ou tapez le numéro (93).",
      needName: "Donnez un nom court à cette version, par ex. BDS.",
      duplicateVersion: "Cette version est déjà dans la liste.",
      duplicateName: (name) => `Le nom ${name} est déjà utilisé.`,
      cantRead: (id, problem) => `Impossible de lire les surlignages de la version ${id} : ${problem}`,
    },
  },

  sync: {
    title: "Synchroniser",
    scopeLegend: "Que synchroniser",
    chapter: "Chapitre",
    book: "Livre",
    bible: "Toute la Bible",
    chapterCount: (book, n, abbr) => `${book} a ${n} ${s(n, "chapitre", "chapitres")} dans ${abbr}.`,
    bibleNote: (chapters) =>
      `Lecture d'environ ${num(chapters)} chapitres. Cela peut prendre un moment ; gardez cette page ouverte.`,
    preview: "Aperçu des modifications",
    syncNow: "Synchroniser maintenant",
    confirmBible: "Synchroniser toute la Bible maintenant, sans aperçu ?",
    previewing: "Aperçu",
    syncing: "Synchronisation",
    starting: "Démarrage…",
    reading: (book, done, total) => `Lecture de ${book} · ${num(done)} sur ${num(total)} chapitres`,
    writing: (book, done, total) => `Écriture de ${book} · ${num(done)} sur ${num(total)} modifications`,
    stop: "Arrêter",
    stopNote: "L'arrêt termine d'abord le livre en cours, pour que rien ne reste à moitié fait.",
  },

  results: {
    previewTitle: "Aperçu",
    doneTitle: "Synchronisation terminée",
    stopped: "(arrêtée)",
    inSyncDone: "Tout était déjà synchronisé.",
    inSyncPreview: "Rien à modifier : tout est synchronisé.",
    counts: (applied, sets, removals) =>
      applied
        ? `${num(sets)} ${s(sets, "surlignage ajouté", "surlignages ajoutés")}, ${num(removals)} ${s(removals, "supprimé", "supprimés")}.`
        : `${num(sets)} ${s(sets, "surlignage à ajouter", "surlignages à ajouter")}, ${num(removals)} à supprimer.`,
    differences: (n) =>
      `${num(n)} ${s(n, "verset a", "versets ont")} des couleurs différentes ; chaque version garde la sienne.`,
    booksSkipped: (n) =>
      `${num(n)} ${s(n, "livre ignoré", "livres ignorés")} car les surlignages n'ont pas pu être lus. Rien n'y a été modifié.`,
    writeErrors: (n) =>
      `${num(n)} ${s(n, "modification a échoué", "modifications ont échoué")} ; la prochaine synchronisation réessaiera.`,
    authExpired: "Arrêtée : votre connexion YouVersion a expiré. Rien d'autre n'a été modifié.",
    network:
      "Arrêtée : impossible de joindre YouVersion. Vérifiez votre connexion et réessayez. Si le problème persiste, reconnectez-vous.",
    signInAgain: "Se reconnecter",
    apply: (n) => `Appliquer ${num(n)} ${s(n, "modification", "modifications")}`,
    blocked: (n) =>
      `${num(n)} ${s(n, "livre n'a pas été modifié", "livres n'ont pas été modifiés")}, car la synchronisation supprimerait beaucoup de surlignages d'un coup. Si c'est voulu, continuez :`,
    applyWithRemovals: "Appliquer, suppressions comprises",
    skippedRead: "ignoré : lecture impossible",
    notApplied: (removals, limit) =>
      `non appliqué : supprimerait ${num(removals)} surlignages (limite de ${num(limit)} par synchronisation)`,
    differentColors: "Couleurs différentes",
    differenceNote: (winner) =>
      `Chaque version garde la sienne ; les versions sans surlignage reçoivent la couleur de ${winner}.`,
    removed: "supprimé",
    action: { fill: "ajouter", recolor: "changer la couleur", remove: "supprimer" },
    more: (n) => `…et ${num(n)} de plus`,
  },

  footer: {
    memory: (n) => `Mémoire de synchronisation : ${num(n)} ${s(n, "verset", "versets")}`,
    reset: "Réinitialiser",
    confirmReset:
      "Oublier ce qu'ont fait les synchronisations précédentes ? La prochaine se contentera de compléter les versets sans surlignage, sans rien supprimer ni recolorer.",
    signOut: "Se déconnecter",
    language: "Langue",
    theme: "Thème",
    themes: { auto: "Auto", light: "Clair", dark: "Sombre" },
  },
};

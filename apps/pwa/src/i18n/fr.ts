import type { Dictionary } from "./en";

/**
 * French strings. Typography: a no-break space ( ) before ":" and a
 * narrow no-break space ( ) before ";", "?" and "!", so they never start
 * a line on their own.
 */
export const fr: Dictionary = {
  meta: {
    localeTag: "fr",
    name: "Français",
  },

  app: {
    back: "Retour",
    languageLabel: "Langue",
    themeLabel: "Apparence",
    copyright: "© {years} Eusebius Ngemera",
    licence: "GPLv3",
    licenceTitle: "Licence publique générale GNU, version 3 ou ultérieure",
    notAffiliated: "Sans lien avec YouVersion.",
  },

  themes: {
    system: "Système",
    light: "Clair",
    dark: "Sombre",
  },

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
    disclaimer: "Utilise l'API YouVersion Platform avec votre autorisation.",
    missingKey: "Clé d'application manquante. Définissez VITE_YV_APP_KEY dans apps/pwa/.env.local puis redémarrez.",
  },

  callback: {
    finishing: "Finalisation de la connexion…",
    failed: "La connexion n'a pas abouti",
    stateMismatch:
      "Cette connexion ne correspond pas à celle lancée par l'application, ou elle a pris trop de temps. Veuillez vous reconnecter.",
    noPermission:
      "Vous êtes connecté, mais vous n'avez pas autorisé l'accès aux surlignages, dont l'application a besoin. Reconnectez-vous et autorisez-le.",
    provider: "YouVersion a signalé un problème : {detail}",
  },

  versions: {
    title: "Vos versions",
    help: "Quand un verset a des couleurs différentes, chaque version garde la sienne. Les versions sans surlignage reçoivent la couleur de la première de la liste.",
    source: {
      verified: {
        text: "Numérotation vérifiée",
        hint: "Numérotation des versets vérifiée chapitre par chapitre pour cette version.",
      },
      scanned: {
        text: "Nombre de versets connu",
        hint: "Le nombre de versets de cette version est fourni avec l'application (relevé sur bible.com en septembre 2026), mais sa numérotation n'a pas été vérifiée à la main. Les chapitres qui ne suivent aucun système standard sont ignorés.",
      },
      "api-index": {
        text: "Numérotation de YouVersion",
        hint: "Le nombre de versets vient de l'API YouVersion. Les chapitres qui ne suivent aucun système standard sont ignorés.",
      },
      assumed: {
        text: "Numérotation supposée",
        hint: "Impossible de lire le nombre de versets de cette version : la numérotation {system} est supposée. Dans les Psaumes et certains chapitres de l'Ancien Testament, des surlignages pourraient tomber sur le mauvais verset.",
      },
      unsupported: {
        text: "Numérotation non prise en charge",
        hint: "{n} chapitres de cette version ne suivent ni la numérotation anglaise ni l'hébraïque, et YouVersion n'indique pas le système qu'elle suit (synodale russe, Septante…) : les surlignages tomberaient sur les mauvais versets. Elle est exclue de toute synchronisation et ses surlignages ne sont pas modifiés.",
      },
    },
    systems: {
      eng: "anglaise",
      org: "hébraïque",
      rso: "synodale russe",
      rsc: "synodale russe",
      lxx: "de la Septante",
      vul: "de la Vulgate",
    },
    checking: "Vérification de la numérotation…",
    unnamed: "Version n° {id}",
    moveUp: "Monter {abbr}",
    moveDown: "Descendre {abbr}",
    remove: "Retirer {abbr}",
    confirmRemove: "Retirer {abbr} de la synchronisation ? Ses surlignages restent dans YouVersion.",
    addLabel: "Ajouter une version",
    addPlaceholder: "Lien bible.com ou numéro de version",
    nameLabel: "Nom court",
    namePlaceholder: "Nom",
    add: "Ajouter",
    adding: "Vérification…",
    addHelp: "Ouvrez la version sur bible.com et copiez l'adresse, par exemple :",
    errors: {
      unparseable: "Collez un lien bible.com comme bible.com/bible/93/JHN.3.LSG, ou tapez le numéro (93).",
      needName: "Donnez un nom court à cette version, par ex. BDS.",
      duplicateVersion: "Cette version est déjà dans la liste.",
      duplicateName: "Le nom {name} est déjà utilisé.",
      cantRead: "Impossible de lire les surlignages de la version {id} : {problem}",
      unsupported:
        "La version {id} ne peut pas être synchronisée : {n} de ses chapitres ne suivent ni la numérotation anglaise ni l'hébraïque, et YouVersion n'indique pas le système qu'elle suit, donc les surlignages tomberaient sur les mauvais versets.",
    },
  },

  sync: {
    title: "Synchroniser",
    scopeLegend: "Que synchroniser",
    chapter: "Chapitre",
    book: "Livre",
    bible: "Toute la Bible",
    chapterCount: ["{book} a {n} chapitre dans {abbr}.", "{book} a {n} chapitres dans {abbr}."],
    bibleNote: "Lecture d'environ {n} chapitres. Cela peut prendre un moment ; gardez cette page ouverte.",
    preview: "Aperçu des modifications",
    syncNow: "Synchroniser maintenant",
    confirmBible: "Synchroniser toute la Bible maintenant, sans aperçu ?",
    previewing: "Aperçu",
    syncing: "Synchronisation",
    starting: "Démarrage…",
    reading: "Lecture de {book} · {done} sur {total} chapitres",
    writing: "Écriture de {book} · {done} sur {total} modifications",
    stop: "Arrêter",
    stopNote: "L'arrêt termine d'abord le livre en cours, pour que rien ne reste à moitié fait.",
    tooFew: "Il faut au moins deux versions dont la numérotation est prise en charge pour synchroniser.",
  },

  results: {
    previewTitle: "Aperçu",
    doneTitle: "Synchronisation terminée",
    stopped: "(arrêtée)",
    inSyncDone: "Tout était déjà synchronisé.",
    inSyncPreview: "Rien à modifier : tout est synchronisé.",
    added: ["{n} surlignage ajouté", "{n} surlignages ajoutés"],
    removedCount: ["{n} supprimé", "{n} supprimés"],
    toAdd: ["{n} surlignage à ajouter", "{n} surlignages à ajouter"],
    toRemove: ["{n} à supprimer", "{n} à supprimer"],
    differences: [
      "{n} verset a des couleurs différentes ; chaque version garde la sienne.",
      "{n} versets ont des couleurs différentes ; chaque version garde la sienne.",
    ],
    booksSkipped: [
      "{n} livre ignoré, car les surlignages n'ont pas pu être lus. Rien n'y a été modifié.",
      "{n} livres ignorés, car les surlignages n'ont pas pu être lus. Rien n'y a été modifié.",
    ],
    writeErrors: [
      "{n} modification a échoué ; la prochaine synchronisation réessaiera.",
      "{n} modifications ont échoué ; la prochaine synchronisation réessaiera.",
    ],
    authExpired: "Arrêtée : votre connexion YouVersion a expiré. Rien d'autre n'a été modifié.",
    network:
      "Arrêtée : impossible de joindre YouVersion. Vérifiez votre connexion et réessayez. Si le problème persiste, reconnectez-vous.",
    signInAgain: "Se reconnecter",
    apply: ["Appliquer {n} modification", "Appliquer {n} modifications"],
    blocked: [
      "{n} livre n'a pas été modifié, car la synchronisation supprimerait beaucoup de surlignages d'un coup. Si c'est voulu, continuez :",
      "{n} livres n'ont pas été modifiés, car la synchronisation supprimerait beaucoup de surlignages d'un coup. Si c'est voulu, continuez :",
    ],
    applyWithRemovals: "Appliquer, suppressions comprises",
    skippedRead: "ignoré : lecture impossible",
    notApplied: "non appliqué : supprimerait {removals} surlignages (limite de {limit} par synchronisation)",
    differentColors: "Couleurs différentes",
    differenceNote: "Chaque version garde la sienne ; les versions sans surlignage reçoivent la couleur de {winner}.",
    removed: "supprimé",
    action: { fill: "ajouter", recolor: "changer la couleur", remove: "supprimer" },
    more: "…et {n} de plus",
    refused: "Exclues car leur numérotation n'est pas prise en charge : {names}. Rien n'y a été lu ni modifié.",
  },

  footer: {
    memory: ["Mémoire de synchronisation : {n} verset", "Mémoire de synchronisation : {n} versets"],
    reset: "Réinitialiser",
    confirmReset:
      "Oublier ce qu'ont fait les synchronisations précédentes ? La prochaine se contentera de compléter les versets sans surlignage, sans rien supprimer ni recolorer.",
    signOut: "Se déconnecter",
  },
};

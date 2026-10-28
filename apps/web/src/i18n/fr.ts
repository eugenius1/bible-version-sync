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
    copyright: "© {years}",
    licence: "Open source",
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
    reelTitle: "Vidéo montrant comment fonctionne Bible Version Sync",
    missingKey: "Clé d'application manquante. Définissez VITE_YV_APP_KEY dans apps/web/.env.local puis redémarrez.",
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

  priority: {
    title: "Quand les couleurs d'un verset diffèrent, laquelle l'emporte ?",
    toggle: "Utiliser la priorité des couleurs plutôt que celle des versions",
    byVersion: "Priorité des versions",
    byColor: "Priorité des couleurs",
    helpByVersion: "Chaque version garde sa couleur. Les versions sans surlignage reçoivent celle de la version la plus haute dans la liste.",
    helpByColor: "Chaque version garde sa couleur. Les versions sans surlignage reçoivent la couleur la plus haute dans la liste, quelle que soit la version qui l'a ; entre deux versions de même couleur, l'ordre des versions décide.",
    note: "bible.com ne propose que le jaune, le vert, le bleu, le pêche et le rose ; les autres viennent des applications mobiles.",
    drag: "Réordonner {color} : faites glisser, ou utilisez les flèches haut et bas",
    names: {
      purple: "Violet",
      aqua: "Turquoise",
      yellow: "Jaune",
      green: "Vert",
      blue: "Bleu",
      peach: "Pêche",
      pink: "Rose",
      paleYellow: "Jaune pâle",
      orange: "Orange",
      grey: "Gris",
    },
  },

  versions: {
    title: "Vos versions",
    help: "Les versions dans lesquelles vous surlignez. Les versets sont mis en correspondance même quand leur numérotation diffère.",
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
    drag: "Réordonner {abbr} : faites glisser, ou utilisez les flèches haut et bas",
    remove: "Retirer {abbr}",
    confirmRemove: "Retirer {abbr} de la synchronisation ? Ses surlignages restent dans YouVersion.",
    addLabel: "Ajouter une version",
    addPlaceholder: "Rechercher par nom, abréviation ou numéro YouVersion",
    add: "Ajouter",
    adding: "Vérification…",
    alreadyAdded: "Déjà ajoutée",
    number: "N° {id}",
    moreResults: "{shown} sur {total} affichées. Continuez à taper pour affiner.",
    noResults: "Aucune version ne correspond à « {query} ».",
    find: {
      examples: "Ce sont des versions d'exemple. Laissez l'application trouver celles où vous surlignez, ou ajoutez les vôtres ci-dessous.",
      button: "Trouver mes versions",
      again: "Chercher à nouveau",
      help: "Examine vos surlignages dans quelques chapitres connus de chaque version dans votre langue. Rien n'est modifié.",
      starting: "Démarrage…",
      progress: "Recherche de vos surlignages · {done} sur {total}",
      stop: "Arrêter",
      stopping: "Arrêt en cours…",
      stoppingButton: "Arrêt",
      stopped: "Recherche arrêtée après {done} sur {total}.",
      stoppedAtStart: "Recherche arrêtée avant toute vérification.",
      failed: "Impossible de terminer la recherche : {problem}",
      none: "Aucun surlignage trouvé dans les chapitres examinés (Ésaïe 41, Philippiens 4, Jean 3). Ajoutez vos versions ci-dessous.",
      foundTitle: "Vous surlignez dans",
      verses: ["{n} verset surligné dans l'échantillon", "{n} versets surlignés dans l'échantillon"],
      unsupported: "Numérotation non prise en charge, elle ne peut donc pas être synchronisée",
      inList: "Dans votre liste",
      add: "Ajouter {abbr}",
      notFound: "Aucun surlignage trouvé dans {list} dans les chapitres examinés.",
      useThese: ["Utiliser cette version", "Utiliser ces {n} versions à la place"],
    },
    errors: {
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
    labelled: "{label} : {value}",
    chaptersLabel: "Chapitres à lire",
    about: "environ {time}",
    durationTo: "de {from} à {to}",
    keepOpen: "Gardez cette page ouverte.",
    preview: "Aperçu des modifications",
    syncNow: "Synchroniser maintenant",
    confirmBible: "Synchroniser toute la Bible maintenant, sans aperçu ?",
    previewing: "Aperçu",
    syncing: "Synchronisation",
    starting: "Démarrage…",
    reading: "Lecture de {book}",
    remaining: "encore environ {time}",
    remainingRange: "encore {time}",
    writing: "Écriture de {book}",
    stop: "Arrêter",
    stopping: "Arrêt en cours…",
    stoppingWriting: "Arrêt après l'écriture de {book}…",
    stoppingButton: "Arrêt",
    stopNote: "Un livre en cours d'écriture est terminé avant l'arrêt, pour que rien ne reste à moitié fait.",
    tooFew: "Il faut au moins deux versions dont la numérotation est prise en charge pour synchroniser.",
    resumePreview: "Le prochain aperçu reprend à {book}, là où le précédent s'est arrêté.",
    resumeSync: "La prochaine synchronisation reprend à {book}, là où la précédente s'est arrêtée.",
    startOver: "Recommencer",
  },

  results: {
    previewTitle: "Aperçu",
    doneTitle: "Synchronisation terminée",
    viewStats: "Voir les statistiques",
    stopped: "(arrêtée)",
    inSyncDone: "Tout était déjà synchronisé.",
    inSyncPreview: "Rien à modifier : tout est synchronisé.",
    inSyncStoppedDone: [
      "Rien n'était à modifier dans le livre synchronisé avant l'arrêt.",
      "Rien n'était à modifier dans les {n} livres synchronisés avant l'arrêt.",
    ],
    inSyncStoppedPreview: [
      "Rien à modifier dans le livre lu avant l'arrêt.",
      "Rien à modifier dans les {n} livres lus avant l'arrêt.",
    ],
    stoppedBeforeBook: "Arrêté avant qu'un livre entier soit lu : rien à afficher. Rien n'a été modifié.",
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
      "Arrêtée : YouVersion ne répond pas. Vérifiez votre connexion. Si vous êtes en ligne, l'application a sans doute fait trop de demandes pour l'instant : YouVersion la fait alors patienter plusieurs minutes. Rien d'autre n'a été modifié.",
    rateLimited: [
      "Arrêtée : YouVersion a reçu trop de demandes de l'application pour l'instant. Réessayez dans {n} minute. Rien d'autre n'a été modifié.",
      "Arrêtée : YouVersion a reçu trop de demandes de l'application pour l'instant. Réessayez dans {n} minutes. Rien d'autre n'a été modifié.",
    ],
    rateLimitedSoon: "Arrêtée : YouVersion a reçu trop de demandes de l'application pour l'instant. Réessayez dans quelques minutes. Rien d'autre n'a été modifié.",
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

  problems: {
    signInExpired: "votre connexion YouVersion a expiré. Reconnectez-vous.",
    unreachable:
      "YouVersion ne répond pas. Vérifiez votre connexion. Si vous êtes en ligne, l'application a sans doute fait trop de demandes pour l'instant : YouVersion la fait alors patienter plusieurs minutes.",
    rateLimited: [
      "YouVersion a reçu trop de demandes de l'application pour l'instant. Réessayez dans {n} minute.",
      "YouVersion a reçu trop de demandes de l'application pour l'instant. Réessayez dans {n} minutes.",
    ],
    rateLimitedSoon: "YouVersion a reçu trop de demandes de l'application pour l'instant. Réessayez dans quelques minutes.",
  },

  stats: {
    title: "Vos surlignages",
    note: "D'après la mémoire de synchronisation de ce navigateur : chaque chapitre tel qu'il était après sa dernière synchronisation, pas tel qu'il est maintenant dans YouVersion.",
    empty: "Rien n'a encore été synchronisé. Les statistiques apparaîtront ici après votre première synchronisation.",
    demo: "Données inventées pour le développement ; rien n'est enregistré.",
    verses: ["verset surligné", "versets surlignés"],
    chapters: "chapitres synchronisés",
    chaptersOf: "sur {total} ({percent})",
    versions: ["version", "versions"],
    perVersion: "Par version",
    highlights: ["{n} surlignage", "{n} surlignages"],
    added: ["{n} ajouté par la synchronisation", "{n} ajoutés par la synchronisation"],
    unwritable: ["{n} verset refusé par YouVersion", "{n} versets refusés par YouVersion"],
    colorCount: "{color} : {n}",
    overlap: "D'une version à l'autre",
    everywhere: "Dans toutes les versions",
    some: "Dans certaines",
    one: "Dans une seule",
    differing: [
      "{n} verset a des couleurs différentes selon la version.",
      "{n} versets ont des couleurs différentes selon la version.",
    ],
    byBook: "Par livre",
    bookRow: [
      "{book} : {n} verset surligné, {synced} chapitres synchronisés sur {chapters}",
      "{book} : {n} versets surlignés, {synced} chapitres synchronisés sur {chapters}",
    ],
    topChapters: "Chapitres les plus surlignés",
    topShare: "Chapitres les plus surlignés en proportion",
    versesOf: "{n} versets sur {total}",
    pace: "Vitesse",
    perRead: "{time} pour lire les surlignages d'un chapitre dans une version",
    perWrite: "{time} pour écrire un surlignage",
    seconds: "{n} s",
    noPace: "Pas encore mesurée : elle l'est pendant un aperçu ou une synchronisation.",
  },

  footer: {
    memory: ["Mémoire de synchronisation : {n} verset", "Mémoire de synchronisation : {n} versets"],
    stats: "Statistiques",
    reset: "Réinitialiser",
    confirmReset:
      "Oublier ce qu'ont fait les synchronisations précédentes ? La prochaine se contentera de compléter les versets sans surlignage, sans rien supprimer ni recolorer.",
    signOut: "Se déconnecter",
  },
};

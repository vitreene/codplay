# Plan — routes auteur par document Elcé

**Statut : Fixe ; implémentation Fini.** Les routes acceptées sont `/`,
`/new`, `/learning/:documentId` et `/hunt/:documentId`. Learning est proposé
par défaut ; « Autre… » donne accès aux autres mods.

## Objectif et périmètre

Ajouter des routes navigateur Remix pour les documents des mods Learning et
Quiz Hunt. Chaque route de document porte le nom de son mod et désigne un projet
par son identifiant : `/learning/:documentId` ou `/hunt/:documentId`. `/` est
l’entrée d’orientation ; `/` et `/new` partagent le choix du mod et la liste de
ses documents. Learning est le choix initial ; le lien « Autre… » expose les
autres mods avec leur type. Un clic sur un document l’ouvre dans sa route de
mod, et une icône corbeille lance sa suppression. `/new` permet aussi de créer
un document dans le mod sélectionné : l’auteur saisit son nom puis valide ; le
document créé s’ouvre ensuite dans sa route. La table API Fetch reste séparée.
La preview existante, identifiée par ses paramètres de session/projet, conserve
sa composition de lecture.

## Circuit et invariants

- Le routeur existant est [`remix-spa-router.tsx`](../src/app/remix/remix-spa-router.tsx) ;
  l’entrée [`browser-entry.tsx`](../src/app/remix/browser-entry.tsx) choisit
  actuellement Learning ou Quiz Hunt par `?mod=quiz-hunt`, puis construit sa
  composition avant de monter le routeur. Le routage auteur choisira désormais
  la composition depuis `/learning/:documentId` ou `/hunt/:documentId` ; `/` et
  `/new` affichent le choix commun, avec Learning par défaut.
- [`LearningAuthoringComposition`](../src/mods/learning/composition/authoring-composition.tsx)
  et [`createQuizHuntAuthoringComposition`](../src/mods/quiz-hunt/composition/quiz-hunt-authoring-composition.tsx)
  créent chacun leur acteur et leur session. Ils partagent le coordinateur
  générique, mais gardent leurs codecs, catalogues et transports API distincts.
  Le choix du mod depuis l’URL doit précéder la composition.
- Chaque coordinateur restaure aujourd’hui l’identifiant mémorisé par onglet,
  puis le document initial historique. La route demandée devient prioritaire
  sans créer un second acteur ou une seconde session ; l’identifiant doit aussi
  appartenir au catalogue du mod désigné par le chemin.
- Les transitions utilisent la façade et le coordinateur du mod :
  synchronisation du document courant, contrôle de révision, droit serveur,
  verrou local et installation de la révision confirmée restent obligatoires.
- Avant de remplacer une composition par celle d’un autre mod, synchroniser le
  document courant et libérer son droit au moyen du coordinateur existant, en
  conservant sa copie IndexedDB confirmée. Si la synchronisation échoue, garder
  la composition et le document courants actifs et ne pas changer de route. Ne
  jamais faire coexister deux sessions documentaires actives dans l’onglet.
- Aucun nouveau modèle documentaire, stockage ou service d’accès n’est ajouté.
  Les API Fetch restent séparées du routeur SPA et conservent les namespaces et
  codecs propres aux mods.
- `/` et `/new` affichent le sélecteur « Vos projets » en superposition au
  workspace commun, y compris lorsque le document courant reste actif. Le
  catalogue affiché appartient au mod choisi : Learning par défaut, les autres
  mods via « Autre… », avec le type de mod visible. Charger la liste via le
  `ProjectApiClient.listProjects()` existant et le transport propre au mod ; la
  consultation n’instancie pas une seconde composition ou session documentaire.
  Ne pas agréger les catalogues ni ajouter un endpoint commun ; leurs API et
  filtres restent distincts.
- Un clic sur la ligne d’un document l’ouvre ; son icône corbeille appelle
  l’action `deleteProject` existante avec sa confirmation et son cycle de
  suppression. La sélection et la suppression ne contournent pas le
  coordinateur, le droit serveur ni le cache local.
- La création sur `/new` exige un nom saisi avant « Valider ». Le mod actif
  construit le document initial avec ce nom ; la création serveur réussie ouvre
  sa route documentaire. Ne pas créer un document au nom automatique puis le
  renommer comme seconde étape.
- Le segment du mod détermine la composition auteur du document. Le paramètre
  `?mod=quiz-hunt` est remplacé par `/hunt/:documentId` pour l’édition ; il ne
  reste pas une voie parallèle de sélection du mod. Les paramètres des routes
  de preview gardent leur rôle de lecture.
- La racine `/` est une route d’orientation qui affiche le sélecteur ; elle ne
  redirige pas vers `/new`. Les deux routes gardent Learning comme choix initial
  et donnent accès aux autres mods par « Autre… ». Une ancienne URL auteur avec
  `?mod=quiz-hunt` ne sélectionne plus le mod ; les paramètres de preview restent
  traités par leur circuit de lecture.
- L’identifiant de route est prioritaire sur la sélection mémorisée de l’onglet.
  Un identifiant absent du catalogue du mod demandé affiche l’erreur existante
  de projet absent et ne retombe pas sur un autre document. Retour/Avancer suit
  la route et passe les changements de document au coordinateur existant.
- `/new` conserve le document et la session courants sous le sélecteur tant que
  la page reste ouverte. Pour un document du même mod, l’ouverture réutilise
  `openProject`, qui synchronise le document courant avant le transfert.
- Les projets Quiz Hunt sont filtrés par `projects.mod_key` et utilisent leur
  transport `/api/quiz-hunt`; les projets Learning utilisent le catalogue
  Learning. Le sélecteur commun doit conserver cette séparation.

## Actions réalisées

- [x] Étendre la table Remix avec `/`, `/new` et les routes documentaires de chaque
   mod, en gardant les routes API et la preview séparées.
- [x] Raccorder l’identifiant URL au démarrage de chaque composition et aux
   changements de document via les coordinateurs et façades existants. Ne pas
   lire le document directement depuis la vue Remix ni contourner la
   synchronisation, la révision ou le verrou.
- [x] Lier création nommée, ouverture par clic, suppression par icône corbeille,
   changement d’URL et navigation navigateur sans émettre de commande
   documentaire supplémentaire.
- [x] Valider le lien direct, le rechargement, plusieurs documents de chaque mod,
   Retour/Avancer, le choix/création, suppression, conflit d’accès, perte réseau,
   synchronisation en cours, preview, fermeture et destruction de l’acteur.
   Actualiser les spécifications SPA, session et Quiz Hunt après vérification
   réelle.

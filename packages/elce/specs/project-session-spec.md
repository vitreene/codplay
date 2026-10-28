# Elcé — gestion du projet actif

## Rôle

Le menu placé au titre « Elcé » choisit le projet édité dans cet onglet. Il
agit sur le catalogue de projets du serveur ; il ne remplace pas le catalogue
de contenus de l’éditeur.

## Parcours vérifiés

- Au démarrage, l’application lit la liste serveur et restaure le projet
  mémorisé dans `sessionStorage` pour cet onglet. À défaut, le document de
  départ `elce-document` est repris s’il existe. L’application ne crée pas de
  projet vide au démarrage.
- Le menu de sélection du projet se ferme sur un clic hors de lui. Les clics
  sur les contrôles à l’intérieur du menu le laissent ouvert.
- « Nouveau projet » crée un document initial avec un identifiant neuf et un
  nom `Projet N` disponible. Il devient le projet actif après création sur le
  serveur.
- Le champ du nom actif envoie `document.rename` par `EditorActionsFacade`.
  Le document reste détenu par l’acteur XState et suit la synchronisation
  habituelle.
- « Ouvrir » prépare la révision serveur pour une page lectrice, attend la
  synchronisation du projet courant, puis transfère l’édition au projet choisi.
  Toute commande déjà acceptée avant l’ouverture finit d’abord son écriture
  locale ; cette révision fait partie de l’instantané synchronisé. En cas
  d’échec ou de conflit, le projet courant et sa copie locale restent ouverts.
  L’éditeur ne devient actif qu’après obtention de son `ProjectEditorLock`, du
  droit serveur et de l’installation de la révision confirmée. Une copie
  locale `pending` reste dans IndexedDB sans remplacer la vue lectrice.
- « Fermer » attend la synchronisation, libère le verrou et supprime la copie
  IndexedDB du projet actif. Le projet et son document restent sur le serveur.
- « Supprimer » demande une confirmation. Pour le projet actif, la suppression
  serveur est confirmée avant le retrait du verrou et de la copie IndexedDB.
  Pour un autre projet, seul son projet serveur et son cache local sont ciblés ;
  la suppression prend d’abord son propre droit serveur.
- Si le cache local d'un projet serveur contient une version de document non
  prise en charge, l'application lit d'abord la version confirmée du serveur.
  Après cette lecture seulement, elle supprime le cache local ciblé (document,
  checkpoint et médias locaux non partagés), puis le recrée depuis le document
  serveur et sa révision. L'ancien cache n'est ni converti ni publié. Si la
  lecture serveur échoue, le cache est conservé et le catalogue reste accessible
  avec l'erreur. Cette récupération au démarrage comme à l'ouverture depuis le
  catalogue ne vise pas une copie locale indépendante absente du serveur.
- « Enregistrer sous… » crée une identité de projet indépendante depuis le
  document confirmé affiché, sans modifier le projet source. Une copie locale
  garde les identifiants de ses médias et, pour les fichiers absents, l’identité
  de leur projet source. Elle peut rester éditable hors connexion. À la reprise,
  l’adaptateur relit ces fichiers par l’API source et utilise le coordinateur
  documentaire et média existant pour publier la copie. Un fichier source
  introuvable laisse la copie locale en attente avec une indication explicite.
  Si la synchronisation du projet source a échoué, « Enregistrer la copie
  locale sous… » prend explicitement le cache `pending` ou `conflict`, le
  conserve sous une autre identité, puis peut libérer le droit du projet
  source sans publier cette ancienne valeur. La copie du serveur reste intacte.
  Cette action n’est proposée que lorsqu’une copie locale non confirmée existe.
  Une copie de secours rouverte en arrière-plan affiche immédiatement son
  contenu local en lecture seule ; le focus reste nécessaire pour acquérir
  l’édition, puis tenter sa publication.
- Chaque onglet mémorise son propre projet actif. Les projets différents
  gardent des documents et des caches séparés ; un même projet reste protégé
  par le verrou exclusif entre fenêtres du même profil navigateur. Entre deux
  navigateurs, le droit serveur exclut aussi une deuxième édition et le
  coordinateur reçoit la révision confirmée au retour du focus,
  selon la
  [spécification d’accès et de synchronisation par focus](./editor-window-access-spec.md).
- Une page lectrice propose « Réessayer l’accès » et le secours temporaire
  « Forcer l’accès ». Le forçage remplace le droit serveur puis installe la
  révision confirmée dans le même acteur XState avant de réactiver les
  commandes. Il ne crée pas de copie séparée des changements locaux non
  confirmés.
- Les requêtes de gestion passent de la vue Remix à `EditorActionsFacade`, puis
  à l’événement `project.operation` du même acteur XState. Le
  `ProjectSessionCoordinator` raccorde cet acteur à l’API, au cache, à la
  synchronisation et au verrou ; il ne possède pas de document éditorial
  parallèle.

## Lire l’implémentation

- [`project-application.ts`](../src/app/remix/project-application.ts) rend le
  menu, les listes, la sélection et la zone auteur en Remix. Une page active
  reçoit `RemixPageEditor` ; tous ses BDC directs et sa Section sont des vues
  natives Remix qui utilisent le même acteur et les mêmes façades.
  L’écouteur de clic extérieur est installé et retiré avec le cycle de vie de
  cette application ; il ferme le `<details>` natif sans intercepter ses clics
  internes.
- [`editor-actions-facade.ts`](../src/app/facades/editor-actions-facade.ts)
  expose les intentions de gestion au même acteur XState.
- [`controller-machine.ts`](../src/core/controller/controller-machine.ts)
  sérialise les opérations et installe le document reçu avant de demander son
  verrou.
- [`project-session-coordinator.ts`](../src/core/projects/project-session-coordinator.ts)
  coordonne les ressources navigateur et les appels d’infrastructure à travers
  `DocumentStore`, `ProjectApiClient` et les services documentaires injectés.
  [`learning-project-session-coordinator.ts`](../src/mods/learning/persistence/learning-project-session-coordinator.ts)
  fournit ces services pour le document Learning ; l’ancien chemin `app/` est
  un ré-export de compatibilité.

## Vérification

- Les tests XState couvrent le démarrage sans création implicite, l’installation
  d’un document avant le verrou et la conservation du document et de l’accès
  courant lorsqu’une opération échoue.
- [`project-operations.test.ts`](../src/mods/learning/integration/project-operations.test.ts)
  traverse l’acteur XState, le raccord de persistance locale et le coordinateur
  de synchronisation : une commande Section en cours est enregistrée avant
  l’ouverture d’un autre projet, puis un conflit serveur ou une erreur réseau
  garde le document, l’accès d’édition et le checkpoint local du projet courant.
- Les tests du coordinateur couvrent la création, la fermeture sans suppression
  serveur, la suppression d’un projet inactif sans perte de l’accès courant et
  le démarrage sur un catalogue vide.
- Les tests du coordinateur couvrent aussi la création d'une copie depuis une
  page lectrice, l'édition locale hors connexion, sa publication au retour du
  réseau et la correction d'une identité copiée par duplication d'onglet. Le
  test réseau vérifie la récupération d'un média depuis son projet source et
  conserve le checkpoint en attente si ce média a disparu. Une copie rouverte
  sans focus reste visible sans devenir éditable.
- Les tests du coordinateur remplacent un cache local v2 par la version serveur
  v4 à l'ouverture depuis le catalogue, et vérifient qu'une panne de lecture
  serveur préserve le cache et le projet courant. Brave sur `5175` a exercé le
  démarrage avec le cache du projet en v2 : le serveur v4 a été relu, le cache
  ciblé et son checkpoint sont redevenus v4 et synchronisés, et l'éditeur s'est
  ouvert sans écrire le document serveur.
- Brave DevTools, le 12 octobre 2026 sur `5175`, ouvre le menu du projet : le
  clic interne sur « Actualiser » le laisse ouvert et un clic extérieur le
  ferme. Le document n’a pas été modifié pendant ce contrôle.
- Safari Technology Preview via MCP vérifie le renommage, la création,
  l’ouverture, la fermeture, la suppression active et inactive, ainsi que le
  rechargement qui restaure « Document Elcé ». Deux onglets ont repris chacun
  leur projet différent après activation ; l’édition du document existant
  n’a pas été modifiée pendant ces essais.
- Après les essais, l’API ne contenait plus que `elce-document`, toujours à la
  révision `0`. La console Safari ne signalait ni erreur ni avertissement.

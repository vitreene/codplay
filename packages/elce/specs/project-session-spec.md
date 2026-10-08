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
- « Nouveau projet » crée un document initial avec un identifiant neuf et un
  nom `Projet N` disponible. Il devient le projet actif après création sur le
  serveur.
- Le champ du nom actif envoie `document.rename` par `EditorActionsFacade`.
  Le document reste détenu par l’acteur XState et suit la synchronisation
  habituelle.
- « Ouvrir » prépare la copie locale ou relit le document serveur, attend la
  synchronisation du projet courant, puis transfère l’édition au projet choisi.
  L’éditeur ne devient actif qu’après obtention de son `ProjectEditorLock`.
- « Fermer » attend la synchronisation, libère le verrou et supprime la copie
  IndexedDB du projet actif. Le projet et son document restent sur le serveur.
- « Supprimer » demande une confirmation. Pour le projet actif, la suppression
  serveur est confirmée avant le retrait du verrou et de la copie IndexedDB.
  Pour un autre projet, seul son projet serveur et son cache local sont ciblés.
- Chaque onglet mémorise son propre projet actif. Les projets différents
  gardent des documents et des caches séparés ; un même projet reste protégé
  par le verrou exclusif décrit dans la
  [spécification d’accès entre fenêtres](./editor-window-access-spec.md).
- Les requêtes de gestion passent de la vue Remix à `EditorActionsFacade`, puis
  à l’événement `project.operation` du même acteur XState. Le
  `ProjectSessionCoordinator` raccorde cet acteur à l’API, au cache, à la
  synchronisation et au verrou ; il ne possède pas de document éditorial
  parallèle.

## Lire l’implémentation

- [`project-application.ts`](../src/app/remix/project-application.ts) rend le
  menu natif Remix, les listes et la zone de sélection. L’éditeur restant à
  porter est toujours monté dans son hôte React temporaire.
- [`editor-actions-facade.ts`](../src/app/facades/editor-actions-facade.ts)
  expose les intentions de gestion au même acteur XState.
- [`controller-machine.ts`](../src/app/controller/controller-machine.ts)
  sérialise les opérations et installe le document reçu avant de demander son
  verrou.
- [`project-session-coordinator.ts`](../src/app/projects/project-session-coordinator.ts)
  coordonne les ressources navigateur et les appels d’infrastructure.

## Vérification

- Les tests XState couvrent le démarrage sans création implicite, l’installation
  d’un document avant le verrou et la conservation du document et de l’accès
  courant lorsqu’une opération échoue.
- Les tests du coordinateur couvrent la création, la fermeture sans suppression
  serveur, la suppression d’un projet inactif sans perte de l’accès courant et
  le démarrage sur un catalogue vide.
- Safari Technology Preview via MCP vérifie le renommage, la création,
  l’ouverture, la fermeture, la suppression active et inactive, ainsi que le
  rechargement qui restaure « Document Elcé ». Deux onglets ont repris chacun
  leur projet différent après activation ; l’édition du document existant
  n’a pas été modifiée pendant ces essais.
- Après les essais, l’API ne contenait plus que `elce-document`, toujours à la
  révision `0`. La console Safari ne signalait ni erreur ni avertissement.

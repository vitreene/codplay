# Plan — machines à états explicites dans Elcé

**Statut : A relire.** Le périmètre et les invariants sont établis ; le choix
d’intégration XState et le découpage de la machine de preview doivent être
validés avant toute modification du code.

## Objectif

Rendre explicites les cycles de vie Elcé actuellement encodés par des
combinaisons de booléens, de promesses et de minuteries. Une machine doit
nommer ses états, ses événements, ses transitions permises et ses effets
asynchrones. Cette évolution formalise les circuits existants ; elle ne change
pas leurs contrats d’accès, de synchronisation, de preview ou de persistance.

## Périmètre

La première tranche couvre les trois circuits repérés :

1. **Accès éditeur par fenêtre** — `ProjectEditorLock` : attente et acquisition
   du Web Lock, droit accordé, suspension/libération, perte du droit, reprise,
   forçage et exception du sélecteur de fichiers.
2. **Synchronisation locale** — `ProjectSyncCoordinator` : attente temporisée,
   synchronisation, travail regroupé, suspension, reprise et échec.
3. **Preview popup** — les sessions Learning et Quiz Hunt : démarrage, attente
   d’instantané, requête en cours, synchronisation regroupée, lecture, erreur,
   arrêt du suivi et destruction.

L’inventaire initial examinera aussi `PopupPreviewHost`. Il ne sera converti que
si ses échanges `ready`/`snapshot` constituent un cycle de transitions
indépendant qui n’est pas déjà possédé par la machine des sessions preview.

## Décisions proposées

- Réutiliser **XState 5**, déjà dépendance directe d’Elcé et utilisé par le
  contrôleur auteur. Ne pas ajouter de bibliothèque.
- Garder les effets navigateur, HTTP, IndexedDB, timers et player derrière les
  adaptateurs existants ; les machines décident des transitions et déclenchent
  ces effets par des acteurs/actions injectés.
- Garder l’acteur `controllerMachine` comme propriétaire du document, de la
  sélection et de l’autorisation des commandes. Les nouvelles machines ne
  contiennent pas de copie de ces données.
- Garder `ExclusiveSyncSession` (`@codplay/exclusive-sync`) comme propriétaire
  du protocole de droit serveur, de publication complète et d’installation de
  révision. La machine de fenêtre coordonne les signaux locaux et appelle ce
  circuit ; elle ne réimplémente pas le droit.
- Préserver le protocole `postMessage`, les identifiants de requête, le
  regroupement des notifications et l’interface visible de preview. Réutiliser
  le protocole partagé existant ; ne pas créer de navigation ou de player
  parallèle.
- Ne pas transformer `ProjectSessionCoordinator` en seconde machine : les
  opérations de projet sont déjà sérialisées par l’acteur XState auteur.

## Invariants à préserver

- L’édition reste suspendue jusqu’à l’acquisition valide du verrou local, du
  droit serveur et l’installation de la révision confirmée.
- Un transfert ordinaire attend la fin des commandes acceptées et la
  publication complète du document et des médias ; un échec conserve l’accès
  lorsque le contrat l’exige.
- Blur, visibilité, réseau, forçage et sélecteur natif gardent leurs règles
  actuelles, notamment l’exception de focus pendant l’import de fichier.
- Une seule publication serveur est active à la fois. Les changements survenus
  pendant celle-ci sont regroupés et le dernier document local est publié
  ensuite. La suspension attend l’opération en cours.
- Une réponse de preview n’est acceptée que pour la session et la requête
  actives. Une notification pendant un chargement déclenche au plus une
  synchronisation suivante vers le dernier instantané.
- La navigation indépendante arrête le suivi ; reprendre le suivi demande le
  document et la sélection actuels de l’éditeur. Une réponse automatique déjà
  arrêtée ne remplace pas la lecture courante.
- Aucun format de document, endpoint, contrat partagé ou comportement SCORM ne
  change dans cette évolution.

## Étapes

### 1. Établir les graphes de transitions de référence

- Relever les événements, états observables, transitions, effets en cours et
  règles d’échec des trois circuits ciblés, à partir des spécifications et des
  tests existants.
- Séparer les états exclusifs des axes indépendants (par exemple suivi
  automatique et état de chargement) afin d’éviter l’énumération de combinaisons
  artificielles.
- Identifier les invariants que les tests actuels ne prouvent pas encore ; ne
  pas déduire de nouveaux comportements du seul code.
- Examiner `PopupPreviewHost` et décider s’il reste un hôte de protocole simple
  ou s’il doit partager une machine avec les sessions.

### 2. Convertir le verrou de fenêtre

- Introduire une machine XState dans le propriétaire Elcé de
  `ProjectEditorLock`, sans déplacer Web Locks, `BroadcastChannel`, focus ou
  visibilité hors de leurs adaptateurs.
- Mapper chaque callback de cycle de vie vers un événement typé et chaque
  réponse asynchrone vers une complétion/erreur de l’acteur.
- Garder `ExclusiveSyncSession` comme propriétaire du droit serveur et vérifier
  qu’aucune transition de la nouvelle machine ne peut activer les commandes
  avant sa confirmation.
- Remplacer les indicateurs d’état redondants par l’état de l’acteur ; ne garder
  des références locales que pour les ressources d’exécution (canal, timer,
  promesse ou fonction de libération) dont l’état n’est pas métier.

### 3. Convertir la file de synchronisation

- Modéliser les phases temporisées, active, en attente d’un nouveau document,
  suspendue et en échec dans `ProjectSyncCoordinator`.
- Conserver l’écriture séquentielle du document et des médias, le checkpoint
  IndexedDB et les statuts `pending`, `conflict`, `synced` existants.
- Garder `waitUntilCurrentDocumentSynced`, `flushNow`, `suspend`, `resume` et
  `destroy` comme façades du circuit ; leurs résultats et erreurs restent
  compatibles.

### 4. Convertir le protocole de session preview

- Modéliser le protocole commun de requête/réponse et de suivi automatique en
  réutilisant les types et gardes de `popup-preview-messages.ts`.
- Garder Learning et Quiz Hunt responsables du décodage, des médias, de l’état
  test éventuel et du montage de leur vrai player.
- Partager une machine générique uniquement si le graphe démontre que les deux
  sessions ont les mêmes transitions ; sinon conserver deux machines nommées
  utilisant les mêmes événements de protocole.
- Éviter de reconstruire le player sur une notification sans changement
  pertinent et préserver les règles de destruction et de libération des
  ressources.

### 5. Mettre à jour les références

- Après validation de chaque tranche, consolider la spécification propriétaire
  (`editor-window-access-spec.md`, `player-preview-spec.md`, et la référence de
  synchronisation locale/documentaire concernée) pour décrire les états,
  événements, effets et limites désormais vérifiés.
- Retirer des spécifications toute affirmation devenue fausse ; ne pas y
  consigner le déroulé des travaux ou les résultats d’exécution.
- Garder ce plan pour les tranches non appliquées et leurs critères
  d’acceptation.

## Fichiers et propriétaires concernés

- `packages/elce/src/core/sync/project-editor-lock.ts` et ses tests ; contrat
  propriétaire : `packages/elce/specs/editor-window-access-spec.md`.
- `packages/elce/src/core/sync/project-sync-coordinator.ts` et
  `packages/elce/src/mods/learning/integration/project-sync-coordinator.test.ts` ;
  circuit documenté dans le plan local-first et les spécifications de session
  et stockage.
- `packages/elce/src/mods/learning/preview/learning-preview-session.ts`,
  `packages/elce/src/mods/quiz-hunt/preview/quiz-hunt-preview-session.ts`, les
  tests d’intégration de ces sessions et, si nécessaire,
  `packages/elce/src/core/preview/popup-preview-host.ts` ; contrat propriétaire :
  `packages/elce/specs/player-preview-spec.md`.
- `packages/elce/src/core/controller/controller-machine.ts` reste un
  propriétaire existant et une frontière à vérifier, pas une cible de
  refonte.
- `packages/authoring/exclusive-sync` reste hors périmètre de modification ; sa
  spécification fait foi pour le protocole de droit.

## Acceptation

- Pour chaque machine, un test de transitions vérifie états initiaux, événements
  acceptés/refusés, transitions réussies, échecs et destruction.
- Verrou : couvrir acquisition normale et forcée, demande concurrente,
  suspension/récupération après focus et réseau, perte du droit, import par
  sélecteur natif et erreur de publication sans activation prématurée.
- Synchronisation : couvrir regroupement, changement pendant une écriture,
  sérialisation document/médias, suspension pendant une requête, reprise,
  conflit et erreur réseau avec conservation du cache.
- Preview : couvrir handshake, réponse périmée ou étrangère, timeout,
  notifications regroupées, désactivation du suivi avant application d’une
  réponse, retour au document édité, navigation indépendante et destruction.
- Exercer les frontières intégrées acteur XState → session/coordinator → API et
  IndexedDB réels avec fixtures possédées par les tests ; ne pas s’appuyer sur
  les scènes ou données des démos.
- Exécuter les tests ciblés, les tests de non-régression existants, les
  typechecks et builds Elcé. Pour les parcours navigateur concernés, vérifier
  le vrai focus/visibilité, les transferts, le player réel et la fermeture des
  sessions selon les règles MCP du dépôt.
- Vérifier que les documents ouverts, checkpoints, révisions, requêtes réseau et
  comportements d’interface restent identiques hors transitions explicitement
  couvertes.

## Décisions ouvertes avant implémentation

1. **Validation de XState comme mécanisme des trois machines.** C’est la
   proposition de ce plan, appuyée par la dépendance existante et l’usage
   applicatif déjà établi.
2. **Portée de la machine de preview partagée.** Confirmer si seul le handshake
   et le suivi communs sont mutualisés, ou si les deux sessions conservent des
   machines propres au mod. La logique du player et l’état de test Learning
   restent dans leurs propriétaires actuels dans les deux cas.
3. **`PopupPreviewHost`.** Confirmer son inclusion après l’inventaire : aucune
   machine supplémentaire ne doit dupliquer le cycle de requête/réponse des
   sessions.

## Références contractuelles

- [Accès d’édition et synchronisation par focus](../specs/editor-window-access-spec.md)
- [Session de projet](../specs/project-session-spec.md)
- [Surface de preview](../specs/player-preview-spec.md)
- [Session de synchronisation exclusive](../../authoring/exclusive-sync/specs/exclusive-sync-spec.md)
- [Plan de synchronisation locale-first](./2026-10-06-elce-local-first-synchronisation-plan.md)
- [Plan d’accès exclusif inter-navigateurs](./2026-10-11-elce-acces-exclusif-inter-navigateurs-plan.md)

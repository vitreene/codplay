# Elcé — accès d’édition et synchronisation par focus

## Statut

**Fini le 7 octobre 2026 pour le verrou par projet et la conservation des
caches ; le parcours de sélection des projets reste au plan Remix.** Le
transfert du verrou par `BroadcastChannel`, la suspension XState et la reprise
IndexedDB sont vérifiés dans Safari Technology Preview.

## Rôle

Le verrou navigateur garde un seul éditeur actif parmi les fenêtres de même
origine qui partagent le même profil. Entre deux navigateurs, chaque cache reste
indépendant et le serveur transmet la dernière révision confirmée au retour du
focus. Cette coordination ne crée ni document éditorial parallèle, ni
synchronisation directe entre navigateurs ; l’API projet reste responsable de
la persistance durable. IndexedDB conserve une entrée de cache par projet
ouvert, avec ses médias non transférés et son checkpoint de synchronisation.
Des fenêtres sur des projets différents gardent des caches indépendantes.

## Contrat

- `ProjectEditorLock` prend un Web Lock exclusif nommé à partir de l’identifiant
  du projet et diffuse les demandes de transfert par `BroadcastChannel`. Il ne
  demande le verrou que si la fenêtre est visible et possède le focus ; une
  fenêtre ouverte en arrière-plan reste en attente.
- L’éditeur attend le verrou avant d’attacher sa persistance et d’autoriser les
  commandes. `controllerMachine` démarre dans l’état `suspended` ; les commandes
  documentaires et les imports sont acceptés uniquement lorsque son contexte
  XState porte `editAccess: 'active'`.
- Une fenêtre qui demande l’accès annonce sa demande. La fenêtre propriétaire
  suspend d’abord les nouvelles commandes, laisse terminer les imports déjà
  acceptés, arrête ses nouvelles écritures réseau, puis attend la sauvegarde
  locale du document avant de libérer le verrou.
- `blur` suspend les nouvelles commandes, attend la fin des commandes déjà
  acceptées et des écritures IndexedDB, puis tente immédiatement la
  synchronisation serveur en court-circuitant le délai local de 500 ms. Une
  requête déjà en cours est attendue sans en ajouter une autre. Une erreur
  réseau garde le checkpoint en attente et ne retient pas le verrou ; au retour
  du réseau, l’événement `online` ou la reprise de focus relance la copie locale
  par le circuit normal.
- `visibilitychange` vers `hidden` suspend également l’édition et libère le
  verrou après la même sauvegarde locale. Au retour visible ou du focus, la
  fenêtre demande le verrou quand elle possède effectivement le focus.
- Après acquisition, la fenêtre restaure son cache IndexedDB et ses sources de
  média. Avant de reprendre les commandes, elle relit le catalogue serveur ; si
  son checkpoint est `synced` et que le serveur est plus récent, elle prépare
  et installe le document serveur dans le même acteur XState. Le contrôleur
  conserve la page sélectionnée si elle existe encore. Une copie locale
  `pending` ou `conflict` n’est jamais remplacée par le serveur.
- La révision HTTP et `If-Match` détectent une écriture faite depuis une copie
  périmée. Il n’y a ni dernier-écrit-gagnant ni fusion de documents.
- Enregistrer, supprimer ou rejeter un ancien format de document ne retire pas
  les caches des autres projets. Les médias sont indexés par `MediaId` et
  rattachés aux projets par la liste `medias` du document.
- Le contenu éditorial reste dans l’acteur XState. La persistance IndexedDB,
  `ProjectSyncCoordinator` et `ProjectEditorLock` gèrent leur cycle de vie ; ils
  ne changent pas le document en dehors des événements XState.
- Tant que le verrou n’est pas acquis, la surface auteur est `inert` et affiche
  une indication demandant de fermer l’autre fenêtre si elle ne libère pas
  l’accès. Aucun événement d’édition provenant de cette fenêtre inactive ne
  peut modifier le document.
- Web Locks et `BroadcastChannel` coordonnent les fenêtres du même profil de
  navigateur. Deux navigateurs différents ne partagent pas ce verrou ; ils
  échangent leur révision par le serveur au cycle blur/focus. Cette coordination
  ne fournit pas de verrou partagé entre appareils.

## Lire l’implémentation

- [`project-editor-lock.ts`](../src/app/sync/project-editor-lock.ts) contient
  l’usage de Web Locks, de `BroadcastChannel`, de `focus` et de
  `visibilitychange`.
- [`controller-machine.ts`](../src/app/controller/controller-machine.ts)
  possède le verrou d’édition logique et refuse les commandes lorsque l’accès
  est suspendu.
- [`document-persistence.ts`](../src/app/controller/document-persistence.ts)
  attend la fin des écritures IndexedDB, restaure le document actif avec ses
  sources média et installe une révision serveur confirmée dans l’acteur.
- [`document-store.ts`](../src/infrastructure/indexed-db/document-store.ts)
  conserve plusieurs caches projet dans la même base et expose la suppression
  ciblée d’un projet avec `deleteDocument()`.
- [`project-sync-coordinator.ts`](../src/app/sync/project-sync-coordinator.ts)
  suspend les nouvelles requêtes réseau pendant le transfert, confirme sans
  délai la copie au blur, attend une requête déjà en cours et reprend à partir
  du document restauré.
- [`project-session-coordinator.ts`](../src/app/projects/project-session-coordinator.ts)
  relit la révision serveur après l’acquisition du focus et avant de réactiver
  l’édition.
- [`browser-entry.tsx`](../src/app/remix/browser-entry.tsx) compose ces services
  autour de l’unique acteur XState de l’éditeur.

## Vérification

- Les tests XState confirment que l’édition est suspendue avant acquisition,
  qu’un import déjà accepté termine avant la suspension et que les commandes
  suivantes sont refusées.
- Les tests de persistance confirment qu’une seconde fenêtre restaure la
  dernière copie locale avant de recevoir l’accès d’édition.
- Les tests du coordinateur confirment que les sauvegardes serveur restent en
  attente pendant la suspension, puis reprennent après l’acquisition.
- [`project-session-coordinator.test.ts`](../src/app/projects/project-session-coordinator.test.ts)
  vérifie l’envoi au blur et l’installation d’une révision serveur plus récente
  avant la reprise de l’édition. [`project-editor-lock.test.ts`](../src/app/sync/project-editor-lock.test.ts)
  vérifie qu’une fenêtre visible sans focus attend, et qu’un retour de focus
  pendant le transfert du verrou déclenche une nouvelle demande.
  [`project-sync-coordinator.test.ts`](../src/app/sync/project-sync-coordinator.test.ts)
  vérifie qu’un blur qui arrive pendant une écriture n’ajoute pas une seconde
  tentative réseau.
- Dans Safari Technology Preview, deux onglets sur le même document ont
  transféré le verrou au changement d’onglet, puis l’ont transféré au retour.
  Une requête `BroadcastChannel` a aussi fait libérer le verrou alors que la
  fenêtre propriétaire était encore visible. Un verrou retenu par une fenêtre
  simulée a laissé l’autre éditeur en attente avec la surface `inert` ; sa
  libération a réactivé l’éditeur. Chaque observation de
  `navigator.locks.query()` montrait au plus un verrou détenu.
- Le rechargement à froid a restauré le document et réacquis le verrou. Aucun
  contenu n’a été modifié durant ces vérifications ; les seules requêtes API
  observées pendant l’essai étaient les `GET` des médias existants.
- Le 8 octobre, Brave DevTools a exercé deux contextes isolés sur 5175 avec des
  événements blur/focus explicites : une page ajoutée par A est envoyée à la
  révision 1 au blur, puis installée par B au focus ; l’aller-retour inverse
  envoie Page C à la révision 2 et la fait apparaître chez A. Les deux
  checkpoints finissent `synced`, et la réception ne tente pas d’écrire une
  révision périmée. Ces événements synthétiques valident le circuit de
  l’application, mais pas le changement réel de focus entre deux navigateurs
  distincts ; cette preuve reste au plan de synchronisation.
- Brave DevTools a aussi coupé le réseau pendant une édition : le blur a libéré
  l’accès et gardé le checkpoint `pending`. Après reconnexion et reprise du
  focus, la version locale a été envoyée à la révision 2 et le checkpoint est
  revenu à `synced`. Aucun autre navigateur n’a modifié le projet pendant la
  coupure.
- Safari Technology Preview a exercé directement `IndexedDbDocumentStore` sur
  deux entrées projet dans une base temporaire : sauvegarder ou supprimer l’une
  a préservé le document, le checkpoint et les médias de l’autre. Le rejet
  ciblé d’un document v3 a également préservé les données du projet courant.
  L’ouverture de ces projets depuis le menu et leur édition simultanée dans
  plusieurs onglets restent à valider dans le parcours de gestion des projets.

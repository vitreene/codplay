# Elcé — accès d’édition entre fenêtres

## Statut

**Fini le 7 octobre 2026.** Un verrou natif par document, son transfert par
`BroadcastChannel`, la suspension des commandes XState et la reprise depuis la
cache IndexedDB sont vérifiés dans Safari Technology Preview.

## Rôle

Garantir qu’une seule fenêtre de même origine modifie un document Elcé à la
fois. Cette coordination utilise les API du navigateur et ne crée ni état
éditorial parallèle, ni synchronisation directe entre les fenêtres. L’API
serveur reste responsable de la persistance durable ; IndexedDB ne garde que la
cache du document actuellement ouvert, ses médias non transférés et son
checkpoint de synchronisation.

## Contrat

- `ProjectEditorLock` prend un Web Lock exclusif nommé à partir de l’identifiant
  du document et diffuse les demandes de transfert par `BroadcastChannel`.
- L’éditeur attend le verrou avant d’attacher sa persistance et d’autoriser les
  commandes. `controllerMachine` démarre dans l’état `suspended` ; les commandes
  documentaires et les imports sont acceptés uniquement lorsque son contexte
  XState porte `editAccess: 'active'`.
- Une fenêtre qui demande l’accès annonce sa demande. La fenêtre propriétaire
  suspend d’abord les nouvelles commandes, laisse terminer les imports déjà
  acceptés, arrête ses nouvelles écritures réseau, puis attend la sauvegarde
  locale du document avant de libérer le verrou.
- `visibilitychange` vers `hidden` suspend également l’édition et libère le
  verrou après la même sauvegarde locale. Au retour visible ou au retour du
  focus, la fenêtre demande à nouveau le verrou.
- Après acquisition, la fenêtre relit le document et le checkpoint depuis la
  cache IndexedDB partagée, rétablit les sources de média, puis reprend la
  synchronisation. Elle ne remplace jamais une copie locale en attente par un
  document serveur plus ancien. Les révisions HTTP et leur contrôle `If-Match`
  restent le mécanisme de détection d’une divergence distante.
- Le contenu éditorial reste dans l’acteur XState. La persistance IndexedDB,
  `ProjectSyncCoordinator` et `ProjectEditorLock` gèrent leur cycle de vie ; ils
  ne changent pas le document en dehors des événements XState.
- Tant que le verrou n’est pas acquis, la surface auteur est `inert` et affiche
  une indication demandant de fermer l’autre fenêtre si elle ne libère pas
  l’accès. Aucun événement d’édition provenant de cette fenêtre inactive ne
  peut modifier le document.
- Cette coordination couvre les fenêtres et onglets de même origine sur la
  machine locale. Elle ne coordonne pas plusieurs appareils.

## Lire l’implémentation

- [`project-editor-lock.ts`](../src/app/sync/project-editor-lock.ts) contient
  l’usage de Web Locks, de `BroadcastChannel`, de `focus` et de
  `visibilitychange`.
- [`controller-machine.ts`](../src/app/controller/controller-machine.ts)
  possède le verrou d’édition logique et refuse les commandes lorsque l’accès
  est suspendu.
- [`document-persistence.ts`](../src/app/controller/document-persistence.ts)
  attend la fin des écritures IndexedDB et restaure le document actif avec ses
  sources média.
- [`project-sync-coordinator.ts`](../src/app/sync/project-sync-coordinator.ts)
  suspend les nouvelles requêtes réseau pendant le transfert, puis reprend à
  partir du document local restauré.
- [`browser-entry.ts`](../src/app/remix/browser-entry.ts) compose ces services
  autour de l’unique acteur XState de l’éditeur.

## Vérification

- Les tests XState confirment que l’édition est suspendue avant acquisition,
  qu’un import déjà accepté termine avant la suspension et que les commandes
  suivantes sont refusées.
- Les tests de persistance confirment qu’une seconde fenêtre restaure la
  dernière copie locale avant de recevoir l’accès d’édition.
- Les tests du coordinateur confirment que les sauvegardes serveur restent en
  attente pendant la suspension, puis reprennent après l’acquisition.
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

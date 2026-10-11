# Elcé — accès d’édition et synchronisation par focus

## Statut

**Le verrou entre fenêtres du même profil est vérifié ; l’extension exclusive
entre navigateurs est implémentée et sa validation réelle à deux navigateurs
reste en cours.** La suspension XState, la reprise IndexedDB, la paire de droit
serveur et le transfert par événements sont vérifiés par les tests ciblés et
un parcours Safari avec signaux de focus synthétiques.

## Rôle

Le Web Lock garde un seul éditeur actif parmi les fenêtres de même origine qui
partagent le même profil. Le droit SQLite exclut aussi une deuxième édition
depuis un autre navigateur. Chaque cache reste indépendant et les lecteurs
suivent la dernière révision confirmée par le serveur. Cette coordination ne
crée ni document éditorial parallèle, ni
synchronisation directe entre navigateurs ; l’API projet reste responsable de
la persistance durable. IndexedDB conserve une entrée de cache par projet
ouvert, avec ses médias non transférés et son checkpoint de synchronisation.
Des fenêtres sur des projets différents gardent des caches indépendantes.

## Contrat

- `ProjectEditorLock` prend un Web Lock exclusif nommé à partir de l’identifiant
  du projet et diffuse les demandes de transfert par `BroadcastChannel`. Il ne
  demande le verrou que si la fenêtre est visible et possède le focus ; une
  fenêtre ouverte en arrière-plan reste en attente.
- L’éditeur attend le Web Lock et la paire de droit serveur avant d’autoriser les
  commandes. `controllerMachine` démarre dans l’état `suspended` ; les commandes
  documentaires et les imports sont acceptés uniquement lorsque son contexte
  XState porte `editAccess: 'active'`.
- Une fenêtre qui demande l’accès annonce sa demande. La fenêtre propriétaire
  suspend d’abord les nouvelles commandes, laisse terminer les imports déjà
  acceptés et attend la sauvegarde locale puis la confirmation serveur du
  document et de tous ses médias avant de libérer le droit serveur, puis le
  Web Lock. Un `media.merge` issu d’un upload déjà accepté peut terminer sous
  suspension, sans entrée Undo ni nouvelle commande auteur.
- `blur` suspend les nouvelles commandes, attend la fin des commandes déjà
  acceptées et des écritures IndexedDB, puis confirme le document et les
  médias sans attendre le délai local de 500 ms. Une requête en cours est
  attendue. Une erreur réseau garde le checkpoint en attente **et retient le
  droit** : une autre page ne peut pas éditer le document source. Le retour du
  réseau ou du focus reprend la sortie sur la même session, y compris si le
  focus a été perdu juste après l’acquisition du Web Lock ; un conflit de
  révision n’est pas répété comme une panne réseau.
- `visibilitychange` vers `hidden` suspend également l’édition et libère le
  verrou après la même sauvegarde locale. Au retour visible ou du focus, la
  fenêtre demande le verrou quand elle possède effectivement le focus.
- Une page sans droit affiche la révision confirmée, avec la surface auteur
  `inert`. Elle conserve séparément sa copie IndexedDB `pending` ou `conflict`
  et relève les révisions du catalogue quand elle est visible, toutes les deux
  secondes, ainsi qu’au retour du focus. Après acquisition, la page restaure
  sa copie locale, achève sa publication en attente, puis relit et installe la
  révision confirmée dans le même acteur XState avant d’autoriser les commandes.
  Le contrôleur conserve la page sélectionnée si elle existe encore.
- Une copie locale identique au document courant ne vide pas
  l’[historique documentaire](./document-history-spec.md) lors d’un simple
  retour de focus. L’installation d’un document différent le vide.
- La révision HTTP et `If-Match` détectent une écriture faite depuis une copie
  périmée ; le droit serveur refuse en plus les anciennes pages. Il n’y a ni
  dernier-écrit-gagnant ni fusion de documents.
- Enregistrer, supprimer ou rejeter un ancien format de document ne retire pas
  les caches des autres projets. Les médias sont indexés par `MediaId` et
  rattachés aux projets par la liste `medias` du document.
- Le contenu éditorial reste dans l’acteur XState. La persistance IndexedDB,
  `ProjectSyncCoordinator` et `ProjectEditorLock` gèrent leur cycle de vie ; ils
  ne changent pas le document en dehors des événements XState.
- Tant que le droit n’est pas acquis, la surface auteur est `inert`, montre le
  document confirmé et propose « Réessayer l’accès » et « Enregistrer sous… ».
  Si un document local reste `pending` ou `conflict`, « Enregistrer la copie
  locale sous… » apparaît indépendamment d’un éventuel message d’erreur.
  Aucun événement d’édition de cette page ne peut modifier le document source.
- Web Locks et `BroadcastChannel` coordonnent les fenêtres du même profil.
  Une identité de page issue d’une recharge peut être conservée dans
  `sessionStorage` ; une identité copiée dans un onglet vivant est remplacée
  avant l’acquisition. SQLite est l’arbitre commun aux autres navigateurs.

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
  relit la révision serveur avant de réactiver l’édition et raccorde
  [`ExclusiveSyncSession`](../../authoring/exclusive-sync/specs/exclusive-sync-spec.md)
  au même acteur.
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
- Safari Technology Preview a exercé directement `IndexedDbDocumentStore` sur
  deux entrées projet dans une base temporaire : sauvegarder ou supprimer l’une
  a préservé le document, le checkpoint et les médias de l’autre. Le rejet
  ciblé d’un document v3 a également préservé les données du projet courant.
  L’ouverture de ces projets depuis le menu et leur édition simultanée dans
  plusieurs onglets restent à valider dans le parcours de gestion des projets.

La tranche du 11 octobre ajoute les tests de la classe commune, du droit
SQLite, de la copie locale de secours, de la récupération d’un média source et
de `media.merge` pendant une suspension. Le test HTTP en écoute passe avec le
port local autorisé. Dans Safari, une modification de A a été confirmée au
blur puis installée dans B avant son activation ; un droit pris par une page
simulée a maintenu C en lecture seule, et C a pu créer une copie distincte.
La relecture d’une nouvelle révision au focus a été observée. Les signaux de
focus étaient synthétiques car Safari gardait les onglets d’automatisation
réellement masqués ; la validation réelle avec deux navigateurs demeure au
[plan d’accès exclusif](../plan/2026-10-11-elce-acces-exclusif-inter-navigateurs-plan.md).
Les régressions ciblées vérifient aussi le Web Lock retenu après une sortie
échouée, sa libération au retour du réseau, et la disponibilité de la copie
locale sur la vue lectrice malgré l’installation du document confirmé.

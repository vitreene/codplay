# Elcé — accès d’édition et synchronisation par focus

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
- La barrière de synchronisation attend le flush local, puis publie le document
  courant de l’acteur XState. Si ce flush ou une normalisation interne remplace
  l'objet document, elle planifie cette valeur désormais persistée et attend sa
  confirmation avant de poursuivre. Sans flush local confirmé, un document
  courant différent de la dernière valeur planifiée reste refusé.
- `blur` suspend les nouvelles commandes, attend la fin des commandes déjà
  acceptées et des écritures IndexedDB, puis confirme le document et les
  médias sans attendre le délai local de 500 ms. Une requête en cours est
  attendue. Une erreur réseau garde le checkpoint en attente **et retient le
  droit** : une autre page ne peut pas éditer le document source. Le retour du
  réseau ou du focus reprend la sortie sur la même session, y compris si le
  focus a été perdu juste après l’acquisition du Web Lock ; un conflit de
  révision n’est pas répété comme une panne réseau.
- Quand un clic sur `input[type="file"]` ouvre le sélecteur natif, le verrou
  conserve le droit serveur et le Web Lock à travers le `blur` et le passage
  éventuel à `hidden`. Le `change` ou `cancel` est traité après les gestionnaires
  de l’input. Si la page n’a pas encore retrouvé le focus, le verrou et l’accès
  XState restent actifs jusqu’au retour d’une page visible et focalisée ; cela
  évite une suspension transitoire pendant la soumission de l’import. Une
  demande de transfert ordinaire reçue pendant cette séquence attend sa fin,
  puis reprend la suspension et la synchronisation normales. Si le navigateur
  n’émet aucun événement de sélection, le retour du focus ferme l’exception
  après un bref délai. Le forçage explicite et la fermeture de page gardent
  leurs règles actuelles.
- `visibilitychange` vers `hidden` suspend également l’édition et libère le
  verrou après la même sauvegarde locale, sauf pendant le sélecteur natif décrit
  ci-dessus. Au retour visible ou du focus, la fenêtre demande le verrou quand
  elle possède effectivement le focus.
- Le droit serveur porte un bail de 12 secondes, renouvelé toutes les
  3 secondes par la page détentrice. Si un renouvellement échoue, la page se
  suspend immédiatement ; après expiration, une page lectrice peut obtenir un
  nouveau droit et relire la dernière révision confirmée. Les anciennes paires
  restent refusées.
- Le bouton temporaire « Forcer l’accès » permet à une page lectrice de
  remplacer immédiatement le droit serveur, même si son bail est encore actif.
  Dans le même profil, `BroadcastChannel` suspend l’ancien détenteur ; dans un
  autre navigateur, l’ancien détenteur le découvre au prochain renouvellement.
  Le nouveau détenteur installe la révision confirmée avant d’activer l’édition.
- Une reprise forcée ou après expiration fait de la révision serveur la valeur
  de référence et remplace le cache local de la page entrante. Elle ne crée pas
  de copie de secours ni d’accusé de réception supplémentaire ; les changements
  locaux non confirmés ne sont pas récupérés automatiquement par ce chemin.
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
- Sans droit d’édition, la surface auteur est `inert` et montre le document
  confirmé. L’état ordinaire reste indiqué par « Lecture seule » : les refus
  `edit_access_occupied` et la perte du droit d’une autre page ne montrent pas
  de message d’erreur ni de commandes d’accès. Une interaction dans une page
  visible et focalisée déclenche d’abord la reprise automatique. Après trois
  tentatives de reprise consécutives échouées, l’interface montre un message de
  récupération et les commandes « Réessayer l’accès » et « Forcer l’accès ».
  Une reprise réussie efface cet état. Un `TypeError` de transport survenu
  lorsque la page est masquée ou sans focus ne crée pas d’alerte périmée ; les
  tentatives existantes reprennent au retour du réseau ou du focus. Si l’échec
  persiste sur une page visible et focalisée, le message indique seulement que
  la communication avec le serveur a échoué et propose de réessayer l’accès.
  Le début d’une nouvelle tentative efface cette erreur transitoire : un refus
  normal `409 edit_access_occupied` ou `409 edit_access_lost` laisse le projet
  en lecture seule sans ancienne alerte. Cette transition conserve les
  messages de récupération après plusieurs échecs et les avertissements de
  synchronisation.
  Pour une copie indépendante, un `TypeError` pendant la synchronisation indique
  que celle-ci a échoué et que l’état local est conservé ; il n’affirme pas que
  le réseau est indisponible. Une reprise réussie efface l’avertissement. Les
  erreurs de synchronisation gardent leur message propre. Si un document local
  reste `pending` ou `conflict`, « Enregistrer la copie locale sous… » apparaît
  indépendamment de l’accès. Aucun événement d’édition de cette page ne peut
  modifier le document source.
- Web Locks et `BroadcastChannel` coordonnent les fenêtres du même profil.
  Une identité de page issue d’une recharge peut être conservée dans
  `sessionStorage` ; une identité copiée dans un onglet vivant est remplacée
  avant l’acquisition. SQLite est l’arbitre commun aux autres navigateurs.

## Lire l’implémentation

- [`project-editor-lock.ts`](../src/core/sync/project-editor-lock.ts) contient
  l’usage de Web Locks, de `BroadcastChannel`, de `focus` et de
  `visibilitychange`.
- [`controller-machine.ts`](../src/core/controller/controller-machine.ts)
  possède le verrou d’édition logique et refuse les commandes lorsque l’accès
  est suspendu.
- [`document-persistence.ts`](../src/core/persistence/document-persistence.ts)
  attend la fin des écritures IndexedDB, restaure le document actif avec ses
  sources média et installe une révision serveur confirmée dans l’acteur.
- [`document-store.ts`](../src/core/persistence/indexed-db/document-store.ts)
  conserve plusieurs caches projet dans la même base et expose la suppression
  ciblée d’un projet avec `deleteDocument()`.
- [`project-sync-coordinator.ts`](../src/core/sync/project-sync-coordinator.ts)
  suspend les nouvelles requêtes réseau pendant le transfert, confirme sans
  délai la copie au blur, attend une requête déjà en cours et reprend à partir
  du document restauré.
- [`project-session-coordinator.ts`](../src/core/projects/project-session-coordinator.ts)
  relit la révision serveur avant de réactiver l’édition et raccorde
  [`ExclusiveSyncSession`](../../authoring/exclusive-sync/specs/exclusive-sync-spec.md)
  au même acteur.
- [`learning-project-session-coordinator.ts`](../src/mods/learning/persistence/learning-project-session-coordinator.ts)
  injecte les règles documentaires Learning dans le coordinateur commun.
- [`authoring-composition.tsx`](../src/mods/learning/composition/authoring-composition.tsx)
  compose ces services autour de l’unique acteur XState de l’éditeur.

## Vérification

- Les tests XState confirment que l’édition est suspendue avant acquisition,
  qu’un import déjà accepté termine avant la suspension et que les commandes
  suivantes sont refusées.
- Les tests de persistance confirment qu’une seconde fenêtre restaure la
  dernière copie locale avant de recevoir l’accès d’édition.
- Les tests du coordinateur confirment que les sauvegardes serveur restent en
  attente pendant la suspension, puis reprennent après l’acquisition.
- [`project-session-coordinator.test.ts`](../src/mods/learning/integration/project-session-coordinator.test.ts)
  vérifie l’envoi au blur et l’installation d’une révision serveur plus récente
  avant la reprise de l’édition. [`project-editor-lock.test.ts`](../src/core/sync/project-editor-lock.test.ts)
  vérifie qu’une fenêtre visible sans focus attend, et qu’un retour de focus
  pendant le transfert du verrou déclenche une nouvelle demande. Le test du
  coordinateur couvre aussi un `TypeError` temporaire pendant la perte de focus :
  l’accès reste en attente sans `projectError`, puis le retour en ligne/focus et
  l’acquisition réactivent l’édition sans message. Les 21 tests ciblés passent.
  [`project-sync-coordinator.test.ts`](../src/mods/learning/integration/project-sync-coordinator.test.ts)
  vérifie qu’un blur qui arrive pendant une écriture n’ajoute pas une seconde
  tentative réseau et que le document courant, remplacé dans XState, est publié
  après le flush local.
- [`project-editor-lock.test.ts`](../src/core/sync/project-editor-lock.test.ts)
  vérifie le maintien du droit pendant le sélecteur, le traitement d’un
  transfert concurrent après `change`, les retours de focus et de visibilité
  avant ou après `change`/`cancel`, l’annulation et la reprise du blur ordinaire.
- [`project-session-coordinator.test.ts`](../src/mods/learning/integration/project-session-coordinator.test.ts)
  reproduit une erreur de transport visible à l’acquisition, puis une reprise
  refusée par `409 edit_access_occupied` ; l’erreur transitoire disparaît et le
  projet reste en lecture seule. Le test de la machine confirme que cette
  transition conserve les alertes de récupération et de synchronisation.
  Le test du
  [page editor](../src/app/remix/workspace/page-editor.test.tsx) relie ce blur
  au vrai input Remix et confirme qu’un JPG choisi avant le retour du focus
  rejoint le document par la file XState existante sans suspendre l’accès.
  La boîte de dialogue système réelle reste à valider dans un navigateur.
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
- Les tests SQLite couvrent le renouvellement du bail, sa récupération après
  expiration, le forçage d’un détenteur actif et le refus d’une écriture avec
  l’ancien droit. Brave sur 5175 a actionné « Forcer l’accès » depuis une page
  lectrice sur un projet temporaire : elle est redevenue éditable et une
  écriture du droit remplacé a reçu `409 edit_access_lost`. Le projet temporaire
  a ensuite été supprimé. Cette vérification n’établit pas le transfert de
  focus entre deux navigateurs réels ; cette preuve reste au plan.
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

Les tests [`project-editor-lock.test.ts`](../src/core/sync/project-editor-lock.test.ts)
et [`project-application.test.tsx`](../src/app/remix/project-application.test.tsx)
vérifient la priorité sur interaction, l’absence de message et de commandes
d’accès dans le lecteur ordinaire, l’apparition du secours après trois échecs
et son effacement après acquisition. Brave sur 5175 a également confirmé que
le lecteur ordinaire ne montre que « Lecture seule ». Le transfert entre les
deux fenêtres Brave reste à confirmer dans le plan d’accès exclusif.

Le 27 octobre 2026, Safari MCP a confirmé sur `http://localhost:5175/` que la
page sans focus reste en lecture seule sans l’ancienne alerte. Après activation
de Safari, `document.hasFocus()` passe à `true`, l’éditeur revient à
« Synchronisé » et le message ne réapparaît pas.

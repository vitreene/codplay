# Rapport de reprise — état après B3, D1, D2 et R1

**Statut : point de reprise après la réalisation et la preuve de la première verticale V2 position/taille.**
**Date : 2026-09-01.**  
**Plan actif :** [`2026-09-01-editor-v2-organization-plan.md`](./2026-09-01-editor-v2-organization-plan.md)

Ce fichier est un point de reprise factuel. Les contrats normatifs restent dans
les spécifications V2 ; les actions et leur statut restent dans le plan actif.
Il ne crée aucun contrat et ne remplace pas le plan. Il consigne l'état atteint
pour permettre une reprise ultérieure.

## Point de reprise

La première verticale player/éditeur V2 est raccordée de bout en bout : le
builder produit des nombres `unitless`, CodPlay les qualifie selon la
configuration courante `cqw`, `instance.snapshot` porte la lecture et la
preview, la façade player exécute le transport, le bridge de coordination
relie `sequence-editor` et `decor-editor`, et le cadre V2 projette la valeur
logique dans la racine de scène.

Le parcours réel Firefox a validé sélection, déplacement, redimensionnement,
commit, abandon, Play/Pause, seek, Stop et changement de largeur de racine.
Le plan reste `En cours` pour les contrôles navigateur complémentaires, S2
(`snapshot.onChange`) et les extensions hors de cette verticale.

## Réalisations effectuées

### C1/S1 — core V2

- La configuration CodPlay porte la longueur logique courante `cqw`.
- Les champs structurés de position et de taille entrent comme nombres
  `unitless`; l'éditeur ne fabrique plus d'objets `{ kind: 'length', unit: 'cqw' }`.
- La qualification est faite à la frontière de compilation CodPlay.
- `instance.snapshot.get()`, `set()` et `clear()` sont disponibles avec les
  diagnostics prévus ; la preview ne modifie ni le journal ni la scène
  compilée.

### B1 — façade et coordination

- `EditorPlayerCommandFacade` est créée dans
  `packages/editor/src/app/commands/editor-player-command-facade.ts`.
- Elle est l'unique propriétaire de la référence d'instance, du `preRollMs`,
  des appels `instance.telco` et des abonnements `onChange`/`onProgress`.
- Elle vérifie le résultat observable de `seek`, `play`, `pause`, `rewind` et
  `setRate` avant de retourner un succès.
- `EditorCoordinationBridge` est créé par `AppLayout`. Il ne possède pas
  l'instance CodPlay et ne modifie pas le document.
- La façade documentaire et le contrat d'historisation restent séparés ; les
  commandes de document continuent de passer par `RUN_COMMAND` ou
  `RUN_TRANSACTION`.

### B2 — cycle de scène V2

`packages/editor/src/app/bridges/scene-player-bridge.ts` utilise désormais :

1. `buildSceneDocV2()` ;
2. `codplay.build()` ;
3. le preload des ressources et la feuille CSS V2 ;
4. une instance V2 active ;
5. le remplacement transactionnel d'une instance par une autre ;
6. le port `snapshot` et le `preRollMs` via le bridge de coordination.

Les imports et appels V1 ont été retirés de ce bridge. Le cycle de remplacement
et le parcours navigateur réel sont validés dans la preuve ci-dessous.

### B3 — contrôleur et `sequence-editor`

- `ControllerContext` ne contient plus `AuthorApi`, `TelcoApi`,
  `referenceWidthPx`, `offsetBridge` ni une instance player.
- `PLAYER_READY` et `authorApiReady` ont été retirés du contrôleur.
- `sequence-editor` reçoit un transport générique fourni par la coordination ;
  il ne possède plus de telco et n'appelle plus directement le player.
- `playheadMs` reste la progression auteur. La progression de lecture sert à
  l'affichage pendant `playing` et n'est pas recopiée dans `playheadMs` à chaque
  tick.
- La sortie de lecture adopte une seule fois le temps exposé par le player via
  `PLAYHEAD.RECONCILE`, sans réémettre de `SEEK` ni créer d'historique.
- L'insertion de keyframe lit le snapshot V2 au lieu d'un `AuthorApi`.
- Les commandes Play/Pause/Stop de l'interface continuent à suivre la
  séquence historique, mais leur exécution passe maintenant par la façade et
  le bridge V2.

### D1 — décor et snapshot

- `decor-editor-bridge.ts` lit la base par `coordination.snapshot.get()` et
  résout la valeur logique au temps présenté ; il ne lit aucun node player.
- La valeur du cadre est locale à la racine de scène et exprimée en px.
  `decor-editor-bridge` convertit les deltas px en patch `offset` unitless,
  puis envoie le même patch de style à `snapshot.set()`.
- La base du geste est conservée séparément de la valeur candidate. Le cadre
  reste donc stable lorsque plusieurs événements de pointeur arrivent pendant
  un même geste.
- Le commit efface la preview, passe par la commande xState et reconstruit
  l'instance V2 ; l'abandon efface la preview sans mutation documentaire.
- Les champs `style.width`/`style.height` de la palette ne concurrencent plus
  `offset.width`/`offset.height`.

### D2 — Selection Frame V2

- `packages/authoring/selection-frame/src/v2.ts` fournit un overlay neutre de
  move/resize, piloté par `SelectionFrameValue` et des deltas px.
- Le cadre ne connaît ni CodPlay, ni snapshot, ni document, ni node rendu.
- `decor-editor-bridge` est l'unique adaptateur qui connaît la sélection, le
  snapshot, la largeur de racine, le patch et la décision preview/commit.
- Pendant la lecture, le cadre est suspendu ; après pause ou seek, il est
  reprojeté depuis la base logique.

## Retrait V1 effectué et restant

Retiré de la verticale B1–B3 :

- les handles runtime V1 du contexte xState ;
- l'événement de readiness V1 ;
- `TELCO.SYNC_PLAYHEAD` et `syncPlayheadFromTelco()` ;
- les imports V1 du bridge de scène et du bridge de séquence ;
- l'appel direct aux méthodes de transport depuis `sequence-editor`.

R1 a retiré de la verticale migrée :

- les bridges et tests éditeur qui importaient ou simulaient `AuthorApi`,
  `subscribeToNode`, `NodePose` ou le player V1 ;
- `packages/editor/src/app/bridges/offset-editor-bridge.ts` ;
- `packages/editor/src/builder/` et son chemin de build historique ;
- la dépendance directe `codplay-v1` de `packages/editor` ;
- les appels V1 dans le code de production de `packages/editor/src`.

Les modules historiques restant dans `packages/authoring/selection-frame` ne
sont pas consommés par l'entrée `/v2` de cette verticale. Leur migration
éventuelle relève d'un plan séparé ; ils ne sont pas supprimés globalement par
R1.

## Validation exécutée

Les validations suivantes ont été exécutées sans suite V1 :

- `npm run test --workspace=codplay -- tests/scene/compiled/scene-builder.spec.ts tests/facade/cqw.spec.ts tests/facade/snapshot.spec.ts` : **3 fichiers, 21 tests passés** ;
- `npm run typecheck --workspace=codplay` : **passé** ;
- `./../../node_modules/.bin/vitest run --config vitest.config.ts tests/builder-v2/build-scene.spec.ts` depuis `packages/editor` : **1 fichier, 11 tests passés** ;
- suite éditeur V2 : **28 fichiers, 340 tests passés** ;
- tests Selection Frame V2 : **3 tests passés** ;
- régression builder/player couleur + position/taille : **passée** ;
- `./../../node_modules/.bin/tsc --noEmit -p tsconfig.json` depuis
  `packages/editor` : **passé** ;
- build `@codplay/editor` : **passé**.

### Preuve navigateur Firefox

Sur l'outil lancé avec le serveur Vite réel :

1. la scène de démonstration et le scénario position/couleur ont été chargés ;
2. l'item a été sélectionné par son identité DOM V2 ; le cadre et l'item
   avaient le même rectangle local ;
3. un déplacement de `24px` a produit `offset.translate.x = 10.7777…` et le
   cadre a suivi la valeur candidate ;
4. un redimensionnement de `40px × 20px` a produit
   `offset.width = 22.6296…` et `offset.height = 20.3148…` ; commit et rebuild
   ont conservé ces valeurs ;
5. Play a masqué le cadre, Pause a réconcilié une fois le temps auteur
   (`~660ms`), Seek a repositionné la scène (`~2425ms`), puis Stop a ramené le
   temps à zéro ;
6. l'interpolation à `~2425ms` affichait simultanément la couleur et la
   géométrie ;
7. un abandon par Échap a effacé la preview sans modifier le décor persistant ;
8. la racine est passée de `864px` à `1098px` de large : les nombres logiques
   sont restés identiques tandis que le cadre et l'item ont été reprojetés avec
   le même rectangle px.

Cette preuve a été faite avec Firefox headless. Elle ne vaut pas contrôle Safari
et ne couvre pas les scénarios grille, parent transformé, taille intrinsèque,
multi-sélection ou reparentage.

## Reprise ordonnée

1. Mettre à jour les suivis des modules concernés sans les marquer `Fini` tant
   que leur matrice de navigateur applicable n'est pas complète.
2. Décider séparément S2 (`snapshot.onChange`) ; ne pas l'ajouter pour cette
   verticale tant que son contenu, son payload, son moment d'émission et son
   abonnement unique ne sont pas validés.
3. Exécuter les contrôles Safari ou autres navigateurs prévus par la matrice,
   en conservant Firefox comme preuve déjà acquise.
4. Ouvrir, dans un plan distinct, les besoins de grille, multi-sélection,
   parent transformé, taille intrinsèque et reparentage.

La reprise ne doit pas revenir sur C1/S1 ni réintroduire une synchronisation
continue de `playheadMs` depuis `telco.onProgress()`.

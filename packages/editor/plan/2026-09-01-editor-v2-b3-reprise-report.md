# Rapport de reprise — pause après B3

**Statut : pause volontaire après la réalisation structurelle de B3.**  
**Date : 2026-09-01.**  
**Plan actif :** [`2026-09-01-editor-v2-organization-plan.md`](./2026-09-01-editor-v2-organization-plan.md)

Ce fichier est un point de reprise factuel. Les contrats normatifs restent dans
les spécifications V2 ; les actions et leur statut restent dans le plan actif.
Ce rapport ne valide pas D1, D2, R1 ni le parcours navigateur.

## Point de reprise

La connexion player/éditeur V2 est posée jusqu'à B3 : le builder produit des
nombres `unitless`, CodPlay les qualifie en `cqw`, l'instance expose
`snapshot`, la façade de commandes possède le transport et le bridge de
coordination relie le player au `sequence-editor`. Le décor n'est pas encore
rebranché sur ce circuit : c'est la prochaine tranche D1.

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

Les imports et appels V1 ont été retirés de ce bridge. Le cycle n'a pas encore
été accepté par un parcours navigateur réel.

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

## Retrait V1 effectué et restant

Retiré de la verticale B1–B3 :

- les handles runtime V1 du contexte xState ;
- l'événement de readiness V1 ;
- `TELCO.SYNC_PLAYHEAD` et `syncPlayheadFromTelco()` ;
- les imports V1 du bridge de scène et du bridge de séquence ;
- l'appel direct aux méthodes de transport depuis `sequence-editor`.

Restent volontairement à traiter dans D1/D2/R1 :

- `packages/editor/src/app/bridges/decor-editor-bridge.ts`, dont le câblage
  principal référence encore `authorApi`, `offsetBridge` et l'ancien montage ;
- `packages/editor/src/app/bridges/offset-editor-bridge.ts`, qui est encore le
  pont V1 de pose et doit être supprimé après la réécriture D1 ;
- les modules historiques de `packages/authoring/selection-frame` et le
  builder historique V1, hors de la verticale déjà basculée ;
- les tests qui doublent `AuthorApi`, `subscribeToNode` ou une pose DOM.

La mention `Projection.measure` n'est pas retenue comme API : elle n'est ni
nécessaire ni validée dans B3. La définition du circuit géométrique du cadre
reste à faire dans D1/D2 sans inventer de façade core.

## État des préparatifs D1/D2

Quelques préparatifs D1 sont présents dans l'arbre, mais ils ne constituent pas
une implémentation acceptée :

- le montage de palette a été réduit à une vue qui n'écrit plus directement un
  node player ;
- les types de décor ne dépendent plus de `codplay-v1` pour `ClassNameValue` ;
- des helpers de lecture snapshot existent dans `decor-editor-bridge.ts` ;
- le raccord principal de ce bridge et `offset-editor-bridge.ts` n'est pas
  reconstruit et le typecheck éditeur les signale encore.

D2 n'est pas engagé : aucun nouveau package, contrat public de mesure ou
prototype de Selection Frame V2 n'est conservé dans cette pause.

## Validation exécutée

Les validations suivantes ont été exécutées sans suite V1 :

- `npm run test --workspace=codplay -- tests/scene/compiled/scene-builder.spec.ts tests/facade/cqw.spec.ts tests/facade/snapshot.spec.ts` : **3 fichiers, 21 tests passés** ;
- `npm run typecheck --workspace=codplay` : **passé** ;
- `./../../node_modules/.bin/vitest run --config vitest.config.ts tests/builder-v2/build-scene.spec.ts` depuis `packages/editor` : **1 fichier, 11 tests passés**.

Le typecheck global `packages/editor/tsconfig.json` n'est pas passant à cette
étape. Les erreurs propres au chantier sont limitées au raccord décor/offset
ancien : propriétés supprimées du contexte, ancien `setOffsetBridge`, ancienne
signature de montage et types retirés. Le même typecheck inclut également des
erreurs existantes sous `packages/codplay-v1/src/`. Ce résultat ne justifie ni
la réintroduction de V1 ni l'exécution des tests V1.

Aucun test live navigateur n'a été lancé à cette pause. Il reste obligatoire
après D1/D2, avant de déclarer l'intégration stable.

## Reprise ordonnée

1. Relire les spécifications `decor-editor`, Selection Frame et snapshot V2,
   puis terminer D1 : unifier palette, cadre et multi-sélection autour du
   snapshot via le bridge de coordination.
2. Supprimer `offset-editor-bridge.ts` et les usages de pose V1 ; ne créer
   aucun équivalent `getNodePose`/`setNodePose`.
3. Implémenter D2 sur l'interface interne de `decor-editor` : valeur px et
   deltas de geste côté cadre, patch logique `unitless` au bord du bridge,
   `snapshot.set/clear` pour la preview, commandes xState pour le commit.
4. Réécrire les tests de frontière sur snapshot, interpolation simultanée
   couleur + position/taille, sélection, abandon, commit et rebuild.
5. Effectuer le parcours live réel : sélection, Play/Pause/Stop, Seek, move,
   resize, couleur, resize de racine, abandon, commit et rebuild.
6. Exécuter R1 : retrait des imports, dépendances et fichiers V1 encore
   présents dans la verticale migrée, puis typecheck/build et contrôles
   navigateur applicables.

La reprise doit commencer par D1 ; elle ne doit pas revenir sur C1/S1 ni
réintroduire une synchronisation continue de `playheadMs` depuis
`telco.onProgress()`.

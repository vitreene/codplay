# V1 - separation move policy / state / backend DOM

## Statut

Lot prepare pour reprise ulterieure.

Ne pas demarrer avant la fin des slices deja prevus:

- Slice 11 - lisibilite `create-player.ts`
- Slice 12 - lisibilite `runtime-component-orchestrator.ts`
- Slice 13 - nettoyage de compatibilite
- Slice 14 - consolidation tests large
- Slice 15 - scene de reference metier

## Objectif

Retirer du coeur runtime toute dependance backend-specifique liee a `move`, afin que:

- `RuntimeComponentOrchestrator` reste un routeur d'updates agnostique du rendu
- la politique `move` soit pure et testable sans DOM
- l'etat logique des containers soit distinct de la vue DOM
- les effets visuels `FLIP` / `overlay-world` deviennent une responsabilite du backend DOM
- un backend canvas puisse etre ajoute sans reecrire la politique `move`

## Ecarts spec constates aujourd'hui

Les ecarts suivants existent dans l'etat actuel du code et doivent etre supprimes par ce lot:

- `src/runtime/components/runtime-component-orchestrator.ts` contient a la fois la politique `move`, l'etat logique, la mutation de structure et l'execution DOM/FLIP.
- `src/runtime/components/list-runtime-component.ts` contient une partie de la semantique metier de placement, pas seulement la vue DOM.
- la source de verite de l'ordre logique des enfants reste logee dans le composant list via `orderedChildIds`.
- l'orchestrateur connait des details DOM qui ne doivent pas exister dans un coeur runtime agnostique.

Fonctions actuellement fautives ou trop chargees:

- `routeUpdates(...)`
- `routeResolvedUpdate(...)`
- `normalizeMoveCommand(...)`
- `resolveMoveDecisions(...)`
- `applyMoveForPerso(...)`
- `collectFlipEntriesForMove(...)`
- `tryBuildOverlayWorldTransitions(...)`
- `buildOverlayWorldTransitions(...)`
- `syncDomParentFallback(...)`

Fonctions/metadonnees a sortir du composant list:

- `orderedChildIds`
- `persistentPlacementByChildId`
- `nextPlacementOrder`
- `resolveReorderConfig(...)`
- `shouldApplyReorder(...)`
- `applyPlacementMode(...)`
- `rebuildOrderFromPersistentRules(...)`

## Contraintes non negociables

- comportement strictement identique pendant toute la migration
- aucune regression visible sur la demo `player-poc-demo`
- aucune regression des tests runtime/player existants
- meme resolution same-tick pour `move`
- meme cycle detach -> reattach avec reutilisation du meme node
- memes `TransitionRequest` utiles pour les chemins DOM actuels
- aucune suppression prematuree des chemins de compatibilite sans baseline equivalente

## Invariants a figer avant extraction

Ces invariants doivent etre documentes et testes avant toute bascule de responsabilite:

- `initial.move` est applique pendant le chargement runtime des persos (`loadPersos(...)`).
- `story.initial.move` est applique pendant le chargement runtime pour positionner le `story host` de l'instance.
- `initial.move` peut etre explicite (`parentId`) ou symbolique via le token configurable `rootToken`.
- `rootToken` resout le `story host` courant; ce n'est pas un id runtime explicite.
- le token `rootToken` sert a une assignation de placement, pas a un mouvement DOM en soi.
- un perso est monte dans le `story host` uniquement via un `move` explicite ciblant `rootToken` (`@root`) — aucun montage implicite sans `move` (l'ancien champ `Story.entries` qui portait ce role est retire, voir `v1-perso-spec.md` 4bis).
- la cle de conflit same-tick pour `move` est `{ eventSeq, persoId }`.
- en cas de conflit same-tick, le dernier `move` valide gagne.
- si le dernier `move` du tick est invalide, aucun `move` du tick ne s'applique pour cet item.
- un target list manquant detache l'item, laisse `parentListId = null`, `mounted = false`, et conserve le node reutilisable.
- un reattach apres detach reutilise le meme node.
- `mode: auto | first | last | append | prepend | number` garde la semantique actuelle.
- les placements persistants `first/last` restent memorises tant qu'un mode non persistant ne les efface pas.
- `reorderOnMove`, `reorderOnAdd`, `reorderOnRemove` gardent leur effet actuel.
- `flipMode: overlay-world` garde le pipeline visuel actuel.
- les warnings existants restent emis avec les memes codes.

Warnings a conserver tels quels:

- `AUTHOR_MOVE_COMMAND_INVALID`
- `AUTHOR_MOVE_CONFLICT_SAME_TICK`
- `AUTHOR_MOVE_LAST_INVALID_SAME_TICK`
- `AUTHOR_LIST_MOVE_TARGET_NOT_FOUND`
- `RUNTIME_COMPONENT_NODE_NOT_FOUND`
- `RUNTIME_FLIP_OVERLAY_MODE_UNAVAILABLE_FALLBACK_LOCAL`

## Architecture cible

Le lot doit aboutir a 4 briques distinctes.

1. `move policy`

- pure
- sans DOM
- sans component instance
- sans node
- sans `HTMLElement`
- sans matrice
- responsable de normaliser les commandes et de resoudre les conflits same-tick

2. `move state`

- pure
- responsable du graphe logique parent/enfant
- responsable de l'ordre logique des enfants par container
- responsable des regles persistantes `first/last`
- responsable de la politique reorder

3. `move backend`

- specifique au moteur de rendu
- DOM aujourd'hui
- canvas demain
- responsable de traduire un delta logique en mutation de support et transitions visuelles

4. `move coordinator`

- point d'assemblage entre policy, state et backend
- appele par l'orchestrateur
- retourne le resultat final de move a injecter dans le routage runtime

## Frontiere cible exacte

`RuntimeComponentOrchestrator` devra conserver:

- la resolution de la cible component/update
- l'appel a `component.update(...)`
- l'injection des `animatableActions`
- l'assemblage du resultat de `routeUpdates(...)`
- l'appel au coordinator `move`

`RuntimeComponentOrchestrator` ne devra plus contenir:

- la normalisation de `move`
- la politique de conflit same-tick pour `move`
- l'etat logique parent/mounted pour `move`
- l'ordre logique des enfants
- le code DOM/FLIP/overlay-world
- les imports DOM lies a `move`

`ListRuntimeComponent` devra devenir une vue de container et ne plus contenir:

- la source de verite de l'ordre logique
- la policy reorder
- la semantique persistante `first/last`
- la decision metier de placement

## Fichiers a creer

Phase 0 a Phase 6 doivent converger vers les fichiers suivants:

- `src/runtime/move/types.ts`
- `src/runtime/move/normalize-move-command.ts`
- `src/runtime/move/resolve-move-decisions.ts`
- `src/runtime/move/runtime-container-state.ts`
- `src/runtime/move/move-coordinator.ts`
- `src/runtime/move/dom/dom-move-backend.ts`
- `src/runtime/move/dom/dom-layout-snapshot.ts`
- `src/runtime/move/dom/dom-flip-transition-builder.ts`
- `src/runtime/move/dom/dom-overlay-world-transition-builder.ts`
- `src/runtime/move/README.md`
- `tests/lot18/move-policy.spec.ts`
- `tests/lot18/runtime-container-state.spec.ts`
- `tests/lot18/dom-move-backend.spec.ts`
- `tests/lot18/move-demo-audit.spec.ts`

Fichiers a modifier:

- `src/runtime/components/runtime-component-orchestrator.ts`
- `src/runtime/components/list-runtime-component.ts`
- `src/runtime/components/types.ts`
- `src/runtime/types.ts`
- `src/demos/player-poc-demo.ts`
- `tests/lot18/move-phase-c.spec.ts`
- `tests/v1/mounted-stories-runtime.spec.ts`
- `tests/v1/runtime-registry-persistence.spec.ts`

Fichiers de support a envisager pour traces/baselines:

- `tests/fixtures/move-demo/move-audit-baseline.json`
- `tests/fixtures/move-demo/move-audit-overlay-world-baseline.json`

## Phase 0 - baseline et contrat

But:

- transformer le comportement actuel en contrat observable avant extraction

Travail:

- creer `src/runtime/move/types.ts`
- y definir `MoveAuditRecord`, `MoveDecision`, `MoveStateDelta`, `MoveBackendResult`
- creer `src/runtime/move/README.md`
- y ecrire le contrat `move` courant et l'architecture cible
- ajouter un hook d'audit non destructif dans `RuntimeComponentOrchestrator`
- logguer pour chaque move:
- `eventId`
- `eventSeq`
- `listenerId`
- `rawMove`
- `normalizedMove`
- `decisionApplied`
- `parentBefore`
- `parentAfter`
- `mountedBefore`
- `mountedAfter`
- `sourceChildrenBefore`
- `sourceChildrenAfter`
- `targetChildrenBefore`
- `targetChildrenAfter`
- `warningCodes`
- `flipMode`
- `overlayWorldUsed`
- `transitionIds`
- `transitionCount`
- pour DOM: `rectBefore`, `rectAfter`, `transformBefore`, `transformAfter`
- ajouter un mode debug minimal sur `src/demos/player-poc-demo.ts` pour exporter cet audit en JSON
- produire une baseline JSON a partir de la demo et la sauver sous `tests/fixtures/move-demo/`

Tests a ecrire ou etendre:

- etendre `tests/lot18/move-phase-c.spec.ts` pour verifier les deltas d'etat, pas seulement `parentListId`
- creer `tests/lot18/move-demo-audit.spec.ts` pour comparer une baseline d'audit JSON sur un scenario de demo determine

Critere de sortie:

- baseline JSON stable disponible
- aucun changement fonctionnel
- build vert
- `tests/lot18/move-phase-c.spec.ts` vert

## Phase 1 - extraction de la policy pure

But:

- sortir la normalisation et la resolution same-tick du coeur orchestrateur

Travail:

- creer `src/runtime/move/normalize-move-command.ts`
- y deplacer `normalizeMoveCommand(...)`
- creer `src/runtime/move/resolve-move-decisions.ts`
- y deplacer `resolveMoveDecisions(...)`
- conserver les memes warnings et la meme cle de conflit
- faire appeler ces modules par l'orchestrateur sans modifier le comportement observable

Tests a ecrire:

- `tests/lot18/move-policy.spec.ts`
- cas de normalisation valide
- cas de normalisation invalide
- same-tick last-write-wins
- invalid-last ignore
- absence de conflit si `persoId` differents

Critere de sortie:

- l'orchestrateur n'heberge plus la logique pure de normalisation/conflit
- les audits Phase 0 restent identiques

## Phase 2 - extraction de l'etat logique des containers

But:

- sortir du composant list et de l'orchestrateur la source de verite du graphe logique

Travail:

- creer `src/runtime/move/runtime-container-state.ts`
- y deplacer la gestion de:
- parent/enfant
- ordre logique
- modes persistants `first/last`
- policy reorder
- API minimale attendue:
- `registerContainer(containerId, config)`
- `registerDetachedItem(itemId)`
- `getParentId(itemId)`
- `isMounted(itemId)`
- `getChildrenIds(containerId)`
- `applyInitialMove(...)`
- `applyMove(...)`
- `applyMove(...)` doit retourner un `MoveStateDelta` avec:
- `operation`
- `persoId`
- `fromParentId`
- `toParentId`
- `mountedBefore`
- `mountedAfter`
- `sourceChildrenBefore`
- `sourceChildrenAfter`
- `targetChildrenBefore`
- `targetChildrenAfter`
- l'orchestrateur doit commencer a lire l'etat logique depuis ce module
- `ListRuntimeComponent` peut encore executer le rendu, mais n'est deja plus source de verite metier

Tests a ecrire:

- `tests/lot18/runtime-container-state.spec.ts`
- attach local
- transfert inter-lists
- detach target manquant
- reattach meme node logique
- `first/last` persistants
- `prepend/append/number`
- `auto` avec `reorderOnMove`, `reorderOnAdd`, `reorderOnRemove`

Critere de sortie:

- `orderedChildIds` du composant list n'est plus la source de verite metier
- l'audit de demo reste identique

## Phase 3 - reduction du composant list a un role de vue

But:

- faire du composant list un adaptateur de rendu, pas un porteur de semantique

Travail:

- modifier `src/runtime/components/types.ts`
- deprecer progressivement:
- `attachChild(...)`
- `detachChild(...)`
- `repositionChild(...)`
- `getChildrenSnapshot()`
- introduire une API plus neutre cote vue:
- `mountChildNode(childId, childNode)`
- `unmountChildNode(childId)`
- `syncChildOrder(childIds)`
- `measureChildLayout(childIds)` si necessaire pour le backend DOM
- modifier `src/runtime/components/list-runtime-component.ts`
- retirer:
- `orderedChildIds`
- `persistentPlacementByChildId`
- `nextPlacementOrder`
- `reorderConfig`
- `applyPlacementMode(...)`
- `rebuildOrderFromPersistentRules(...)`
- `resolveReorderConfig(...)`
- `shouldApplyReorder(...)`
- conserver uniquement:
- le conteneur DOM
- `childNodeById`
- l'application reelle d'un ordre fourni

Tests a ecrire ou adapter:

- adapter `tests/lot18/move-phase-c.spec.ts` pour verifier l'ordre logique via `runtime-container-state`
- ajouter des tests directs de `syncChildOrder(...)` cote list

Critere de sortie:

- le composant list ne contient plus de politique `move`
- toute regle de placement est hors du composant DOM

## Phase 4 - creation du backend DOM de move

But:

- sortir de l'orchestrateur toute execution visuelle backend-specifique

Travail:

- creer `src/runtime/move/dom/dom-move-backend.ts`
- y deplacer l'execution structurelle DOM de `applyMoveForPerso(...)`
- creer `src/runtime/move/dom/dom-layout-snapshot.ts`
- y deplacer snapshots box/rect/transform/matrix
- creer `src/runtime/move/dom/dom-flip-transition-builder.ts`
- y deplacer `collectFlipEntriesForMove(...)` et le pipeline FLIP local
- creer `src/runtime/move/dom/dom-overlay-world-transition-builder.ts`
- y deplacer `tryBuildOverlayWorldTransitions(...)` et `buildOverlayWorldTransitions(...)`
- deplacer aussi les helpers:
- `captureElementBoxSnapshot(...)`
- `captureCombinedMatrixForNode(...)`
- `computeOverlayWorldPhotosFromLocalFlip(...)`
- `createOverlayWorldPhotoClones(...)`
- `calibrateOverlayGhostToWorldSnapshot(...)`
- `cleanupOverlayRuntime(...)` si cette responsabilite reste propre au backend DOM
- l'orchestrateur ne doit plus connaitre `HTMLElement`, `document`, `getBoundingClientRect`, matrices, overlay layer

Tests a ecrire:

- `tests/lot18/dom-move-backend.spec.ts`
- local flip produit les transitions attendues
- overlay-world produit les transitions attendues
- fallback local si overlay impossible
- ids des transitions inchanges

Critere de sortie:

- toutes les references DOM liees a `move` sont sous `src/runtime/move/dom/`
- l'orchestrateur n'importe plus les details FLIP/DOM pour `move`

## Phase 5 - creation du move coordinator et remontage de l'orchestrateur

But:

- brancher policy + state + backend via une facade unique appelee par le routeur runtime

Travail:

- creer `src/runtime/move/move-coordinator.ts`
- API minimale attendue:
- `prepareInitialMoves(story)`
- `applyResolvedMove(updateContext)`
- `getStateSnapshot()`
- `applyResolvedMove(...)` doit recevoir:
- `resolvedAction`
- `eventSeq`
- `node registry`
- `component registry`
- `container registry`
- `applyResolvedMove(...)` doit retourner:
- `applied`
- `warnings`
- `stateDelta`
- `directTransitions`
- `auditRecord`
- modifier `RuntimeComponentOrchestrator.routeUpdates(...)`
- modifier `RuntimeComponentOrchestrator.loadStory(...)`
- remplacer les appels `move` directs par des appels au coordinator

Tests a ecrire ou adapter:

- `tests/lot18/move-phase-c.spec.ts`
- `tests/v1/runtime-registry-persistence.spec.ts`
- `tests/v1/mounted-stories-runtime.spec.ts`

Critere de sortie:

- l'orchestrateur redevient un routeur d'updates
- la logique `move` n'est plus inline dans `routeUpdates(...)`

## Phase 6 - nettoyage final et garde-fous d'architecture

But:

- verrouiller le decouplage et supprimer les restes de hack

Travail:

- supprimer `syncDomParentFallback(...)` du core si inutile
- si un fallback non-DOM reste necessaire, le ranger explicitement dans un backend dedie
- ajouter des gardes d'architecture minimales via tests ou checks simples:
- `runtime-component-orchestrator.ts` ne doit plus importer de helpers DOM pour `move`
- `runtime-component-orchestrator.ts` ne doit plus contenir `HTMLElement` ou `document` pour `move`
- `list-runtime-component.ts` ne doit plus contenir la logique de placement metier
- `move policy` et `runtime-container-state` doivent tourner avec fixtures non DOM

Tests a lancer:

- `npm run build`
- `npx vitest run tests/lot18/move-phase-c.spec.ts`
- `npx vitest run tests/lot18/move-policy.spec.ts`
- `npx vitest run tests/lot18/runtime-container-state.spec.ts`
- `npx vitest run tests/lot18/dom-move-backend.spec.ts`
- `npx vitest run tests/v1/runtime-registry-persistence.spec.ts`
- `npx vitest run tests/v1/mounted-stories-runtime.spec.ts`
- `npx vitest run tests/lot17/player-demo-poc.spec.ts`

Critere de sortie:

- build vert
- tests verts
- audit demo identique a la baseline
- controle visuel valide

## Controle visuel obligatoire

Le lot ne doit pas etre merge sans un controle visuel et/ou auditable de la demo.

Scenario de reference minimal a conserver:

- etat initial
- `demo:item-1:add`
- `demo:item-1:return-origin`
- `demo:item-3:add`
- `demo:item-3:to-first`
- `demo:item-3:return-origin`

Pour chaque etape, verifier:

- `parentListId`
- `mounted`
- ordre logique des listes impliquees
- ids des transitions
- `overlayWorldUsed`
- rects avant/apres sur l'item deplace
- absence de jump visuel avant animation
- meme position finale

Artifacts a conserver:

- JSON d'audit
- si possible capture video courte ou notes manuelles horodatees

## Ordre d'execution recommande

1. Phase 0 - baseline et contrat
2. Phase 1 - policy pure
3. Phase 2 - etat logique
4. Phase 3 - composant list vue seulement
5. Phase 4 - backend DOM
6. Phase 5 - coordinator
7. Phase 6 - nettoyage et gardes

## Interdits pendant ce lot

- ne pas faire de big bang
- ne pas basculer sur un nouveau chemin sans baseline comparable
- ne pas supprimer les warnings actuels
- ne pas reecrire simultanement la demo et le runtime
- ne pas changer la semantique de `mode` pendant l'extraction

## Definition of Done

- `RuntimeComponentOrchestrator` ne porte plus de code backend-specifique pour `move`
- `ListRuntimeComponent` ne porte plus de semantique metier de placement
- la policy `move` est pure et testee en isolation
- l'etat logique des containers est testable sans DOM
- le backend DOM concentre FLIP et overlay-world
- le scenario de demo de reference est equivalent en audit et en visuel
- le lot laisse une voie ouverte a un backend canvas sans retoucher policy ni state

## Notes implementation

- dependances amont: fin des slices 11 a 15
- pre-requis forts: baseline d'audit stable sur la demo
- non-objectifs: implementation immediate d'un backend canvas
- non-objectifs: changement de spec sur `move`

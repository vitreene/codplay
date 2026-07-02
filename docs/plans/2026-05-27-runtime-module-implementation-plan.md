# Runtime Module Implementation Plan

Date: 2026-05-27

## Objectif

Implementer plus tard le systeme de modules runtime a double accroche:

- accroche runtime app
- accroche composant

en prenant `move` comme premier cas de reference.

## Prealable

- finaliser l'ensemble des specs runtime/composants/services/modules
- ne pas implémenter avant stabilisation des contrats

## Audit des dependances actuelles de `move`

Dependances runtime directes reperees:

1. `src/runtime/components/runtime-component-orchestrator.ts`

- `normalizeMoveCommand(...)`
- `applyMoveForPerso(...)`
- lecture des registries runtime:
  - `nodeByPersoId`
  - `componentByPersoId`
  - `listByPersoId`
  - `parentListByPersoId`
  - `mountedByPersoId`
- orchestration de `move` dans `routeResolvedUpdate(...)`

2. `src/player/create-player-utils.ts`

- transport de `story.initial.move` dans `RuntimePersos.storyMovesByStoryId`

3. `src/runtime/types.ts`

- `MoveValue`
- `MoveCommand`
- `MoveFlipMode`

4. `src/runtime/config.ts`

- `move.rootToken`

5. `src/runtime/modules/list-flip/create-list-flip-module.ts`

- utilisation interne par l'orchestrateur pour la capture/commit avant-apres

6. `src/animation/types.ts`

- transport de payloads pouvant contenir `move`

## Conclusion d'audit

- aucune autre partie applicative de Codplay n'a besoin de logique `move` metier directe
- les autres references observees sont:
  - schemas auteur (`initial.move`, `action.move`)
  - demos/scenes de test
  - specs et tests de validation
- la facade player publique, le telco local, le registry et le builder ne portent pas de logique `move` d'execution

## Plan d'implementation

### Phase 1 - Introduire les types modules

- creer les types communs de module runtime
- definir:
  - `RuntimeModuleHost`
  - `RuntimeModuleBinding`
  - `RuntimeModule`
- definir la structure d'injection composant `runtime`

### Phase 2 - Etendre le registry

- ajouter un registry runtime effectif pour `module.register/override`
- garantir la meme politique que la spec:
  - collision `register` => erreur
  - `override` sur absent => erreur
- conserver la separation avec `component` et `service`

### Phase 3 - Installer les modules au boot runtime

- centraliser l'installation des modules avant chargement effectif des composants
- construire:
  - la face `runtime` pour l'orchestrateur / coordinators
  - la face `component` pour l'injection dans les composants
- introduire un dispatcher runtime generique pour diffuser les phases aux modules installes

### Phase 4 - Extraire `move` en module

- sortir de `RuntimeComponentOrchestrator`:
  - `normalizeMoveCommand(...)`
  - `applyMoveForPerso(...)`
  - la resolution des moves initiaux et resolus
- produire un module/coordinator `move`
- connecter ce module via la face `runtime`

### Phase 5 - Raccorder la face composant de `move`

- definir la capability minimale locale necessaire aux composants `list`
- injecter cette capability dans `RuntimeComponentClassInput.runtime.move`
- verifier que les composants non-list n'ont pas besoin d'API `move` supplementaire

### Phase 6 - Clarifier `flip`

- maintenir `flip` hors contrat composant
- laisser `flip` comme detail d'orchestration interne du module `move`
- verifier que rien ne fuit dans l'API composant

### Phase 7 - Adapter l'orchestrateur

- remplacer les appels inline `move` par diffusion de phases via le dispatcher de modules
- conserver l'orchestrateur comme routeur d'updates
- reduire son role a:
  - preparer les phases et payloads
  - appeler le dispatcher runtime generique
  - router le patch composant restant

### Phase 8 - Tests

- adapter les tests `lot18` move
- verifier `runtime-registry-persistence`
- verifier `mounted-stories-runtime`
- verifier build et demos impactees

## Point d'attention

- ne pas exposer `flip` aux composants
- ne pas transformer `move` en simple service local
- ne pas faire declarer un module depuis un composant
- conserver `story.initial.move` comme simple donnees auteur transportees jusqu'au runtime

# V1 - plan final d'integration (execution immediate)

## Statut

Version finale pre-integration.

Ce document est suffisant pour demarrer l'integration V1 sans autre formalisation.

## Decision fermees

1. Pas de reecriture globale.
2. Appui sur le noyau existant (`player`, `director`, `renderer`, runtime FLIP/list).
3. Evolution par vertical slices, avec validation automatique + validation visuelle.
4. Demo POC FLIP/list protegee comme reference de non regression.
5. Layout demos impose: `main` = player, `aside` = controles + logs.

## Perimetre protege (obligatoire)

Fichiers sensibles:

- `src/demos/player-poc-demo.ts`
- `src/demos/player-poc-demo.css`
- `src/main.ts`
- `src/runtime/components/runtime-component-orchestrator.ts`
- `src/runtime/components/list-runtime-component.ts`
- `src/runtime/flip-engine/create-flip-engine.ts`
- `src/runtime/list-plugin/run-list-plugin.ts`

Regle:

- toute modification dans ce perimetre doit etre annoncee dans le message de slice
- toute modification dans ce perimetre impose les gates FLIP/list completes avant validation

## Gates de non regression (obligatoires)

Commandes a lancer pour chaque slice qui touche `src/player`, `src/director`, `src/renderer`, `src/runtime`, `src/demos`:

1. `npm run test:gates`

Validation visuelle obligatoire:

1. `npm run dev:demo`
2. verifier la demo POC:
   - add/reorder/remove de la list
   - transitions `flipMode: overlay-world`
   - layout invariant (`aside` controles/logs, `main` player)

## Ecarts code -> V1 a fermer

1. facade Builder V1 absente (`compile`, `validate`, `export`)
2. contrat `CompiledScene` V1 non frontiere par defaut
3. facade Player non alignee completement (`init` V1, `schedule`, `onChange`, `stop`, `resume`)
4. runtime policy V1 partielle (same tick, straps, observabilite)
5. `TrackManager` V1 non isole comme module explicite
6. structure scene/story a aligner sur `rootStories` + `entries`
7. bootstrap scene + demarrage par event a fermer proprement

## Arborescence cible a introduire

Nouveaux emplacements de code:

- `src/builder/types.ts`
- `src/builder/create-builder.ts`
- `src/track-manager/types.ts`
- `src/track-manager/create-track-manager.ts`
- `src/demos/scenes/s1-canari-scene.ts`
- `src/demos/scenes/s2-reference-scene.ts`
- `src/demos/scenes/s3-robustesse-scene.ts`

Nouveaux emplacements de tests:

- `tests/v1/builder-api.spec.ts`
- `tests/v1/player-api-v1-adapter.spec.ts`
- `tests/v1/track-manager.spec.ts`
- `tests/v1/runtime-policy.spec.ts`
- `tests/v1/reference-scenes.spec.ts`

## Contrats V1 a respecter des la premiere integration

### Builder

- `compile(input)` retourne `compiledScene` + `resourceManifest` + diagnostics
- `validate(input)` retourne `{ ok, errors, warnings }`
- `export(input)` present, peut etre minimal en V1

### CompiledScene

Champs obligatoires:

- `schemaVersion`
- `createdAt`
- `scene`
- `resources`

Contraintes structurelles minimales:

- `scene.rootStories`
- `scene.stories[*].entries`

### Player

Facade cible exposee:

- `init({ mountTarget, compiledScene, resourceManifest? })`
- `play`, `pause`, `resume`, `stop`, `destroy`, `seek`, `emit`
- `getState`, `onChange`, `onTrace`
- `schedule`

Note d'integration:

- implementation par adaptateur au-dessus du `PlayerFacade` existant
- pas de rupture immediate des chemins internes qui alimentent la demo POC
- `mount` reste une operation technique runtime
- le demarrage logique passe par le pipeline d'events et `Scene.listen`

## Sequence d'execution obligatoire

## Phase 0 - bootstrap de securite (a faire en premier)

### Actions

1. Ajouter le lanceur commun `scripts/run-tests.mjs` et `npm run test:gates`.
2. Creer `src/demos/scenes/` avec S1/S2/S3.
3. Creer `tests/v1/reference-scenes.spec.ts` pour verifier chargement minimal des scenes.

### Commandes de sortie

1. `npm run test:gates`
2. `npm run test`

### Critere de sortie

- les 4 commandes passent
- les scenes S1/S2/S3 sont versionnees

## Phase 1 - Slice 0 (walking skeleton V1)

### Actions

1. Ajouter `src/builder/types.ts` avec les types V1 minimaux.
2. Ajouter `src/builder/create-builder.ts` avec `compile` et `validate` minimaux.
3. Introduire un adaptateur Player V1 dans `src/player/` sans casser `runPlayerPocDemo`.
4. Connecter S1-canari au flux `compiledScene -> player`.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/builder-api.spec.ts`
3. `npx vitest run tests/v1/player-api-v1-adapter.spec.ts`

### Critere de sortie

- S1 compile puis s'affiche via le chemin V1
- demo POC inchangee fonctionnellement

## Phase 2 - Slice 1 (Scene/Story structure V1)

### Actions

1. Aligner structure `Scene`/`Story` V1 dans builder + adaptateur runtime.
2. Valider `rootStories`, `entries` et references de base.
3. Garantir `rootStories`, `entries`, `listen`, `tracks` dans l'artefact compile.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/builder-api.spec.ts`
3. `npx vitest run tests/v1/reference-scenes.spec.ts`

### Critere de sortie

- S1 et S2 passent sur format V1

## Phase 3 - Slice 2 (orchestration events + policy same tick)

### Actions

1. Verrouiller pipeline `listen -> transform -> straps -> emit -> persos`.
2. Implementer `sameTickHandling` avec default `keep-all`.
3. Ajouter trace policy (`eventId`, `eventSeq`, `decision`, `code`).
4. Brancher les demarrages de sequence sur `Scene.listen` sans second cadre d'orchestration.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/runtime-policy.spec.ts`

### Critere de sortie

- ordre deterministe confirme sur S1/S2

## Phase 4 - Slice 3 (strap helpers + schedule)

### Actions

1. Exposer `schedule` sur facade Player V1.
2. Raccorder `schedule` au lifecycle player (`play/pause/resume/stop/destroy`).
3. Verifier comportement strap en mode warning par defaut.
4. Brancher le bootstrap scene via strap d'entree et montage technique des stories.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/player-api-v1-adapter.spec.ts`
3. `npx vitest run tests/v1/runtime-policy.spec.ts`

### Critere de sortie

- S2 fonctionne avec `schedule` et straps

## Phase 5 - Slice 4 (scene side effects)

### Actions

1. Integrer facade side effects scene selon spec.
2. Isoler erreurs side effects sans corruption timeline.
3. Tracer warnings/erreurs selon catalogue.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/runtime-policy.spec.ts`
3. `npx vitest run tests/v1/reference-scenes.spec.ts`

### Critere de sortie

- S2 et S3 passent avec traces explicites

## Phase 6 - Slice 5 (track manager + preload)

### Actions

1. Ajouter `src/track-manager/types.ts`.
2. Ajouter `src/track-manager/create-track-manager.ts`.
3. Brancher player/director vers ce module.
4. Integrer preload minimal et erreurs associees.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/track-manager.spec.ts`
3. `npx vitest run tests/v1/reference-scenes.spec.ts`

### Critere de sortie

- S2 et S3 valident execution temporelle V1

## Phase 7 - Slice 6 (validation + error catalog)

### Actions

1. Couvrir checks de `v1-validation.md`.
2. Aligner codes/messages sur `v1-error-catalog.md`.
3. Stabiliser ordre diagnostics a entree identique.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/builder-api.spec.ts`
3. `npx vitest run tests/v1/runtime-policy.spec.ts`

### Critere de sortie

- validation compile/runtime conforme et stable

## Phase 8 - Slice 7 (integration perso)

### Actions

1. Aligner registry composants avec `v1-perso-spec.md`.
2. Valider au moins un perso custom sur S2.
3. Verifier impact S3 si le perso touche runtime.

### Commandes de sortie

1. `npm run test:gates`
2. `npx vitest run tests/v1/reference-scenes.spec.ts`
3. `npm run test`

### Critere de sortie

- perso custom operationnel sans regression POC

## Regle de passage entre phases

Une phase ne peut pas commencer si la phase precedente n'a pas tous ses criteres de sortie valides.

## Definition of Ready (obligatoire)

Avant chaque phase:

1. objectifs ecrits (3-5 points max)
2. fichiers modifies listes
3. verification explicite: perimetre protege touche ou non
4. commandes de sortie preparees

## Definition of Done (obligatoire)

Pour fermer une phase:

1. code + tests de phase OK
2. gates FLIP/list OK
3. validation visuelle POC OK
4. layout demos invariant respecte
5. aucun ecart bloquant ouvert

## Livrable final attendu (fin de Phase 8)

1. flux V1 complet: `authoring -> builder -> compiledScene -> player -> rendu`
2. facade Builder V1 exploitable
3. facade Player V1 exploitable
4. `TrackManager` V1 integre
5. scenes S1/S2/S3 vertes
6. demo POC FLIP/list intacte (fonction + layout)

## Commande de verification finale

1. `npm run test:gates`
2. `npm run test`
3. `npm run build`
4. `npm run dev:demo` puis verification manuelle POC

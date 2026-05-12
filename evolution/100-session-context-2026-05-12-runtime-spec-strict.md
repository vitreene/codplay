# Session context - 2026-05-12 - migration runtime stricte spec

## Objectif de la session

Construire la librairie en suivant strictement les specs `formalisation/` sans ecart, en particulier:

- vocabulaire metier: `perso` (pas `item`)
- suppression de `initialStoryId` du contrat cible
- lifecycle scene explicite avec `init` + `onStart`
- integrite FLIP maintenue par resultat (pas obligation de garder l'implementation identique)

## Decisions validees avec le user

1. `init(scene, options)`:
   - synchrone
   - sans valeur de retour
   - utilise `options.mount(story | storyId)`
2. `play()`:
   - commence par executer `onStart(scene, options)`
   - `onStart` declenche les premiers `start`
   - debut de l'inscription des events dans `TrackManager`
3. `options.start(...)`:
   - signature proche de `mount`
   - accepte `story` ou `storyId`
   - synchrone
   - pas un event emitter public
4. Si `onStart` est absent: pas de demarrage automatique.
5. `start` est idempotent par story sur un cycle de lecture (`init -> ... -> stop/destroy`).
6. `onResume` n'est pas implemente maintenant; a ajouter plus tard si besoin.
7. Format interne `stories`: `object` possible (pas de conversion `map -> json -> map` inutile).

## Etat code au moment de la pause

### Avancee deja presente (mais partiellement a corriger)

- Ajout d'un builder minimal:
  - `src/builder/types.ts`
  - `src/builder/create-builder.ts`
- Ajout de scenes de reference:
  - `src/demos/scenes/s1-canari-scene.ts`
  - `src/demos/scenes/s2-reference-scene.ts`
  - `src/demos/scenes/s3-robustesse-scene.ts`
  - `src/demos/scenes/index.ts`
- Ajout de tests:
  - `tests/v1/reference-scenes.spec.ts`
  - `tests/v1/builder-api.spec.ts`
  - `tests/v1/player-api-v1-adapter.spec.ts`
- Ajout du lanceur:
  - `scripts/run-tests.mjs`

### Ecarts identifies par rapport a la mission stricte

- Couche adaptateur jugee inutile:
  - `src/player/create-player-v1-adapter.ts`
- Scenes de reference encore en `items` + `initialStoryId`:
  - `src/demos/scenes/s1-canari-scene.ts`
  - `src/demos/scenes/s2-reference-scene.ts`
  - `src/demos/scenes/s3-robustesse-scene.ts`
- Clonage manuel fragile dans le builder (`cloneSceneDef`, etc.) a remplacer par une approche plus robuste (`structuredClone` quand necessaire).
- Le coeur runtime actuel repose encore sur des contrats legacy (`items`, resolution via `initialStoryId`).

## Statut git courant

`git status --short`:

- `M evolution/17-guide-reconstruction-v1.md`
- `M formalisation/v1-construction-strategy-slices-scenes.md`
- `M package.json`
- `?? scripts/`
- `?? src/builder/`
- `?? src/demos/scenes/`
- `?? src/player/create-player-v1-adapter.ts`
- `?? tests/v1/`

## Prochain plan d'execution (ordre strict)

1. Retirer les couches hors mission:
   - supprimer `src/player/create-player-v1-adapter.ts`
   - supprimer `tests/v1/player-api-v1-adapter.spec.ts`
2. Aligner les types runtime/player sur la spec:
   - `rootStories`, `entries`, `persos`
   - suppression de `initialStoryId`
   - ajout des hooks `init(scene, options)` et `onStart(scene, options)`
3. Introduire `TrackManager`:
   - `src/track-manager/types.ts`
   - `src/track-manager/create-track-manager.ts`
   - branchement player pour `start` idempotent + `appendAnchoredEventimes`
4. Migrer les scenes de demo en contrat strict spec.
5. Mettre a jour les tests pour le nouveau lifecycle.
6. Verifier non regression:
   - `npm run test:gates`
   - `npm run test`
   - `npm run build`

## Notes de reprise importantes

- Ne pas maintenir le legacy pour lui-meme.
- Toute initiative hors mission doit etre signalee explicitement au user.
- Eviter les noms de fichiers contenant `v1` sauf transitoire court.
- FLIP/list: conserver exactement le meme resultat observable.

# Lot 03 - Bridge animation (animejs minimal)

## Objectif

Connecter le pipeline d'actions resolues a un adaptateur animation mockable.

## Fonctions noyau

- `createAnimationAdapter(animeImpl)`
  - `run(batch)`
  - `stop(target?)`
- `deriveSimpleTransitions(resolvedActions): TransitionRequest[]`
- `runAnimationBatch(transitions, adapter)`

Perimetre transition simple:

- `opacity`, `x`, `y`, `scale`, `rotate`

## Scenarios de test (DoD)

- `L3-T1` un event => une transition adapter.run
- `L3-T2` style incomplet => ignore proprement
- `L3-T3` batch vide => no-op
- `L3-T4` trace minimale event -> transition

## Critere de passage

- 4 tests verts
- tests executes avec adapter mock (sans animejs reel)

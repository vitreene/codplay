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

Note historique:

- cette limite etait valide uniquement pour le lot 03
- elle est levee au lot 05 (pipeline agnostique des proprietes)

## Scenarios de test (DoD)

- `L3-T1` un event => une transition adapter.run
- `L3-T2` style incomplet => ignore proprement
- `L3-T3` batch vide => no-op
- `L3-T4` trace minimale event -> transition
- `L3-T5` interpolation verifiee en cours d'animation (progression intermediaire)

## Critere de passage

- 5 tests verts
- tests executes avec adapter mock (sans animejs reel)

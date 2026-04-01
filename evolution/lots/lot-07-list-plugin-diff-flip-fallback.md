# Lot 07 - plugin list complet (`diff + FLIP + fallback perf`)

## Objectif

Completer le plugin `list` avec un pipeline testable:

- calcul `diff` (`added/removed/moved`)
- derivation FLIP pour les deplacements
- fallback performance qui coupe les `move` en surcharge

## Fonctions noyau

- `computeListDiff(prevChildrenIds, nextChildrenIds)`
  - detecte `added`, `removed`, `moved`
- `runListPlugin(input)`
  - enchaine `diff -> transitions -> commitPlan -> trace`
  - derive transitions `enter/leave/move:flip`
  - applique fallback perf sur les `move`
- `createListPlugin(options)`
  - instancie un plugin `list-plugin` attache a un runtime list

## Contrat runtime

- ordre de diff stable en suivant les listes d'entree
- FLIP:
  - snapshots `positionsBefore` / `positionsAfter`
  - deltas `x/y` animes vers `0`
- fallback perf:
  - si `moved.length > maxMoveAnimations`, transitions `move` ignorees
  - transitions `add/remove` conservees
  - trace `list:perf:fallback` emise
- `createElement` instancie le plugin pour tout item `type='list'`

## Scenarios de test (DoD)

- `L7-T1` diff correct (`added/removed/moved`)
- `L7-T2` transitions FLIP derivees depuis snapshots before/after
- `L7-T3` fallback perf degrade les `move` seulement
- `L7-T4` plugin list instancie dans `createElement`
- `L7-T5` commit plan de suppression (`leaving`, `detachAfterAnimation`)

## Critere de passage

- 5 tests verts (`tests/lot7`)
- aucun impact regressif sur lots 1 a 6

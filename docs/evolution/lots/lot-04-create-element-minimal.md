# Lot 04 - createElement minimal + animation simple

## Objectif

Valider le systeme minimum en bout de chaine: event -> action -> node -> animation.

## Fonctions noyau

- `createElement(itemDoc, ctx)`
  - phase 1: `text`, `img`, `list` minimal
  - retour `{ runtimeItemId, nodeRef, plugins? }`
- `mountSceneElements(storyDoc)`
- `applyResolvedActions(resolvedActions)`
  - patch style/class/attr minimal
  - declenche `runAnimationBatch`

## Scenario integrateur (DoD)

- `L4-T1` end-to-end minimal
  - Given item texte `opacity:0`
  - When event `intro`
  - Then node cree
  - Then transition `opacity 0 -> 1` envoyee a l'adapter
  - Then commit final applique

## Critere de passage

- test integrateur vert
- demo locale: 1 event anime 1 element

# Lot 05 - animation properties extensibility

## Objectif

Supprimer toute allowlist de proprietes animees pour un pipeline agnostique.

## Fonctions noyau

- `deriveSimpleTransitions(resolvedActions)`
  - derive une transition pour chaque propriete `style.*` valide
  - aucune liste de proprietes predefinie
- `applyResolvedActions(resolvedActions, runtimeElements, animationAdapter)`
  - applique les patchs HTML-like via `target.style` quand present
  - applique les patchs directement sur l'objet cible sinon

## Scenarios de test (DoD)

- `L5-T1` derivation agnostique de proprietes arbitraires (`opacity`, `width`, `progress`, ...)
- `L5-T2` avec `applyResolvedActions`, une propriete HTML-like est transmise a l'adapter
- `L5-T3` avec `applyResolvedActions`, un objet third-party non-HTML est anime de la meme facon

## Critere de passage

- 3 tests verts (`tests/lot5`)
- aucun impact regressif sur lots 1 a 4

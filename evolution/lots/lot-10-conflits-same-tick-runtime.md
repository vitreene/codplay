# Lot 10 - conflits same-tick runtime

## Objectif

Appliquer de facon effective les regles de resolution des conflits quand plusieurs actions visent la meme cible au meme tick.

## Fonctions noyau

- `resolveHtmlRenderMutations(actions)`
  - detecte les conflits `style`, `attr`, `className` par cible
  - conserve le dernier gagnant selon l'ordre d'execution
  - supprime les mutations perdantes avant application runtime
  - produit des traces `applied/rejected` avec reason + `winnerEventId/loserEventId`
- `applyResolvedActions(...)`
  - execute d'abord `resolveHtmlRenderMutations`
  - applique uniquement les mutations gagnantes
  - expose `conflictTrace` dans le resultat

## Contrat runtime

- `style`: merge par propriete, dernier gagnant sur une meme propriete
- `attr`: merge par cle, dernier gagnant sur une meme cle
- `className` (patch `{ add/remove }`): dernier gagnant par token
- isolation par cible: meme propriete sur deux `targetId` differents ne cree pas de conflit
- sortie trace minimale en cas de conflit:
  - une ligne `rejected` pour chaque perdant
  - une ligne `applied` pour le gagnant final

## Scenarios de test (DoD)

- `L10-T1` conflit `style` sur meme cle -> dernier gagnant + trace override
- `L10-T2` `style` sans overlap de cle -> co-application sans conflit
- `L10-T3` conflit `attr` sur meme cle -> dernier gagnant + trace override
- `L10-T4` conflit `className` add/remove sur meme token -> dernier gagnant
- `L10-T5` meme cle sur cibles differentes -> aucun conflit
- `L10-T6` action `move` seule conservee (pas supprimee par resolution des conflits)

## Critere de passage

- 6 tests verts (`tests/lot10`)
- non-regression lots 1 a 9

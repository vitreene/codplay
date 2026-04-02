# Lot 14 - telco locale composant

## Objectif

Ajouter une telecommande locale (meme page que le player) pour piloter le `createPlayer` sans transport reseau.

## Fonctions noyau

- `createLocalTelco({ player, options? })`
  - `dispatch(command)`
  - `getState()`
  - `onCommandResult(listener)`
  - `onStateChange(listener)`
- `createLocalTelcoPanel({ telco, mountTarget, title? })`
  - composant DOM local avec boutons (`play`, `pause`, `seek`, `rewind`, `rebuild`, `destroy`)
  - affichage etat player + journal des commandes

## Contrat runtime

- aucune dependance websocket (v2)
- protocol local avec `requestId` deterministe (`telco-request-*`)
- validation payload locale avant appel player (`INVALID_TELCO_COMMAND_PAYLOAD`)
- diffusion des resultats commande (`ok/rejected`) aux subscribers
- diffusion des changements etat player aux subscribers telco

## Scenarios de test (DoD)

- `L14-T1` dispatch commandes + requestId deterministes
- `L14-T2` mirroring des changements d'etat player
- `L14-T3` rejet payload invalide (seek)
- `L14-T4` flux resultats commande applique/rejete

## Critere de passage

- 4 tests verts (`tests/lot14`)
- non-regression lots 1 a 13

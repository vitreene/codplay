# Lot 16 - player playback timeline minimal

## Objectif

Permettre un playback timeline minimal dans `createPlayer` pour le run manuel du cas Eddy: lecture des events convertis, dispatch actions, application runtime + animation.

## Fonctions noyau

- `createPlayer(...)`
  - planifie les events timeline au `play`
  - execute pipeline `dispatch -> applyResolvedActions`
  - annule les timers pending au `pause/destroy`
  - conserve un curseur timeline pour `seek/rewind`

## Contrat runtime

- source events: `scene.tracks[*].events` (fallback `story.events`)
- tri deterministe applique avant planification
- `pause` annule les events futurs non encore joues
- `play` depuis `paused` reprend a partir du curseur courant

## Scenarios de test (DoD)

- `L16-T1` lecture timeline applique les actions attendues
- `L16-T2` pause stoppe les events futurs

## Critere de passage

- 2 tests verts (`tests/lot16`)
- non-regression lots 1 a 15

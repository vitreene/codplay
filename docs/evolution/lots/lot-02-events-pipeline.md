# Lot 02 - Events pipeline (map + transmission)

## Objectif

Passer d'un flux d'events temporels a des actions resolues deterministes.

## Fonctions noyau

- `flattenEventNodes(eventNodes): TimelineEvent[]`
- `sortRuntimeEvents(events, trackMeta): TimelineEvent[]`
- `collectEventsWindow(events, prevMs, nowMs, marginMs): TimelineEvent[]`
- `dispatchEvents(events, ctx): ResolvedAction[]`

Regles cle:

- matching exact `event.name === actionKey`
- tri: `ms`, `track.order`, `index`, `source=user` apres autres a egalite

## Scenarios de test (DoD)

- `L2-T1` flatten parent/enfant (`finalMs = parent + child`)
- `L2-T2` tri deterministe
- `L2-T3` fenetre `(prevMs, nowMs + margin]`
- `L2-T4` matching exact, pas de wildcard
- `L2-T5` ordre de declaration des cibles

## Critere de passage

- 5 tests verts
- sortie `ResolvedAction[]` identique sur 3 runs

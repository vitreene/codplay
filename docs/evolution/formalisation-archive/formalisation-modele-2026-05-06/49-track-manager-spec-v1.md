# Track manager spec V1 - execution temporelle

## Statut

Spec normative V1 pour le module `TrackManager` dans le Player.

## Objectif

Executer les tracks en temps runtime, declencher les events dus, et appliquer les regles d'activation/deactivation de tracks.

## Role

- lire les tracks ordonnees
- collecter les events dus a `nowMs`
- retourner un flux stable d'events vers le Director
- appliquer `tracks:set`
- accepter des events live append-only

## Contrat minimal V1

```ts
type TrackEventRef = {
  eventOffset: number
  trackId: string
  index?: number
  source?: string
}

type TrackManagerApi = {
  load: (input: {
    tracks: Record<string, unknown>
    options?: { emitRefs?: boolean }
  }) => ApiResult<void>
  setActiveTracks: (input: { activate?: string[]; deactivate?: string[]; reason?: string }) => ApiResult<void>
  appendLiveEvents: (input: { trackId: string; events: StoryEvent[] }) => ApiResult<void>
  collectDueEvents: (input: { nowMs: number }) => {
    events: StoryEvent[]
    refs?: TrackEventRef[]
  }
  state: {
    activeTrackIds: string[]
    loadedTrackIds: string[]
  }
}
```

## Regles V1

- un track est l'unite minimale pilotable.
- `tracks` est obligatoire en diffusion, valeur vide autorisee.
- desactivation = effet immediat pour events futurs.
- reactivation sans rattrapage retroactif.
- events live = append-only.
- `appendLiveEvents` cible un seul track par appel.
- `setActiveTracks` conserve un mode simple `activate/deactivate` en V1.
- `collectDueEvents` peut retourner des references de provenance (`refs`) pour debug/telemetrie.
- `refs` est desactivable (`emitRefs=false`) pour les contextes de diffusion sensibles a la performance.
- ordre deterministe: `applyAtMs`, puis ordre stable.

## Notes

- le TrackManager ne fait ni rendu, ni logique metier story.

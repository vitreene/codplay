# Track manager spec V1 - execution temporelle

## Statut

Spec normative V1 pour le module `TrackManager` dans le Player.

## Objectif

Executer les tracks en temps runtime, declencher les events dus, et appliquer les regles d'activation/deactivation de tracks.

## Role

- lire les tracks ordonnees
- collecter les events dus a `nowMs`
- retourner un flux stable d'events vers le Director
- charger une fois le registre fige des tracks a `scene.init`
- accepter des events live append-only
- accepter des eventimes ancres au runtime lorsqu'une story demarre via le pipeline scene/story
- consommer un registre de tracks consolide a partir de `Scene.tracks` et des declarations statiques des stories

## Contrat minimal V1

```ts
type TrackEventRef = {
  eventOffset: number
  trackId: string
  index?: number
  source?: string
}

type StoryEventimeNode = {
  name: string
  startAt: number
  data?: Record<string, unknown>
  events?: StoryEventimeNode[]
}

type TrackManagerApi = {
  load: (input: {
    tracks: Record<string, unknown>
    options?: { emitRefs?: boolean }
  }) => ApiResult<void>
  setActiveTracks: (input: { activate?: string[]; deactivate?: string[]; reason?: string }) => ApiResult<void>
  appendLiveEvents: (input: { trackId: string; events: StoryEvent[] }) => ApiResult<void>
  appendAnchoredEventimes: (input: {
    trackId: string
    anchorMs: number
    storyId: string
    eventimes: Array<{
      name: string
      startAt: number
      data?: Record<string, unknown>
      events?: StoryEventimeNode[]
    }>
  }) => ApiResult<{ appendedCount: number }>
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
- le `TrackManager` ne prescrit pas l'organisation auteur des tracks; il consomme le registre fige fourni a `scene.init`.
- ce registre contient toujours un track `global`.
- par defaut, chaque story dispose aussi d'un track `story.id`.
- aucune creation ni suppression de track n'est autorisee apres `scene.init`.
- l'etat initial auteur pertinent d'un track est `active`.
- l'activation et la desactivation runtime s'appliquent uniquement a des tracks deja existants.
- desactivation = effet immediat pour events futurs.
- reactivation sans rattrapage retroactif.
- events live = append-only.
- `appendLiveEvents` cible un seul track par appel.
- `appendAnchoredEventimes` convertit des eventimes relatifs de story en events absolus append-only.
- `appendAnchoredEventimes` applique l'ancrage: `applyAtMs = anchorMs + somme des startAt`.
- l'ordre d'aplatissement des eventimes est l'ordre de declaration parent puis enfants d'eventimes.
- `appendAnchoredEventimes` est utilise quand une story demarre sur trigger runtime (ex: event de sequence ou interaction).
- le montage d'une story n'entraine pas a lui seul d'inscription temporelle dans le `TrackManager`.
- il n'existe pas de deuxieme cadre temporel pour les demarrages: le `TrackManager` reutilise le mecanisme existant d'ancrage des `eventimes`.
- `setActiveTracks` conserve un mode simple `activate/deactivate` en V1.
- le `TrackManager` est pilote pendant la lecture par des events de controle scene-level (`track:activate`, `track:deactivate`, `track:toggle`).
- la forme canonique de ces events de controle est `name + data`.
- le payload minimal de controle est `{ trackIds: string[] }`.
- si un event de controle reference un track inconnu, ce track est ignore et un warning runtime est emis.
- `collectDueEvents` peut retourner des references de provenance (`refs`) pour debug/telemetrie.
- `refs` est desactivable (`emitRefs=false`) pour les contextes de diffusion sensibles a la performance.
- ordre deterministe: `applyAtMs`, puis ordre stable.

## Eventimes portables

- la source metier des eventimes est `Story.eventimes`.
- `Scene.tracks` orchestre l'activation et l'ancrage, sans dupliquer le contenu eventime de story.
- un meme bloc `Story.eventimes` peut etre reimporte dans plusieurs scenes sans reecriture.
- toute resolution de demarrage compatible `seek/rewind` se traduit par des inscriptions dans ce meme systeme temporel.
- si aucun track explicite n'est fourni pour un event de story, le fallback est le track `story.id` de la story emettrice.

## Notes

- le `TrackManager` ne fait ni rendu, ni logique metier story.
- l'API auteur de creation/gestion des tracks appartient aux specs d'authoring et reste decouplee de ce module runtime.
- les metadata runtime comme l'ordre interne ou la source interne ne font pas partie du contrat auteur minimal des tracks.

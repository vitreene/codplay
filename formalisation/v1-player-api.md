# Player API V1 - facade de lecture

## Statut

Spec normative V1 pour la facade `Player` exposee a l'application hote.

## Objectif

Piloter la lecture d'une sequence compilee, injecter des events, observer l'etat, et utiliser le scheduler public.

## API minimale V1

```ts
type PlayerApi = {
  init: (input: {
    mountTarget: unknown
    compiledScene: CompiledScene
    resourceManifest?: ResourceManifest
    runtimePolicy?: {
      masterClock?: {
        unique?: boolean
        previousMasterAction?: "pause" | "stop"
        fallbackToTicker?: boolean
      }
    }
  }) => Promise<ApiResult<void>>

  play: () => Promise<ApiResult<void>>
  pause: () => Promise<ApiResult<void>>
  resume: () => Promise<ApiResult<void>>
  stop: () => Promise<ApiResult<void>>
  destroy: () => Promise<ApiResult<void>>
  seek: (input: { timelineMs: number }) => Promise<ApiResult<void>>
  emit: (input: StoryEvent) => Promise<ApiResult<void>>

  getState: () => PlayerStateSnapshot
  onChange: (listener: (state: PlayerStateSnapshot) => void) => () => void
  onTrace: (listener: (row: RuntimeTraceRow) => void) => () => void

  schedule: StrapHelpers
}
```

Etat minimal complet:

```ts
type PlayerStateSnapshot = {
  status: "idle" | "ready" | "playing" | "paused" | "seeking" | "error"
  timelineMs: number
  horizon: HorizonSnapshot
  clockSource: "ticker" | "master"
  activeMasterPersoId?: string
}
```

## Regles V1

- `mountTarget` est fourni au `Player` et reste hors `Scene`.
- `init(...)` est le point d'entree de chargement runtime.
- `init(...)` couvre une lecture normale complete: chargement, preload, instanciation runtime puis bootstrap scene.
- `init(...)` initialise le runtime global de scene, y compris les stories non encore visibles dans le DOM.
- `init(...)` n'a vocation a etre execute qu'une seule fois par lecture normale.
- `seek` n'entraine pas de nouvel appel a `init`.
- `schedule` est destructurable et aliasable par import direct.
- `schedule` utilise le meme scheduler runtime que les straps.
- l'execution de `schedule` suit le lifecycle `play/pause/resume/stop`; `destroy` reste une commande technique hors flux de lecture normal souhaite.
- toutes les emissions runtime passent par policies actives.
- si un master est actif, `timelineMs` suit le temps de ce master.
- si aucun master actif n'est disponible, `timelineMs` suit le ticker standard.
- `getState().horizon` expose les bornes de progress, projection, seek et segment.
- `seekEndMs` n'est pas necessairement egal a `progressEndMs`.
- reference seek: `v1-seek-spec.md`.
- `getState()` reste un etat technique du player et n'expose pas de donnees story-specific.
- les operations de placement des stories et des persos restent des operations techniques runtime, hors facade publique minimale V1.
- les elements peuvent entrer et sortir du DOM pendant la sequence sans etre purges du runtime.
- les events de sequence utilisent les conventions de nommage existantes; la facade Player n'en fige aucun en dur.
- `stop()` termine le flux normal de lecture; `destroy()` n'est pas une commande souhaitee pour le cycle normal et reste reservee aux cas techniques hote.
- l'enregistrement des composants, services et modules runtime releve du registry `codplay`, pas de la facade publique minimale `Player`.
- reference registry: `v1-registry-api.md`.

## Notes

- V1 se concentre sur la lisibilite de la facade.
- les optimisations haute frequence restent post-V1 (selon besoin reel).
- le caractere obligatoire/optionnel de `resourceManifest` sera ajuste apres premiers tests d'integration.
- reference bornes de lecture: `v1-horizon-spec.md`.

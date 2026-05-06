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

## Regles V1

- `mountTarget` est fourni au `Player` et reste hors `Scene`.
- `init(...)` est le point d'entree de chargement runtime.
- `schedule` est destructurable et aliasable par import direct.
- `schedule` utilise le meme scheduler runtime que les straps.
- l'execution de `schedule` suit le lifecycle `play/pause/resume/stop/destroy`.
- toutes les emissions runtime passent par policies actives.

## Notes

- V1 se concentre sur la lisibilite de la facade.
- les optimisations haute frequence restent post-V1 (selon besoin reel).
- le caractere obligatoire/optionnel de `resourceManifest` sera ajuste apres premiers tests d'integration.

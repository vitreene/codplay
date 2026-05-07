# Preload API V1 - preparation ressources

## Statut

Spec normative V1 pour le module de preload consomme par le Player.

## Objectif

Charger et preparer les ressources de diffusion avant lecture (media, fonts, css) a partir de `ResourceManifest`.

## API minimale V1

```ts
type PreloadApi = {
  load: (input: {
    manifest: ResourceManifest
    options?: Record<string, unknown>
  }) => Promise<ApiResult<{
    resources: Record<string, unknown>
    warnings?: ApiWarning[]
  }>>

  state: {
    status: "idle" | "loading" | "ready" | "error"
    loadedCount: number
    totalCount: number
  }

  cancel: () => void
}
```

## Regles V1

- preload est separe du Builder.
- preload consomme uniquement le manifeste.
- la policy de cache/version/hash est lue depuis chaque entree de manifeste.
- `cancel()` arrete les chargements en attente et invalide le resultat courant.

## Notes

- V1 ne fige pas encore les strategies fines par type de media.
- le detail est ajuste apres tests reels d'environnement.

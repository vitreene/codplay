# Builder API V1 - compilation et artefacts

## Statut

Spec normative V1 pour la facade Builder exposee a du code tiers.

## Objectif

Compiler un `SceneDef` auteur en artefacts de diffusion (`CompiledScene`, `ResourceManifest`) avec diagnostics.

## API minimale V1

```ts
type ValidationReport = {
  ok: boolean
  errors: Array<{ code: string; message: string; details?: unknown }>
  warnings: ApiWarning[]
}

type BuilderApi = {
  compile: (input: {
    scene: SceneDef
    options?: Record<string, unknown>
  }) => ApiResult<{
    compiledScene: CompiledScene
    resourceManifest: ResourceManifest
    diagnostics: {
      warnings: ApiWarning[]
    }
  }>

  validate: (input: { scene: SceneDef }) => ValidationReport

  export: (input: {
    compiledScene: CompiledScene
    exporterName: string
    options?: Record<string, unknown>
  }) => ApiResult<{ output: unknown; warnings?: ApiWarning[] }>
}
```

## Regles V1

- `compile` produit toujours un artefact JSON de diffusion.
- `CompiledScene` inclut `schemaVersion` et `createdAt`.
- `compile` et `validate` couvrent la coherence de `listen` et de la structure des tracks; `compile` retire en plus les stories `disabled: true` avant de produire l'artefact.
- `compile` preserve `Perso.name` et `Perso.id` sans reassigner silencieusement les identites d'elements.
- `Builder` ne charge pas les ressources.
- `validate` retourne toujours un objet avec `ok`, `errors`, `warnings`.
- `validate` est non mutante sur l'entree.
- la conversion externe passe par plugins (`export`).
- `export` est prevu en V1 mais peut rester non actif tant qu'aucune cible concrete n'est definie.

## Notes

- l'ordre des diagnostics est stable a entree egale.
- le detail des erreurs reste volontairement succinct en V1.
- aucun nom d'event n'est interprete comme mot-cle compile-time par cette facade.

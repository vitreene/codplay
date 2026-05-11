# CompiledScene schema V1 - contrat de diffusion

## Statut

Spec normative V1 pour la structure de `CompiledScene`.

## Objectif

Figer un schema de diffusion compact, lisible par le Player sans recompilation metier.

## Contrat canonique

```ts
type CompiledScene = {
  schemaVersion: string
  createdAt: string
  scene: {
    id: string
    stories: Record<string, StoryDef>
    rootStories: string[]
    initial: Record<string, unknown> | undefined
    straps: string[] | undefined
    listen: ListenRule[]
    tracks: Record<string, unknown>
  }
  resources: ResourceManifest
}
```

## Regles V1

- `schemaVersion` obligatoire.
- `createdAt` obligatoire.
- `scene.rootStories` obligatoire et non vide en diffusion.
- `scene.straps` obligatoire et peut valoir `undefined`.
- `scene.tracks` obligatoire (vide autorise).
- `scene.rootStories` decrit le montage des stories a la racine de la scene, sans temporalite implicite.
- `scene.tracks` orchestre la sequence globale; les eventimes portables d'une story restent portes par `scene.stories[*]`.
- artefact immuable en runtime.

## Validation minimale V1

- validation de presence des champs obligatoires
- validation de coherences de references de base
- warning sur conflits multi-parents story (premier parent gagne)

## Validation et catalogue erreurs

La validation s'appuie sur le catalogue `v1-error-catalog.md`.

- erreurs bloquantes: ex. `AUTHOR_DUPLICATE_LISTEN_ON`, `AUTHOR_ROOT_STORIES_INVALID`, `AUTHOR_STORY_ENTRIES_INVALID`
- warnings: ex. `AUTHOR_MULTI_PARENT_STORY`
- V1 ne duplique pas ici la liste exhaustive des messages: ce fichier decrit le schema, le catalogue porte la taxonomie code/message.

## Notes

- les schemas de version future peuvent ajouter des sections sans casser V1.
- invariants transverses associes: `v1-invariants.md`.

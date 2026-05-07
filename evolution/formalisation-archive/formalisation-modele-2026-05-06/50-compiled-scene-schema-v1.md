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
    topLevelStories: string[]
    initialStoryId: string
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
- `scene.topLevelStories` obligatoire et non vide en diffusion.
- `scene.initialStoryId` obligatoire et membre de `topLevelStories`.
- `scene.straps` obligatoire et peut valoir `undefined`.
- `scene.tracks` obligatoire (vide autorise).
- artefact immuable en runtime.

## Validation minimale V1

- validation de presence des champs obligatoires
- validation de coherences de references de base
- warning sur conflits multi-parents story (premier parent gagne)

## Validation et catalogue erreurs

La validation s'appuie sur le catalogue `48-error-catalog-v1.md`.

- erreurs bloquantes: ex. `AUTHOR_DUPLICATE_LISTEN_ON`, `AUTHOR_INITIAL_STORY_INVALID`
- warnings: ex. `AUTHOR_MULTI_PARENT_STORY`
- V1 ne duplique pas ici la liste exhaustive des messages: ce fichier decrit le schema, le catalogue porte la taxonomie code/message.

## Notes

- les schemas de version future peuvent ajouter des sections sans casser V1.
- invariants transverses associes: `102-final-v1-invariants-transverses.md`.

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
    initial: Record<string, unknown> | undefined
    straps: string[] | undefined
    listen: ListenRule[]
    tracks: Record<string, unknown>
  }
  resources: ResourceManifest
  rootNodeIds: string[]
}
```

## Regles V1

- `schemaVersion` obligatoire.
- `createdAt` obligatoire.
- `scene.straps` obligatoire et peut valoir `undefined`.
- `scene.tracks` obligatoire (vide autorise).
- `rootNodeIds` est calcule au build (`v1-story-spec.md`, `v1-perso-spec.md` 4bis): persos dont le `move` propre resout a `'@root'`, dans une story dont le `move` propre resout aussi a `'@root'`.
- toute story `disabled: true` dans le document source est retiree de `scene.stories` avant compilation (persos, tracks, listen rules inclus).
- `scene.tracks` porte la declaration compilee des tracks de scene qui sera consolidee a `scene.init` en registre runtime fige.
- ce registre runtime contient toujours `global` et, par defaut, un track `story.id` par story.
- les eventimes portables d'une story restent portes par `scene.stories[*]`.
- les `Perso` compiles preservent `name` et `id`.
- artefact immuable en runtime.

## Validation minimale V1

- validation de presence des champs obligatoires
- validation de coherences de references de base
- les collisions effectives d'`id` d'elements sont verifiees a `player.init` et generent un warning runtime
- les tracks inconnus references par un event de controle runtime ne modifient pas la structure et produisent un warning runtime

## Validation et catalogue erreurs

La validation s'appuie sur le catalogue `v1-error-catalog.md`.

- erreurs bloquantes: ex. `AUTHOR_DUPLICATE_LISTEN_ON`, `AUTHOR_TRACKS_INVALID`
- warnings: ex. `RUNTIME_ELEMENT_ID_COLLISION`, `AUTHOR_STORY_DISABLED_REFERENCE`
- V1 ne duplique pas ici la liste exhaustive des messages: ce fichier decrit le schema, le catalogue porte la taxonomie code/message.

## Notes

- les schemas de version future peuvent ajouter des sections sans casser V1.
- invariants transverses associes: `v1-invariants.md`.

# Authoring API V1 - creation scene par code tiers

## Statut

Spec normative V1 pour l'API de creation/manipulation de `Scene` par code tiers.

## Objectif

Permettre a un outil externe (editeur graphique, editeur textuel, code direct) de construire une scene complete sans manipuler les structures internes du runtime.

## Perimetre

- creation de `Scene`
- creation/mise a jour de `Story`, `Perso`, `Strap`, `Tracks`
- operations non destructives privilegiees, avec suppression possible en mode edition
- serialisation auteur vers entree Builder

## Contrat resultat

```ts
type ApiResult<T> =
  | { ok: true; data: T; warnings?: ApiWarning[] }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

type ApiWarning = {
  code: string
  message: string
  details?: unknown
}
```

## API minimale V1

```ts
type AuthoringApi = {
  create: (input: { id: string }) => ApiResult<void>

  scene: {
    initial: {
      set: (input: { value: Record<string, unknown> | undefined }) => ApiResult<void>
    }
    init: {
      set: (input: { value: (input?: Record<string, unknown>) => Record<string, unknown> | undefined }) => ApiResult<void>
    }
    listen: {
      set: (input: { value: ListenRule[] }) => ApiResult<void>
    }
    straps: {
      set: (input: { value: string[] | undefined }) => ApiResult<void>
    }
    tracks: {
      set?: (input: { value: Record<string, unknown> }) => ApiResult<void>
    }
    rootStories: {
      set: (input: { value: string[] }) => ApiResult<void>
    }
  }

  upsertStory: (input: { story: StoryDef }) => ApiResult<void>
  removeStory: (input: { storyId: string }) => ApiResult<void>

  upsertPerso: (input: { storyId: string; perso: Perso }) => ApiResult<void>
  removePerso: (input: { storyId: string; persoId: string }) => ApiResult<void>

  setStoryListen: (input: { storyId: string; listen: ListenRule[] }) => ApiResult<void>
  setStoryStraps: (input: { storyId: string; straps: string[] | undefined }) => ApiResult<void>
  setStoryChildren: (input: { storyId: string; children: string[] }) => ApiResult<void>
  setStoryEntries: (input: { storyId: string; entries: string[] }) => ApiResult<void>

  exportSceneDoc: () => ApiResult<SceneDef>
}
```

## Regles V1

- `straps`, `listen`, `tracks` sont obligatoires dans le modele final.
- `straps` peut valoir `undefined` par defaut au niveau scene/story.
- `scene.tracks.set` est facultatif: l'API initialise `tracks` avec une valeur par defaut.
- `rootStories` est obligatoire et non vide en mode diffusion.
- `entries` est obligatoire dans chaque `Story` et peut valoir `[]`.
- `listen.on` doit etre unique dans une story et dans la scene.
- `listen.transform` peut contenir plusieurs etapes, executees dans l'ordre.
- en conflit parent/enfant multi-parents, warning auteur et premier parent gagne.
- `rootStories` est defini explicitement au niveau scene.
- `exportSceneDoc` retourne une scene prete pour compilation Builder.

## Notes

- V1 reste simple et orientee robustesse de flux auteur -> Builder.
- le raffinement des erreurs/messages se fait en usage reel.

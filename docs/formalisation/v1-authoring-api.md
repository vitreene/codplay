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

  createStory: (input?: { name?: string }) => ApiResult<{ storyId: string; storyName: string }>
  upsertStory: (input: { story: StoryDef }) => ApiResult<void>
  removeStory: (input: { storyId: string }) => ApiResult<void>

  createPerso: (input: {
    storyId: string
    type: PersoType
    name?: string
  }) => ApiResult<{ persoId: string; persoName: string }>
  upsertPerso: (input: { storyId: string; perso: Perso }) => ApiResult<void>
  removePerso: (input: { storyId: string; persoId: string }) => ApiResult<void>

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
      upsert: (input: { trackId: string; track: Record<string, unknown> }) => ApiResult<void>
      remove: (input: { trackId: string }) => ApiResult<void>
    }
  }

  setStoryListen: (input: { storyId: string; listen: ListenRule[] }) => ApiResult<void>
  setStoryStraps: (input: { storyId: string; straps: string[] | undefined }) => ApiResult<void>
  setStoryDisabled: (input: { storyId: string; disabled: boolean }) => ApiResult<void>

  exportSceneDoc: () => ApiResult<SceneDef>
}
```

## Regles V1

- `straps`, `listen`, `tracks` sont obligatoires dans le modele final.
- `straps` peut valoir `undefined` par defaut au niveau scene/story.
- `scene.tracks.set` est facultatif: l'API peut initialiser `tracks` avec une valeur par defaut.
- `scene.tracks.upsert/remove` couvrent la creation et la gestion explicite des tracks.
- `scene.tracks` constitue le point canonique de declaration des tracks apres consolidation a `scene.init`.
- une story peut declarer statiquement les tracks qu'elle compte utiliser, mais cette declaration contribue a `Scene.tracks` et ne forme pas un registre autonome.
- `global` existe toujours comme track par defaut.
- chaque story dispose aussi par defaut d'un track portant `story.id`.
- la seule metadata auteur normative d'un track est `active`.
- apres `scene.init`, la structure des tracks est figee.
- `createStory` pose `initial: { move: '@root' }` par defaut pour qu'une story nouvellement creee soit immediatement visible — remplace l'ancien comportement par defaut via `Scene.rootStories` (retire).
- `createPerso` et `upsertPerso` posent `move: '@root'` par defaut sur `perso.initial` quand l'appelant ne fournit aucun `move` (`v1-perso-spec.md` 4bis) — remplace l'ancien comportement par defaut via `Story.entries` (retire).
- `setStoryDisabled` retire/restaure une story de la construction de la scene (builder), sans rapport avec `move`/le placement.
- `listen.on` doit etre unique dans une story et dans la scene.
- `listen.transform` peut contenir plusieurs etapes, executees dans l'ordre.
- `createStory` peut appliquer un schema de nommage generique pour les stories instanciees (ex: `name + discriminant`).
- `createPerso` peut appliquer un schema de nommage generique pour les persos instancies (ex: `name + discriminant`).
- `createStory` et `createPerso` doivent rendre visibles a l'auteur le `name` effectif et l'`id` effectif apres creation.
- l'`id` d'un element n'est pas modifiable apres creation.
- toute tentative de modification d'`id` apres creation est une erreur auteur.
- `upsertStory` et `upsertPerso` operent sur des objets existants dont l'`id` est deja fixe.
- `exportSceneDoc` retourne une scene prete pour compilation Builder.

## Notes

- V1 reste simple et orientee robustesse de flux auteur -> Builder.
- le raffinement des erreurs/messages se fait en usage reel.
- le runtime transige sur les `id`; les `name` restent auteurs et indicatifs.

# Plan : straps story-niveau — portabilité des stories

## Statut
En attente de validation avant implémentation.

## Motivation

Une story comme `chrono-story` est conçue pour être **portable et prête à l'emploi** dans n'importe quelle scène. Cette portabilité implique que la story transporte ses propres straps — l'auteur de la scène d'accueil n'a pas à savoir quels straps internes elle utilise.

Le pattern actuel impose à la démo (ou à la scène d'intégration) d'importer séparément la définition de story et sa `StrapCollection`, puis de les fusionner manuellement dans `player.init({ strapCollection })`. Ce point d'injection est unique et scène-niveau — il n'y a pas de distinction entre :
- les straps propres à une story (appartiennent à la story, voyagent avec elle)
- les straps scène (orchestration cross-stories, side-effects)

## Lacune spec identifiée

`PlayerInitInput.strapCollection` est l'unique point d'injection de fonctions strap. `StoryDef.straps: string[]` déclare les noms mais ne porte pas les fonctions — il est purement déclaratif.

Il manque :
1. Un point d'injection story-niveau dans `PlayerInitInput`
2. Un pattern d'authoring "story-package" (story + ses straps comme unité)
3. Une résolution story-aware lors de `executeStrap`

## Enrichissement spec

### `PlayerInitInput` — ajout de `storyStraps`

```ts
export type PlayerInitInput = {
  mountTarget: unknown
  compiledScene: CompiledScene
  resourceManifest?: ResourceManifest
  runtimePolicy?: RuntimeEventPolicy
  strapCollection?: StrapCollection           // scène : cross-stories, side-effects
  storyStraps?: Record<string, StrapCollection>  // story : portable, owned by story
  mode?: 'author' | 'broadcast'
  preloadPolicy?: PreloadPolicy
}
```

### Règles normatives à ajouter

- `strapCollection` est la collection scène — destinée à l'orchestration cross-stories et aux side-effects globaux.
- `storyStraps` est un dictionnaire `storyId → StrapCollection` — chaque entrée déclare les straps appartenant exclusivement à une story.
- Lors de l'exécution d'un strap via une règle `story.listen`, le runtime cherche dans `storyStraps[scopeStoryId]` en priorité, puis se rabat sur `strapCollection`.
- Lors de l'exécution d'un strap via une règle `scene.listen` (sans story scope), seul `strapCollection` est consulté.
- Un strap story déclaré dans `storyStraps` n'est **pas** accessible depuis `scene.listen` — il reste isolé dans son story scope.
- `StoryDef.straps: string[]` continue de déclarer les noms des straps de la story (documentaire + validation builder). Cette liste doit correspondre aux clés de `storyStraps[storyId]`.

### Résolution strap — logique de lookup

```ts
private resolveStrap(strapName: string, scopeStoryId: string | undefined): StrapFn | undefined {
  if (scopeStoryId !== undefined) {
    // Straps de la story directement dans la définition compilée
    const story = this.currentScene?.stories[scopeStoryId]
    return story?.straps?.[strapName]
  }
  // Straps scène-niveau
  return this.strapCollection[strapName]
}
```

## Pattern d'authoring : story auto-suffisante

La story porte ses straps directement dans sa définition. La démo n'a rien à brancher :

```ts
// chrono-story.ts
export function createChronoScene(): SceneDoc {
  return {
    stories: {
      'chrono-story': {
        id: 'chrono-story',
        straps: {
          chrono: ({ event }) => { /* ... */ }
        },
        listen: [{ on: 'chrono:start', straps: ['chrono'] }],
        // ...
      }
    }
  }
}
```

```ts
// chrono-demo.ts
await runCodPlaySceneDemo({
  scene: createChronoScene(),   // ← tout est dedans
  rootNodeIds: ['chrono-root'],
  ...
})
```

## Pattern d'authoring : scène avec plusieurs stories

```ts
await runCodPlaySceneDemo({
  scene: createMultiStoryScene(),  // chaque story porte ses straps
  strapCollection: orchestrationStraps,  // cross-stories si besoin
  ...
})
```

## Périmètre d'implémentation

### 1. `builder/types.ts`
- `StoryDef.straps: string[] | undefined` → `StrapCollection | undefined`

### 2. `player/types.ts`
- `SceneStoryDoc.straps: string[] | undefined` → `StrapCollection | undefined`

### 3. `builder/scene-normalization.ts`
- Remplacer le check `Array.isArray(story.straps)` par check object

### 4. `builder/builder-artifact-cloner.ts`
- `straps: story.straps` (référence, pas cloneData — les fonctions ne sont jamais deep-clonées)

### 5. `creator/creator-facade.ts`
- `setStoryStraps` signature : `straps: StrapCollection | undefined`
- `cloneStory` : `straps: story.straps` (référence)

### 6. `player/player.ts`
- Supprimer `storyStraps` de `PlayerInitInput` (jamais ajouté dans cette version)
- `resolveStrap` : cherche dans `this.currentScene?.stories[scopeStoryId]?.straps`
- `warnMissingStoryStraps` : non nécessaire (warning à executeStrap si strap absent)

### 7. `demos/src/shared/demo-scene-types.ts`
- Supprimer `storyStraps` (jamais exposé dans cette version)

### 8. `demos/src/codplay/run-codplay-scene-demo.ts`
- Supprimer `storyStraps` des appels `player.init`

### 9. `demos/src/scenes/chrono-story.ts`
- Supprimer `export const chronoStraps`
- Intégrer les straps directement dans la story : `straps: { chrono: (...) => ... }`

### 10. `demos/src/codplay/chrono-demo.ts`
- Supprimer l'import de `chronoStraps`
- Supprimer `storyStraps` de la config

### 11. Tests
- Vérifier que les straps story sont résolus depuis la story compilée
- Vérifier qu'un strap story n'est pas accessible depuis `scene.listen`

## Décisions validées

1. **Isolation stricte** — pas de fallback vers `strapCollection` pour un strap déclaré dans `story.listen`. Si le strap n'est pas trouvé dans `storyStraps[storyId]`, le runtime émet un warning et ignore l'appel (comportement V1 : continue avec warning).

2. **Warning auteur** — le player vérifie à l'init que les noms déclarés dans `story.straps` correspondent aux clés de `storyStraps[storyId]`, et émet un warning si une clé est manquante.

3. **Toutes les specs** — `v1-strap-spec.md`, `v1-story-spec.md`, `v1-scene-spec.md` sont enrichies avec les nouvelles règles.

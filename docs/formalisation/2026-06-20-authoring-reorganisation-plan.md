# Plan — Réorganisation de `packages/authoring`

**Date :** 2026-06-20

## Principes directeurs

`packages/authoring` est la bibliothèque de ressources réutilisables du repo. Elle contient des modules aboutis que les autres parties du repo (demos, editor, capsules…) peuvent importer. Ce n'est pas un lieu de tests ou de démonstration.

Règle : un module entre dans `authoring` quand il est stable, à usage général, et sans dépendance vers `demos` ou `editor`.

---

## 1. Extraction de `SceneDocEditor` depuis `CodPlay`

### Problème

`CodPlay` mélange deux responsabilités :
- **Lecture de scène** : `load()`, `player`, `telco`, `emit()` → API auteur/runtime
- **Construction de scène** : `create()`, `createStory()`, `upsertStory()`, `exportSceneDoc()`, etc. → API éditeur

L'API de construction n'est consommée par aucun code applicatif (ni demos, ni editor). Elle est couverte uniquement par des tests. Elle alourdit `CodPlay` et lui prête une responsabilité qui n'est pas la sienne.

### Solution

Extraire la mécanique de construction dans une classe `SceneDocEditor`, placée dans `packages/authoring/scene-factory/`.

**`CodPlay` après extraction — périmètre réduit :**

```typescript
class CodPlay {
  readonly player: Player
  readonly telco: TelcoApi
  load(input: CodPlayLoadInput): Promise<ApiResult<BuilderCompileOutput>>
  emit(input: StoryEvent): Promise<ApiResult<void>>
}
```

`builder` (BuilderFacade) devient interne à `CodPlay`, utilisé uniquement dans `load()`.

**`SceneDocEditor` — périmètre extrait :**

```typescript
class SceneDocEditor {
  create(input: { id: string }): ApiResult<void>
  createStory(input?: { name?: string }): ApiResult<{ storyId: string; storyName: string }>
  createPerso(input: { storyId: string; type: string; name?: string }): ApiResult<{ persoId: string; persoName: string }>
  upsertStory(input: { story: StoryDef }): ApiResult<void>
  removeStory(input: { storyId: string }): ApiResult<void>
  upsertPerso(input: { storyId: string; perso: Perso }): ApiResult<void>
  removePerso(input: { storyId: string; persoId: string }): ApiResult<void>
  setStoryListen(input: { storyId: string; listen: ListenRule[] }): ApiResult<void>
  setStoryStraps(input: { storyId: string; straps: StrapCollection | undefined }): ApiResult<void>
  setStoryEntries(input: { storyId: string; entries: string[] }): ApiResult<void>
  scene: { initial, init, listen, straps, tracks, rootStories }
  exportSceneDoc(): ApiResult<SceneDef>
}
```

Migrent avec `SceneDocEditor` : `cloneStory`, `clonePerso`, `cloneData`, `withScene`, `withStory`, `createStoryIdentity`, `createPersoIdentity`.

**Emplacement :** `packages/authoring/scene-factory/src/scene-doc-editor.ts`

**Impact tests :** `creator-api.spec.ts` et `codplay-flow.spec.ts` importent depuis `@codplay/scene-factory` au lieu de `codplay/creator`.

---

## 2. Regroupement des composants avatars

### Problème

`avatar3d`, `avatar-rive` et `avatar-engine` sont des composants/modules de haut niveau éparpillés à la racine de `packages/authoring`. Ils constituent une famille cohérente (composants visuels pilotés par CodPlay) qui mérite un dossier dédié.

### Solution

Créer `packages/authoring/components/` et y déplacer :

```
packages/authoring/components/
  avatar3d/       ← depuis packages/authoring/avatar3d/
  avatar-rive/    ← depuis packages/authoring/avatar-rive/
  avatar-engine/  ← depuis packages/authoring/avatar-engine/
```

Les `package.json` et alias d'import sont mis à jour en conséquence. Les dépendances internes entre ces modules (`avatar3d` → `avatar-engine`, `avatar-rive` → `avatar-engine`) restent valides.

**Note :** `rive/` (intégration Rive générique, non spécifique aux avatars) et `capsule-automation/` restent à la racine de `packages/authoring/`.

---

## 3. Structure cible de `packages/authoring`

```
packages/authoring/
  capsule-automation/   — helpers construction de capsules
  components/
    avatar-engine/      — moteur d'animation (lipsync, gaze, expression…)
    avatar-rive/        — composant avatar Rive
    avatar3d/           — composant avatar 3D (VRM / TalkingHead)
  demo-remote/          — télécommande UI réutilisable
  rive/                 — intégration Rive générique
  scene-factory/         — SceneDocEditor : construction programmatique de SceneDef
```

---

## Séquence d'implémentation

1. Créer `packages/authoring/scene-factory/` avec `SceneDocEditor`
2. Mettre à jour `CodPlay` (retirer l'API de construction, retirer `builder` public)
3. Mettre à jour `CodPlayApi` dans `types.ts`
4. Mettre à jour les tests (`creator-api.spec.ts`, `codplay-flow.spec.ts`)
5. Créer `packages/authoring/components/` et déplacer les trois packages avatar
6. Mettre à jour les `package.json`, `tsconfig.json` et alias d'import impactés

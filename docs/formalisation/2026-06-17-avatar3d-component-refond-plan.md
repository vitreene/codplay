# Plan — Refonte complète du composant `avatar3d`

Date : 2026-06-17  
Branche : `grid-editor`  
Statut : **à implémenter après validation du fix straps**

---

## Contexte

Le composant `avatar3d-component.ts` actuel viole plusieurs règles de la spec `v1-third-party-runtime-spec.md` :

| Bug | Règle violée |
|---|---|
| Classe hand-rolled, pas de `extends BaseComponent` | Phase 2 — contrat composant |
| Canvas injecté de l'extérieur via deps | `render()` doit créer le nœud DOM |
| `_init()` override non conforme | `_init()` est interne ; l'auteur implémente `init()` |
| Pas de `ThirdPartyBinding` / factory closure | Phase 3 — RenderAdapter hub |
| `createAvatar3D()` fait le chargement GLB en `setup()` | Le chargement doit passer par le preload CodPlay |
| `seekStart()` hors-spec dans le render adapter | Pas de méthode custom non déclarée dans `RenderAdapter` |
| Pas de `ComponentServiceBase` services | Phase 5 — spécialisation par services |
| `timelineDeltaMs` utilisé dans `tick()` mais sans `setRate()` côté engine | Phase 4 — pattern rate |

---

## Architecture cible

```
createAvatar3dBinding({ glbUrl, retarget, morphPrefix, camera, scene, renderer, ... })
  └─ factory closure : instances[]
     ├─ Avatar3dComponent extends BaseComponent
     │    render()  → canvas = buildNode('canvas')
     │    init()    → engine depuis preload cache ; configure ; instances.push(this)
     │    update()  → dispatch sémantique (viseme, morph, gesture, gaze, mood,
     │                head-pose, blink, breathe)
     │    _tick()   → engine.animate(dt) ; gaze.computeAndApply()
     │    _seek()   → engine.commitSeek() ; gaze.computeAndApply()
     │    _stop()   → engine.prepareSeek() ; gaze.setEnabled(false)
     │    setRate() → engine.setRate(rate)  [si avatar-engine supporte un rate natif]
     │                OU _rate local + scale in _tick()
     └─ RenderAdapter hub
          tick(info)       → instances.forEach(_tick)  + renderer.render()
          seek(info)       → instances.forEach(_seek)  + renderer.render()
          rateChange(rate) → instances.forEach(setRate)
          stop()           → instances.forEach(_stop)  ; instances.length = 0
```

### Preload

Un `ResourceManifestEntry` de type `'avatar3d'` est introduit.  
La stratégie preload :
- **Niveau 1** : charge le bundle Three.js / avatar-engine (singleton de session, déjà chargé en pratique)
- **Niveau 2** : `engine.loadModel(url, opts)` → résultat stocké dans le cache preload  
  (`setEntry(url, { status: 'ready', engine, boneMap })`)

Dans `init()`, le composant récupère `getEntry(url)` de manière synchrone et dispose de l'engine et du boneMap.

---

## Étapes

### Étape 1 — Preload strategy `avatar3d`

Fichier : `packages/authoring/avatar3d/src/avatar3d-preload.ts`

```ts
import type { PreloadStrategyFn } from 'codplay'
import { createAvatarEngine } from '@codplay/avatar-engine'

export type Avatar3dPreloadEntry = {
  status: 'ready'
  engine: AvatarEngine
  boneMap: Map<string, Object3D>
}

export function getAvatar3dEntry(url: string): Avatar3dPreloadEntry { ... }

export const loadAvatar3dResource: PreloadStrategyFn = async ({ url, setEntry, getEntry, config }) => {
  if (getEntry(url)?.status === 'ready') return
  const engine = createAvatarEngine({ mood: config?.mood })
  const { scene, boneMap } = await engine.loadModel(url, config?.loaderOpts)
  setEntry(url, { status: 'ready', engine, boneMap })
}
```

**Question à trancher** : comment passer `camera`, `renderer`, `threeScene` au composant ? Ces objets Three.js ne sont pas dans le preload. Options :
- a. Ils sont dans `perso.initial` (mais ce sont des objets vivants, pas sérialisables)
- b. Ils sont passés à la factory `createAvatar3dBinding()` et partagés via closure (recommandé)
- c. Le renderer est créé dans `render()` du composant ; camera et scene sont closurisés

**Recommandation** : option b — la factory reçoit `{ camera, renderer, scene }` ; le renderer.domElement devient le canvas retourné par `render()`.

### Étape 2 — `Avatar3dComponent extends BaseComponent`

Fichier : `packages/authoring/avatar3d/src/avatar3d-component.ts` (réécriture complète)

```ts
class Avatar3dComponent extends BaseComponent {
  private _engine: AvatarEngine | null = null
  private _gaze:   GazeService  | null = null
  private _rate = 1

  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(COMPONENT_DEFAULT_SERVICES)
  }

  render(): ComponentRenderResult {
    // renderer.domElement est le canvas Three.js ; on le réutilise directement
    return renderer.domElement  // renderer fermé depuis la factory closure
  }

  init(): void {
    const initial = this.perso.initial as Avatar3dInitial
    const entry = getAvatar3dEntry(initial.src)  // synchrone, garanti par preload
    this._engine = entry.engine
    const leftEye  = entry.boneMap.get('LeftEye')  ?? null
    const rightEye = entry.boneMap.get('RightEye') ?? null
    this._gaze = new GazeService(this._engine.morphEngine, leftEye, rightEye, camera)
  }

  _tick(info: RenderTickInfo): void {
    if (!this._engine) return
    this._engine.animate(info.deltaMs * this._rate)
    this._gaze?.computeAndApply()
  }

  _seek(_info: RenderSeekInfo): void {
    if (!this._engine) return
    this._engine.commitSeek()
    this._gaze?.computeAndApply()
  }

  setRate(rate: number): void { this._rate = rate }

  _stop(): void {
    this._engine?.prepareSeek()
    this._gaze?.setEnabled(false)
    this._engine = null
    this._gaze   = null
  }

  update({ action, eventSeq }: RuntimeComponentUpdateInput): void {
    if (!this._engine) return
    this.services.apply(this.node, action)
    // dispatch sémantique (viseme, morph, gesture, gaze, mood, head-pose, blink, breathe)
    // ... (identique au patch actuel, nettoyé)
  }
}
```

### Étape 3 — Factory `createAvatar3dBinding()`

Fichier : `packages/authoring/avatar3d/src/create-avatar3d-binding.ts`

```ts
export function createAvatar3dBinding(opts: Avatar3dBindingOptions): ThirdPartyBinding {
  const { camera, renderer, scene: threeScene, visemeWeight } = opts
  const instances: Avatar3dComponent[] = []

  class Avatar3dComponentImpl extends Avatar3dComponent {
    override _init(): void {
      super._init()
      threeScene.add(/* model group from entry */)
      instances.push(this)
    }
  }

  const renderAdapter: RenderAdapter = {
    tick(info) {
      instances.forEach(c => c._tick(info))
      renderer.render(threeScene, camera)
    },
    seek(info) {
      instances.forEach(c => c._seek(info))
      renderer.render(threeScene, camera)
    },
    rateChange(rate) { instances.forEach(c => c.setRate(rate)) },
    stop() {
      instances.forEach(c => c._stop())
      renderer.render(threeScene, camera)
      instances.length = 0
    },
  }

  return {
    components: { 'avatar3d': Avatar3dComponentImpl },
    renderAdapter,
    preload: [{ type: 'avatar3d', load: loadAvatar3dResource }],
  }
}
```

### Étape 4 — Mise à jour de la démo

`avatar-poc-1-demo.ts` :
- `setup()` retourne `createAvatar3dBinding({ glbUrl, retarget, camera, renderer, scene })`
- Le manifeste preload déclare `{ type: 'avatar3d', url: glbUrl, config: { loaderOpts, mood } }`
- Plus de `createAvatar3D()` — la factory s'occupe de tout

---

## Points ouverts

- **Rate Three.js** : `AvatarEngine.animate(dt)` accepte un `dt` en ms ; le composant applique `_rate` localement en scalant le delta. Pas besoin de `setRate()` sur le moteur.
- **Model group dans la scene** : le group Three.js est ajouté à `threeScene` dans `_init()` du composant et retiré dans `_stop()`. Vérifier que `removeFromParent()` suffit.
- **Gaze à seek** : `engine.commitSeek()` + `gaze.computeAndApply()` dans `_seek()` est suffisant (gaze recalcule depuis les bones actuels, pas depuis un snapshot).
- **`seekStart()`** : la méthode custom `seekStart()` de l'adapter actuel (qui appelle `engine.prepareSeek()`) n'est pas dans le contrat `RenderAdapter`. À confirmer si CodPlay appelle un hook de début de seek ou si le seek est entièrement piloté par les events de track rejoués dans `update()`.

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `src/avatar3d-preload.ts` | Nouveau |
| `src/create-avatar3d-binding.ts` | Nouveau (remplace `create-avatar3d.ts`) |
| `src/avatar3d-component.ts` | Réécriture complète |
| `src/avatar3d-render-adapter.ts` | Supprimé (absorbé par la factory) |
| `src/create-avatar3d.ts` | Supprimé (remplacé par binding) |
| `packages/demos/src/codplay/avatar-poc-1-demo.ts` | Mise à jour setup() |
| `packages/codplay/src/player/` | Vérifier si `seekStart` existe dans RenderAdapter |

---

## Pré-requis

Avant d'implémenter :
1. Confirmer le comportement de `seek` : `engine.prepareSeek()` doit-il être appelé AVANT la relecture des tracks, et si oui, par quel mécanisme ? (hook dans RenderAdapter, ou convention dans le démo ?)
2. Confirmer que `ThirdPartyBinding` est bien exporté par `'codplay'` et que `player.init()` consomme `bindings: [...]`.
3. Vérifier si `BaseComponent` expose `buildNode('canvas')` retournant un `HTMLCanvasElement`.

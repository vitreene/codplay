# Composants tiers V1 - regles d'integration de bibliotheques de rendu

## Statut

Spec normative V1 pour l'integration de bibliotheques de rendu tierces dans CodPlay.
S'applique a Rive, Three.js (avatar-engine), Lottie, PixiJS, et tout moteur futur.

## Objectif

Definir les regles qui gouvernent l'ajout d'un composant appuye sur une bibliotheque tierce :
chargement des ressources, cycle de vie du composant, couplage au ticker CodPlay, specialisation par services.
Interdire tout ecart qui integre ces bibliotheques en violation ou en concurrence avec l'orchestrateur CodPlay.

---

## Interdictions normatives

Ces regles s'appliquent sans exception. Aucune solution locale ne les contourne.

**1. Pas de RAF propre.**
Une bibliotheque tierce ne lance pas son propre `requestAnimationFrame`. CodPlay est l'unique source d'avancement temporel. Tout RAF concurrent rompt le controle du rate, du seek et du pause.

**2. Pas de chargement hors preload.**
Aucun `fetch()`, aucune promesse de chargement n'est emise dans `render()`, `init()`, ou le constructeur d'un composant. Tout chargement de ressource passe par le module preload avant que le player ne monte les composants.

**3. Pas d'API de preload propriétaire.**
Il n'existe pas d'"API de preload specifique a la bibliotheque" exposee par un package authoring. La question "faut-il creer une API de preload pour cette bibliotheque ?" a toujours la meme reponse : creer un adapter de strategie dans l'infrastructure preload de CodPlay. Voir la section Preload.

**4. Pas d'etat statique partage entre instances.**
La factory pattern est obligatoire pour isoler les instances par player. Pas de `static instances: Foo[]` sur la classe du composant.

**5. Pas d'initialisation bibliotheque dans `render()`.**
`render()` cree uniquement le noeud DOM conteneur. L'initialisation du moteur se fait dans `init()`, apres la garantie de preload.

**6. Pas d'appel bibliotheque dans le constructeur du composant.**

---

## Contrat de binding

### ThirdPartyBinding — type unifie de declaration

Toute bibliotheque tierce s'integre a CodPlay via un objet `ThirdPartyBinding`. Ce type est exporte par CodPlay et constitue le seul point d'entree pour declarer un composant, ses adapters, ses services et sa strategie de preload.

```ts
// exporte par 'codplay'
export type ThirdPartyBinding = {
  /** Types de perso fournis par cette bibliotheque. */
  components: Record<string, RuntimeComponentClass>
  /** Adapter de rendu unique pour la bibliotheque (hub, cf. Phase 3). */
  renderAdapter?: RenderAdapter
  /** Services supplementaires enregistres dans le service registry. */
  services?: Array<{ name: string; service: ServiceInstance }>
  /** Strategie(s) de preload pour les types de ressource de cette bibliotheque. */
  preload?: Array<{ type: string; load: PreloadStrategyFn }>
}
```

Un `ThirdPartyBinding` declare tout ce dont la bibliotheque a besoin, en un seul objet. Il n'y a pas de registration separee du composant, de l'adapter et des services.

### Factory pattern — forme canonique

La factory est une fonction qui cree et retourne un `ThirdPartyBinding`. Elle utilise une closure pour partager l'etat interne (liste d'instances) entre le composant et le hub adapter. C'est la seule forme autorisee — pas de classe `ThirdPartyBinding` a etendre.

```ts
// @codplay/avatar-rive
import type { ThirdPartyBinding } from 'codplay'

export function createRiveBinding(): ThirdPartyBinding {
  const instances: RiveBaseComponent[] = []

  class RiveComponent extends RiveBaseComponent {
    override _init(): void {
      super._init()
      instances.push(this)
    }
  }

  const renderAdapter: RenderAdapter = {
    tick:       (info) => instances.forEach(c => c._tick(info)),
    seek:       (info) => instances.forEach(c => c._seek(info)),
    rateChange: (rate) => instances.forEach(c => c.setRate(rate)),
    stop:       ()     => { instances.forEach(c => c._stop()); instances.length = 0 },
  }

  return {
    components:    { 'rive': RiveComponent, 'avatar-rive': CoachRiveComponent },
    renderAdapter,
    preload:       [{ type: 'rive', load: loadRiveResource }],
  }
}
```

### Consommation par CodPlay

`CreatePlayerOptions` accepte un tableau de `ThirdPartyBinding` via la propriete `bindings`. CodPlay decompresse chaque binding dans ses registries au bootstrap.

```ts
// exporte par 'codplay'
type CreatePlayerOptions = {
  bindings?: ThirdPartyBinding[]
  // ... autres options existantes
}

// expansion interne au constructeur CodPlay :
// binding.components → codplay.component.register({ type, component })
// binding.renderAdapter → ajoute au RenderSync
// binding.services → codplay.service.register({ name, service })
// binding.preload → enregistre la strategie dans le module preload
```

### Usage auteur

L'auteur instancie le player en declarant ses bindings :

```ts
import { CodPlay } from 'codplay'
import { createRiveBinding } from '@codplay/avatar-rive'

const studio = new CodPlay({
  bindings: [createRiveBinding()],
})
```

Plusieurs bibliotheques coexistent sans friction :

```ts
const studio = new CodPlay({
  bindings: [
    createRiveBinding(),
    createLottieBinding(),
    createAvatarEngineBinding(),
  ],
})
```

### Impact sur setup()

La fonction `setup()` des demos retourne desormais un `ThirdPartyBinding` ou un tableau de `ThirdPartyBinding`, pas un objet ad-hoc `{ components, renderAdapters }` :

```ts
async setup(): Promise<ThirdPartyBinding | ThirdPartyBinding[]> {
  return createRiveBinding()
}
```

---

## Architecture

Un composant tierce partie est constitue de quatre couches coordonnees :

```
┌──────────────────────────────────────────────────────────────────────┐
│  Strategie de preload                                                │
│  module dans le package authoring, enregistre dans le preload core  │
│  - niveau 1 : chargement bibliotheque (WASM/JS) — singleton session │
│  - niveau 2 : chargement ressource par URL — cache par entree        │
├──────────────────────────────────────────────────────────────────────┤
│  Composant base generique                                            │
│  etend BaseComponent                                                 │
│  render() → noeud DOM                                                │
│  init()   → recupere le cache, initialise le moteur                  │
│  update() → traduit les actions CodPlay en appels moteur             │
├──────────────────────────────────────────────────────────────────────┤
│  Composant specialise (optionnel)                                    │
│  etend le composant base                                             │
│  ajoute des services domaine (lipsync, emotion, gesture...)          │
│  override de update() pour dispatcher aux services                   │
├──────────────────────────────────────────────────────────────────────┤
│  RenderAdapter hub                                                   │
│  un adapter par bibliotheque, pas par instance                       │
│  delegue tick/seek/pause/resume/rateChange/stop a toutes instances   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 : Preload

### Principe

Le module preload garantit que toutes les ressources d'une scene sont disponibles avant que `player.init()` monte les composants. Un composant tierce partie peut supposer dans `init()` que ses ressources sont pres dans le cache.

Reference : `v1-preload-api.md`.

### Deux niveaux de chargement

**Niveau 1 — Chargement de la bibliotheque (singleton de session)**

Le runtime WASM ou le bundle JS est charge une seule fois par session, quel que soit le nombre d'instances du composant ou de scenes. La promesse de resolution est partagee : les appels suivants attendent la meme resolution sans relancer le chargement.

```ts
// exemple Rive
let riveRuntimePromise: Promise<RiveRuntime> | null = null

function awaitRiveRuntime(): Promise<RiveRuntime> {
  riveRuntimePromise ??= RuntimeLoader.awaitInstance()
  return riveRuntimePromise
}
```

Ce singleton vit dans le module de strategie preload, pas dans le composant.

**Niveau 2 — Chargement de la ressource (par URL)**

La ressource individuelle (fichier `.riv`, `.json` Lottie, modele Three.js) est fetche et preparee, puis stockee dans le cache preload via `setEntry(url, entry)` de `preload-cache.ts`.

Quand plusieurs composants dans la meme scene referent la meme URL, la strategie verifie `getEntry(url)` avant tout fetch. Si l'entree est `ready`, elle est reutilisee directement — la ressource n'est chargee qu'une seule fois.

### Type d'entree dans le manifeste

Un nouveau `type` est declare dans `ResourceManifestEntry` pour chaque bibliotheque tierce :

```ts
// exemples — ajouter un type par bibliotheque
type ResourceManifestEntry =
  | { type: 'image' | 'audio' | 'video' | 'font' | 'css', url: string, ... }
  | { type: 'rive',   url: string }
  | { type: 'lottie', url: string }
```

### Extraction par le Builder

Le Builder extrait `perso.initial.src` des persos dont le `type` est enregistre comme composant tierce partie et produit l'entree manifeste correspondante. Le champ `type` de l'entree manifeste est derive du `type` du perso ou d'une declaration explicite dans le package authoring.

### Extension du cache preload

L'entree de cache peut etre etendue pour stocker l'objet prepare par la bibliotheque (au-dela du statut de chargement) :

```ts
// exemple pour Rive
type RivePreloadEntry = PreloadCacheEntry & {
  runtime: RiveRuntime
  file: RiveFile
}
```

L'entree est recuperee dans `init()` via `getEntry(url)` — acces synchrone garanti apres preload.

---

## Phase 2 : Composant base generique

### Cycle de vie

```
constructeur → declare services standard (className, style, attr)
render()     → cree le noeud DOM conteneur (canvas ou div)
               applique perso.initial via services
               aucun appel bibliotheque
init()       → recupere l'entree du cache preload (synchrone)
               initialise le moteur a partir du cache
               configure les parametres lus dans perso.initial
               enregistre l'instance dans le hub (via closure factory)
update()     → traduit les champs de l'action en appels moteur
_tick()      → advance moteur + draw (appele par le hub)
_seek()      → advance(0) + draw (appele par le hub)
setRate()    → stocke le rate local (appele par le hub via rateChange)
```

`render()` et `init()` se succedent dans cet ordre, garantis par `_init()` de `BaseComponent`.

### Typage des proprietes perso

Chaque composant tierce partie definit des types TypeScript pour les trois zones de contrat du perso : `initial`, `emit`, et `actions`. Ces types sont la definition de ce que le composant peut gerer. Ce sont les services et les capacites du composant qui les definissent.

**Composition des types**

Un type de proprietes perso est la reunion de deux contributions :

1. **Les services declares** apportent leurs cles : `style`, `className`, `attr` pour les services core ; tout service supplementaire ajoute ses propres cles.
2. **Le composant** ajoute les cles specifiques a la bibliotheque qu'il ne delegue pas a un service : `src`, `artboard`, `stateMachine` pour Rive.

Ces types sont definis dans le package authoring du composant et exportes pour que l'auteur de scene les utilise.

```ts
// @codplay/avatar-rive — types exportes par le package

// --- composant base : lit et joue un fichier .riv ---

export type RiveInitial = {
  src: string              // URL du fichier .riv (declare dans le manifeste)
  artboard?: string        // nom de l'artboard — si absent, artboard par defaut du fichier
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
  move?: { parentId: string }
}

export type RiveActionPayload = {
  broadcast?: { type: string }
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
}

// --- service state machine : ajoute le controle via SMI ---

export type RiveStateMachineInitial = RiveInitial & {
  stateMachine: string     // nom de la state machine dans l'artboard
}

// --- composant specialise coach : ajoute lipsync et emotion ---

export type CoachRiveInitial = RiveStateMachineInitial   // meme initial que SM

export type CoachRiveActionPayload = RiveActionPayload & {
  viseme?:  string | null
  emotion?: number
}
```

La state machine n'est pas une propriete du composant base : c'est une capacite ajoutee par un service, dont la cle (`stateMachine`) etend le type `RiveInitial`.

**Usage dans le composant**

Le composant caste `perso.initial` vers son type dans `render()` et `init()`, et caste `input.action` dans `update()` :

```ts
// composant base
render(): ComponentRenderResult {
  const initial = this.perso.initial as RiveInitial
  // applique style, className, attr via services
}

init(): void {
  const initial = this.perso.initial as RiveInitial
  const entry = getRiveEntry(initial.src)          // depuis le cache preload
  const artboard = initial.artboard
    ? entry.file.artboardByName(initial.artboard)
    : entry.file.defaultArtboard()
  // ...
}

// composant specialise : lit les cles supplementaires dans init()
init(): void {
  super.init()
  const initial = this.perso.initial as CoachRiveInitial
  const smService = new StateMachineService(this._riveCtx!, initial.stateMachine)
  // ...
}

update(input: RuntimeComponentUpdateInput): void {
  const action = input.action as RiveActionPayload
  this.services.apply(this.node, action)
}
```

**Usage par l'auteur de scene**

```ts
import type { RiveInitial, CoachRiveInitial, CoachRiveActionPayload } from '@codplay/avatar-rive'

// composant base — fichier riv sans state machine
const animPerso: PersoDef = {
  id: 'banner',
  type: 'rive',
  initial: {
    src: '/animations/intro.riv',
    style: { width: '400px', height: '300px' }
  } satisfies RiveInitial,
  actions: {}
}

// composant specialise — coach avec lipsync
const coachPerso: PersoDef = {
  id: 'avatar',
  type: 'avatar-rive',
  initial: {
    src: '/avatars/coach.riv',
    artboard: 'Coach model',
    stateMachine: 'State Machine 1',
    move: { parentId: 'avatar-stage' },
    style: { width: '100%', height: '100%' }
  } satisfies CoachRiveInitial,
  actions: {
    'avatar:viseme': {} satisfies CoachRiveActionPayload,
    'avatar:stop':   { broadcast: { type: 'STOP' } } satisfies CoachRiveActionPayload,
  }
}
```

Une propriete haute-niveau de `initial` peut correspondre directement a un appel de methode sur la bibliotheque. `artboard` n'est pas un attribut DOM : c'est un parametre de configuration lu une seule fois dans `init()`, qui declenche `file.artboardByName(initial.artboard)`. Meme principe pour `stateMachine`, `animationName`, etc.

### Exemple de composant base Rive

Le composant base gere uniquement ce qui est commun a tout fichier `.riv` : artboard + rendu frame par frame. Pas de state machine, pas d'inputs — ce sont des capacites avancees traitees par des services.

```ts
class RiveBaseComponent extends BaseComponent {
  protected _riveCtx: RiveContext | null = null
  private _rate = 1

  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(COMPONENT_DEFAULT_SERVICES)
  }

  render(): ComponentRenderResult {
    const initial = this.perso.initial as RiveInitial
    const canvas = globalThis.document.createElement('canvas')
    this.services.apply(canvas, initial)
    return canvas
  }

  init(): void {
    const initial = this.perso.initial as RiveInitial
    const entry = getRiveEntry(initial.src)            // synchrone, garanti disponible
    const artboard = initial.artboard
      ? entry.file.artboardByName(initial.artboard)
      : entry.file.defaultArtboard()
    if (!artboard) throw new Error(`[rive] artboard introuvable dans "${initial.src}"`)
    const renderer = entry.runtime.makeRenderer(this.node as HTMLCanvasElement)
    this._riveCtx = { runtime: entry.runtime, artboard, renderer }
    // enregistrement hub via closure factory (cf. section RenderAdapter)
  }

  // Méthode d'avancement extensible : les composants specialises la surchargent
  // pour inserer leur propre avancement (state machine, animation nommee...)
  // AVANT l'avancement de l'artboard.
  protected _doAdvance(sec: number): void {
    this._riveCtx!.artboard.advance(sec)
  }

  _tick(info: RenderTickInfo): void {
    if (!this._riveCtx) return
    const sec = (info.deltaMs * this._rate) / 1000
    this._doAdvance(sec)
    this._drawFrame()
  }

  _seek(_info: RenderSeekInfo): void {
    if (!this._riveCtx) return
    this._doAdvance(0)
    this._drawFrame()
  }

  setRate(rate: number): void { this._rate = rate }

  _stop(): void { this._riveCtx = null }

  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
  }

  protected _drawFrame(): void {
    // clear → align → artboard.draw(renderer) → resolveAnimationFrame
  }
}
```

`_doAdvance(sec)` est le point d'extension : les services qui ont besoin de participer au tick (state machine) le font en surchargeant cette methode dans le composant specialise, en inserant leur avancement avant `super._doAdvance(sec)` qui avance l'artboard.

---

## Phase 3 : RenderAdapter hub

### Un adapter par bibliotheque

Un seul `RenderAdapter` est inclus dans le `ThirdPartyBinding` par bibliotheque. Il agit comme hub : il maintient la liste des instances actives des composants de cette bibliotheque et delegue chaque appel tick/seek/rateChange/stop a toutes les instances, dans l'ordre d'enregistrement.

### Mecanique de la closure

La factory utilise une closure pour partager `instances` entre le composant et le hub sans etat statique. C'est le seul mecanisme autorise.

```ts
export function createRiveBinding(): ThirdPartyBinding {
  const instances: RiveBaseComponent[] = []

  class RiveComponent extends RiveBaseComponent {
    override _init(): void {
      super._init()       // render() → init() : moteur initialise
      instances.push(this)
    }
  }

  const renderAdapter: RenderAdapter = {
    tick:       (info) => instances.forEach(c => c._tick(info)),
    seek:       (info) => instances.forEach(c => c._seek(info)),
    rateChange: (rate) => instances.forEach(c => c.setRate(rate)),
    stop:       ()     => {
      instances.forEach(c => c._stop())
      instances.length = 0   // reset hub : le prochain player.init() re-enregistrera
    },
  }

  return {
    components:    { 'rive': RiveComponent, 'avatar-rive': CoachRiveComponent },
    renderAdapter,
    preload:       [{ type: 'rive', load: loadRiveResource }],
  }
}
```

`CoachRiveComponent` etend `RiveBaseComponent` — son `_init()` herite du push dans `instances`. Les deux types de composants partagent le meme hub.

### Nom du type de composant

Les cles de `components` (`'rive'`, `'avatar-rive'`...) sont choisies par la factory. Elles doivent correspondre aux valeurs `type` utilisees dans les `PersoDef` de la scene.

### Cycle stop / reinit

`stop()` du hub vide `instances`. Un `player.init()` subsequent instancie de nouveaux composants qui se re-poussent dans la liste via `_init()`. Le cycle `destroy → init` est sans effet de bord.

---

## Phase 4 : Rate et ticker

Reference normative : `v1-rate-spec.md`.

### Regle : moteur sans multiplicateur natif (Rive, Lottie)

Le seul levier est l'argument `sec` (ou equivalent) passe a la methode d'avancement du moteur.
Pattern impose :

```ts
private _rate = 1

_tick(info: RenderTickInfo): void {
  const sec = (info.deltaMs * this._rate) / 1000
  this.engine.advance(sec)
}

setRate(rate: number): void {
  this._rate = rate
}
```

L'adapter appelle `setRate(rate)` depuis `rateChange` du hub.

Interdiction : utiliser `timelineDeltaMs` dans `tick()` et implementer `rateChange` en meme temps.
Ces deux approches sont mutuellement exclusives. Les combiner applique le rate deux fois.

### Regle : moteur avec multiplicateur natif (Three.js via avatar-engine)

```ts
_tick(info: RenderTickInfo): void {
  this.engine.animate(info.deltaMs)  // le moteur applique son propre rate en interne
}

setRate(rate: number): void {
  this.engine.setRate(rate)          // configure le multiplicateur natif
}
```

### seek

Apres un seek, les `update()` du composant ont rejoue les actions des tracks et repose les inputs.
La bibliotheque doit se snapsoter sans interpolation :

```ts
_seek(_info: RenderSeekInfo): void {
  this.engine.advance(0)   // applique les inputs actuels, avancement nul
  this._drawFrame()        // materialise la position visuellement
}
```

### pause / resume

Pour les moteurs sans lecteur propre, `pause` et `resume` sont des no-ops : CodPlay arrete/reprend d'appeler `_tick()`, ce qui fige naturellement le rendu. N'implanter le hook que si la bibliotheque exige un signal explicite.

---

## Phase 5 : Specialisation par services

### Principe

Un composant specialise etend le composant base et ajoute des comportements domaine via des services internes. Tout service interne etend `ComponentServiceBase` — la classe de base commune qui codifie les appels et traitements dans le cycle de vie du composant.

**Regle de decomposition** : toute capacite specifique a un fichier ou a un usage (state machine, animation nommee, input SMI, segment, visibilite de layer...) est un service — pas une propriete du composant base.

---

### ComponentServiceBase — classe de base des services internes

`ComponentServiceBase` est exporte par `codplay`. Tout service interne d'un composant tierce partie l'etend.

```ts
// exporte par 'codplay'
export abstract class ComponentServiceBase {
  /**
   * Applique une valeur d'action sur l'API bibliotheque ciblee.
   * Appele par le composant dans update() pour chaque cle d'action pertinente.
   */
  abstract apply(value: unknown): void

  /**
   * Remet le service a son etat neutre/initial.
   * Appele automatiquement par le composant sur stop() et avant seek replay.
   * Implementation par defaut : no-op. Surcharger quand un etat doit etre reinitialise.
   */
  reset(): void {}

  /**
   * Avancement temporel : appele automatiquement par le composant a chaque tick,
   * avant l'avancement de l'artboard/animation.
   * Implanter uniquement pour les services qui participent au tick (ex. StateMachineService).
   */
  advance?(sec: number): void

  /**
   * Liberation des ressources.
   * Appele automatiquement sur destroy() du composant.
   */
  destroy?(): void
}
```

#### Distinction services CodPlay / services internes

| | Services CodPlay (`ServiceInstance`) | Services internes (`ComponentServiceBase`) |
|---|---|---|
| Enregistrement | registry global (`codplay.service.register`) | instance privee cree dans `init()` |
| Portee | singleton de session, partage entre tous les composants | par instance de composant |
| Cible | noeud DOM (`apply(node, value)`) | API bibliotheque (`apply(value)`) |
| Dispatch | `this.services.apply(node, action)` | `this._addService(s)` → automatique |

---

### Infrastructure de dispatch dans le composant base

`RiveBaseComponent` maintient la liste de ses services internes et codifie les appels vers eux dans le cycle de vie. Le composant specialise enregistre ses services via `_addService()` dans `init()`.

```ts
class RiveBaseComponent extends BaseComponent {
  // ...
  protected readonly _services: ComponentServiceBase[] = []

  protected _addService(service: ComponentServiceBase): void {
    this._services.push(service)
  }

  // Avance tous les services avec advance() dans l'ordre d'enregistrement,
  // PUIS avance l'artboard. Aucune surcharge necessaire dans les sous-classes.
  protected _doAdvance(sec: number): void {
    for (const s of this._services) s.advance?.(sec)
    this._riveCtx!.artboard.advance(sec)
  }

  // Reset automatique de tous les services enregistres.
  protected _resetServices(): void {
    for (const s of this._services) s.reset()
  }

  _stop(): void {
    this._resetServices()
    for (const s of this._services) s.destroy?.()
    this._services.length = 0
    this._riveCtx = null
  }
}
```

Points cles :
- `_doAdvance` avance les services **avant** l'artboard — automatiquement, sans surcharge.
- `_resetServices` couvre stop et seek-reset — automatiquement.
- `update()` reste explicite : le composant specialise sait quelles cles d'action correspondent a quels services.

---

### StateMachineService — service de capacite avec tick

```ts
class StateMachineService extends ComponentServiceBase {
  private readonly smInstance: StateMachineInstance

  constructor(ctx: RiveContext, stateMachineName: string) {
    super()
    const smRef = ctx.artboard.stateMachineByName(stateMachineName)
    if (!smRef) throw new Error(`[rive] state machine "${stateMachineName}" introuvable`)
    this.smInstance = new ctx.runtime.StateMachineInstance(smRef, ctx.artboard)
  }

  // Participe au tick : avance la SM avant l'artboard (via _doAdvance automatique).
  override advance(sec: number): void {
    this.smInstance.advance(sec)
  }

  // apply() non utilise : SM n'est pas pilotee par des cles d'action directes.
  apply(_value: unknown): void {}

  getInput(name: string): SMIInput | null {
    const count = this.smInstance.inputCount()
    for (let i = 0; i < count; i++) {
      const inp = this.smInstance.input(i)
      if (inp.name === name) return inp.asNumber()
    }
    return null
  }
}
```

---

### VisemeLipSyncService — service d'input

```ts
class VisemeLipSyncService extends ComponentServiceBase {
  constructor(private readonly input: SMIInput) { super() }

  override apply(value: unknown): void {
    const name = typeof value === 'string' ? value : null
    this.input.value = name !== null ? (VISEME_TO_RIVE_ID[name] ?? 0) : 0
  }

  override reset(): void {
    this.input.value = 0
  }
}
```

Recoit un `SMIInput` (obtenu via `StateMachineService.getInput()`). Aucune dependance au DOM ni a l'artboard.

---

### CoachRiveComponent — composant specialise complet

```ts
class CoachRiveComponent extends RiveBaseComponent {
  private _lipSync!: VisemeLipSyncService
  private _emotion?: EmotionService

  init(): void {
    super.init()   // artboard initialise, _riveCtx disponible

    const initial = this.perso.initial as CoachRiveInitial

    // StateMachineService : enregistre pour avancement automatique dans _doAdvance
    const sm = new StateMachineService(this._riveCtx!, initial.stateMachine)
    this._addService(sm)

    // Services d'input : enregistres pour reset automatique dans _stop/_seek
    this._lipSync = new VisemeLipSyncService(sm.getInput('lips sync id')!)
    this._addService(this._lipSync)

    const emotionInput = sm.getInput('emotion')
    if (emotionInput) {
      this._emotion = new EmotionService(emotionInput)
      this._addService(this._emotion)
    }
  }

  // Dispatch explicite : chaque cle d'action est routee vers son service.
  update(input: RuntimeComponentUpdateInput): void {
    super.update(input)
    const action = input.action as CoachRiveActionPayload
    if ((action.broadcast as { type?: string } | undefined)?.type === 'STOP') {
      this._resetServices()   // reset automatise depuis la base
      return
    }
    if ('viseme'  in action) this._lipSync.apply(action['viseme'])
    if ('emotion' in action) this._emotion?.apply(action['emotion'])
  }
}
```

`_doAdvance` n'est pas surcharge : l'avancement de la SM se produit automatiquement parce que `StateMachineService.advance()` est enregistre via `_addService()`.

---

### Registration dans la factory

```ts
export function createRiveBinding(): ThirdPartyBinding {
  const instances: RiveBaseComponent[] = []

  class RiveComponent extends RiveBaseComponent {
    override _init(): void { super._init(); instances.push(this) }
  }
  // CoachRiveComponent herite de _init() via RiveBaseComponent
  // → pousse aussi dans instances

  const renderAdapter: RenderAdapter = {
    tick:       (info) => instances.forEach(c => c._tick(info)),
    seek:       (info) => instances.forEach(c => c._seek(info)),
    rateChange: (rate) => instances.forEach(c => c.setRate(rate)),
    stop:       ()     => {
      instances.forEach(c => c._stop())
      instances.length = 0
    },
  }

  return {
    components: { 'rive': RiveComponent, 'avatar-rive': CoachRiveComponent },
    renderAdapter,
    preload: [{ type: 'rive', load: loadRiveResource }],
  }
}

---

## Regles V1

- chaque bibliotheque tierce s'integre via un `ThirdPartyBinding` : objet unique qui declare les composants, le renderAdapter, les services et la strategie de preload ; pas de registration fragmentee separee
- `ThirdPartyBinding` est retourne par une factory function (closure) ; pas de classe de base a etendre pour le binding lui-meme ; la factory est la forme canonique
- `CreatePlayerOptions.bindings` est le seul point d'entree pour les bibliotheques tierces ; `components` et `renderAdapters` restent pour usage interne ou transition
- `setup()` retourne `ThirdPartyBinding | ThirdPartyBinding[]` — pas un objet ad-hoc `{ components, renderAdapters }`
- chaque composant tierce partie definit et exporte des types TypeScript pour `initial`, `emit` et `actions` ; ces types sont la reunion des cles apportees par les services declares et des cles specifiques a la bibliotheque ; ce sont les services et les capacites du composant qui definissent ces types
- aucune bibliotheque tierce ne lance son propre RAF ; CodPlay est le seul producteur de frames
- tout chargement de ressource passe par une strategie preload enregistree dans le module preload CodPlay ; aucun fetch dans `render()`, `init()`, ou le constructeur
- "API de preload propriétaire par bibliotheque" n'est jamais la reponse ; la reponse est toujours : un adapter de strategie dans l'infrastructure preload CodPlay
- une strategie de preload par bibliotheque distingue le chargement singleton de la bibliotheque (WASM/JS, une fois par session) et le chargement par URL de la ressource (cache par entree)
- `init()` peut supposer que `perso.initial.src` est disponible dans le cache preload ; l'acces est synchrone
- `render()` cree uniquement le noeud DOM conteneur ; aucune initialisation bibliotheque dans `render()`
- les parametres de configuration bibliotheque (artboard, stateMachine, speed...) sont lus depuis `perso.initial` dans `init()` ; une propriete peut correspondre a un appel de methode bibliotheque
- la factory pattern est obligatoire : composant et RenderAdapter sont crees ensemble dans la meme closure ; aucun etat statique sur la classe
- un seul RenderAdapter par bibliotheque ; il aggrege toutes les instances du composant base de cette bibliotheque via la factory closure
- le hub vide ses instances dans `stop()` ; un `player.init()` subsequent les re-enregistre via `_init()`
- pour les moteurs sans multiplicateur natif : pattern `_rate` local + `rateChange` obligatoire ; interdiction de combiner `timelineDeltaMs` et `rateChange` dans le meme adapter
- le composant base gere uniquement les capacites universelles de la bibliotheque (artboard + tick + seek pour Rive, animation + play/pause/seek pour Lottie) ; toute capacite specifique a un fichier ou a un usage (state machine, animation nommee, input SMI, segment, layer...) est un service interne
- tout service interne etend `ComponentServiceBase` (exporte par `codplay`) ; la classe de base codifie les appels `apply / reset / advance / destroy` ; le composant specialise ne surcharge pas `_doAdvance` — il enregistre ses services via `_addService()` et le dispatch vers `advance?()` est automatique
- `_doAdvance()` dans le composant base appelle `s.advance?.(sec)` sur tous les services enregistres dans l'ordre, puis avance l'artboard ; l'ordre est garanti par l'ordre d'appel a `_addService()` dans `init()`
- `_stop()` dans le composant base appelle `_resetServices()` puis `s.destroy?.()` sur chaque service enregistre ; le composant specialise n'a pas besoin de gestion manuelle de ses services
- les services internes (lipsync, emotion, gesture...) sont des instances privees crees dans `init()` du composant specialise et enregistrees via `_addService()` ; ils ne sont pas enregistres dans le service registry global
- ordre garanti de mise en place : `setup()` → preload → `player.init()` → `render()` → `init()` ; tout acces bibliotheque avant `init()` est interdit

---

## References

- `v1-component-api.md` — contrat BaseComponent, render(), init(), update(), services
- `v1-preload-api.md` — cache de session, modes author/broadcast, strategies par type
- `v1-rate-spec.md` — propagation rate, pattern RenderAdapter, regles deltaMs vs timelineDeltaMs
- `v1-render-adapter-spec.md` (a creer si la surface RenderAdapter justifie une spec dediee)

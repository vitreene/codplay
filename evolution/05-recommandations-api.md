# Recommandations API - Engine V1

## 1) Objectif

Definir une API exploitable:

- par un script externe
- par un strap
- par l'editeur

L'API couvre:

- tracks
- creation d'events user
- scenario
- creation stories/items
- pilotage player (`init`, `play`, `pause`, `seek`, `rewind`)
- lecture des machines d'etat et traces

Reference events techniques:

- `evolution/09-catalogue-events-techniques-v1.md`

## 2) Principes de design

- API compacte, basee sur les concepts metier
- noms de methodes en anglais, stables
- meme API en mode player et debug
- resultats explicites (`ok`, `error`, `data`)
- permissions claires pour les straps

## 3) Surface API proposee

```ts
type PlayerState = 'idle' | 'preloading' | 'ready' | 'playing' | 'paused' | 'seeking' | 'rewinding' | 'error'
type StoryState = 'idle' | 'ready' | 'playing' | 'paused' | 'ended' | 'error'
type PlayableState = 'idle' | 'playing' | 'paused' | 'ended' | 'error'

type StoryRef = { storyId: string; instanceId?: string }
type ItemRef = { runtimeItemId: string }
type PlayableRef =
  | { kind: 'story'; storyRef: StoryRef }
  | { kind: 'item'; itemRef: ItemRef }
  | { kind: 'media'; itemRef: ItemRef }

type EventHandler = (event: TimelineEvent) => void
type Unsubscribe = () => void

type MachineRef =
  | { machine: 'player'; id: 'player' }
  | { machine: 'scenario'; id: string }
  | { machine: 'story'; id: string }
  | { machine: 'playable'; id: string }

type TraceFilter = {
  machine?: 'player' | 'scenario' | 'story' | 'playable'
  id?: string
  status?: 'APPLIED' | 'REJECTED'
  eventPrefix?: string
  reason?: string
  fromMs?: number
  toMs?: number
  correlationId?: string
  limit?: number
}

type EngineApi = {
  player: PlayerApi
  track: TrackApi
  event: EventApi
  scenario: ScenarioApi
  story: StoryApi
  item: ItemApi
  machine: MachineApi
  debug: DebugApi
  editor: EditorApi
}
```

## 4) API de pilotage player

```ts
type RebuildMode = 'state' | 'full'

type RuntimePolicy = {
  allowedRebuildModes: RebuildMode[]
  defaultRebuildMode: RebuildMode
  sceneMutability: 'mutable' | 'immutable'
}

type InitOptions = {
  mode?: 'editor' | 'player' | 'debug'
  runtimePolicy?: RuntimePolicy
  createElement?: CreateElement
}

type PlayerApi = {
  init: (scene: SceneDoc, options?: InitOptions) => Result<void>
  revert: () => Result<void>
  destroy: () => Result<void>
  play: () => Result<void>
  pause: () => Result<void>
  stop: () => Result<void>
  rebuild: (options: { mode: RebuildMode; reason?: string }) => Result<void>
  seek: (ms: number, options?: { rebuild?: RebuildMode }) => Result<void>
  rewind: (options?: { rebuild?: RebuildMode }) => Result<void>
  setRate: (rate: number) => Result<void>
  getState: () => PlayerState
  getRuntimeRevision: () => number
  getTimelineElapsedMs: () => number
  getSessionElapsedMs: () => number
}
```

Notes:

- `init` detruit l'etat precedent puis recharge une scene
- `revert` revient a l'etat initial sans destroy complet
- `seek` / `rewind`: `rebuild='state'` par defaut
- les modes rebuild autorises sont imposes par `runtimePolicy`
- en cas de mode interdit, la commande est refusee (`ok=false`)
- `rebuild='state'` conserve l'identite des nodes (`nodeRef` stable)
- `rebuild='full'` invalide les anciens `nodeRef` (nouvelle revision runtime)
- `getTimelineElapsedMs` suit le playhead timeline global (independant des stories `eventOnly`)
- `getSessionElapsedMs` inclut tout le temps reel de session

## 5) API tracks

```ts
type TrackApi = {
  add: (track: TrackDoc) => Result<void>
  remove: (trackId: string) => Result<void>
  enable: (trackId: string) => Result<void>
  disable: (trackId: string) => Result<void>
  setOrder: (trackId: string, order: number) => Result<void>
  list: () => TrackDoc[]
}
```

## 6) API events user

```ts
type RecordMode = 'finalOnly' | 'all'

type EmitOptions = {
  recordable?: boolean
  recordMode?: RecordMode
}

type EventApi = {
  emitUser: (name: string, payload?: object, options?: EmitOptions) => Result<TimelineEvent>
  recordUser: (enabled: boolean) => Result<void>
  setUserRecordMode: (mode: RecordMode) => Result<void>
  clearUserTrack: () => Result<void>
  replayUserTrack: () => Result<void>
  on: (name: string, handler: EventHandler) => Unsubscribe
}
```

Notes:

- `recordable` est explicite et `false` par defaut
- V1 recommande `recordMode='finalOnly'`

## 7) API scenario

```ts
type WaitMode = 'parallel' | 'suspendSource'

type WaitHandle = {
  waitId: string
  mode: WaitMode
  fromStory?: StoryRef
  waitStory: StoryRef
  frozenCursorMs?: number
  disabledTrackIds: string[]
}

type StartWaitOptions = {
  waitStory: StoryRef
  fromStory?: StoryRef
  mode?: WaitMode
  reason?: string
  disableTracks?: 'auto' | string[]
  hideFromStory?: boolean
  showWaitStory?: boolean
}

type ResolveWaitOptions = {
  waitId: string
  resumePolicy?: 'fromCursor' | 'fromStart'
  restoreTracks?: boolean
  hideWaitStory?: boolean
  stopWaitStory?: boolean
}

type ScenarioApi = {
  startStory: (storyRef: StoryRef) => Result<void>
  stopStory: (storyRef: StoryRef) => Result<void>
  showStory: (storyRef: StoryRef) => Result<void>
  hideStory: (storyRef: StoryRef) => Result<void>
  gotoStory: (storyRef: StoryRef) => Result<void>
  getCurrentStory: () => StoryRef | null
  startWait: (options: StartWaitOptions) => Result<WaitHandle>
  resolveWait: (options: ResolveWaitOptions) => Result<void>
}
```

Notes:

- `mode='parallel'` (defaut): la story source continue a jouer pendant l'attente
- `mode='suspendSource'`: pause story source + freeze curseur + disable tracks source
- `resolveWait` restaure l'etat selon le mode du `waitId`
- `waitStory` est recommandee en `clockMode='eventOnly'`

## 8) API creation story/item

```ts
type StoryApi = {
  create: (story: StoryDoc) => Result<void>
  instantiate: (storyId: string, options?: InstanceOptions) => Result<{ instanceId: string }>
  remove: (storyRef: StoryRef) => Result<void>
  list: () => StorySummary[]
  getTiming: (storyRef: StoryRef) => Result<{
    clockMode: 'timeline' | 'eventOnly'
    storyPlayheadMs: number
    storyDurationMs?: number
  }>
}

type ItemApi = {
  create: (storyRef: StoryRef, item: ItemDoc) => Result<void>
  update: (itemRef: ItemRef, patch: Partial<ItemDoc>) => Result<void>
  remove: (itemRef: ItemRef) => Result<void>
  get: (itemRef: ItemRef) => ItemDoc | null
}
```

Notes:

- `getTiming` expose le curseur courant d'une story et sa duree propre
- pour `clockMode='eventOnly'`, `storyDurationMs` est optionnel/non pertinent

## 9) API playable (story + media)

```ts
type PlayableApi = {
  playPlayable: (ref: PlayableRef) => Result<void>
  pausePlayable: (ref: PlayableRef) => Result<void>
  seekPlayable: (ref: PlayableRef, ms: number) => Result<void>
  rewindPlayable: (ref: PlayableRef) => Result<void>
  getPlayableState: (ref: PlayableRef) => PlayableState
}
```

Notes:

- les commandes globales player restent prioritaires
- les actions media (`play/pause/seek/rewind`) passent par la meme logique d'etat

## 10) API strap

Un strap consomme un contexte restreint.

```ts
type StrapEffectApi = {
  run: <TReq = unknown, TRes = unknown>(
    name: string,
    payload?: TReq,
    options?: { timeoutMs?: number; correlationId?: string }
  ) => Promise<Result<TRes>>
}

type StrapApi = {
  now: () => number
  getItem: (itemRef: ItemRef) => ItemDoc | null
  patchItem: (itemRef: ItemRef, patch: Partial<ActionDoc>) => Result<void>
  readTrack: (trackId: string) => TrackDoc | null
  command: Pick<PlayerApi, 'play' | 'pause' | 'seek'>
  scenario: Pick<ScenarioApi, 'startWait' | 'resolveWait' | 'gotoStory' | 'stopStory'>
  effect: StrapEffectApi
}
```

Regle V1:

- strap peut piloter
- strap ne cree pas directement de nouvel event runtime
- les appels backend asynchrones passent par `effect.run(...)`
- en cas de submit form, le strap decide explicitement succes/echec et la transition scenario associee

## 11) API machine et trace

```ts
type MachineApi = {
  getPlayerState: () => PlayerState
  getScenarioState: () => 'idle' | 'running' | 'waiting' | 'error'
  getStoryState: (storyRef: StoryRef) => StoryState
  getPlayableState: (ref: PlayableRef) => PlayableState
  can: (machine: MachineRef, eventName: string) => boolean
}

type DebugApi = {
  getTick: () => { nowMs: number; prevMs: number }
  getQueue: () => TimelineEvent[]
  getTrace: (filter?: TraceFilter) => MachineTraceRow[]
  clearTrace: () => void
}
```

Reference contrat trace/debug:

- `evolution/13-contrat-trace-debug-v1.md`

Interet:

- inspection des transitions enchaines
- comprehension claire des refus (`can=false`)

## 12) API editeur (integration)

L'editeur est responsable des IDs runtime valides et du choix du mode rebuild.

```ts
type NodeRef = unknown

type EditorApi = {
  resolveNodeRef: (runtimeItemId: string) => Result<{
    nodeRef: NodeRef
    runtimeItemId: string
    runtimeRevision: number
  }>
}
```

Regles V1:

- pas de fallback d'ID cote moteur
- si `runtimeItemId` est invalide: erreur `NOT_FOUND`
- un `rebuild='state'` ne remplace pas les nodes
- un `rebuild='full'` remplace les nodes et incremente `runtimeRevision`

## 13) Contrat de resultat

```ts
type Result<T> =
  | { ok: true; data?: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } }
```

## 14) Exemples d'usage

### Script externe

```ts
api.player.init(scene, { mode: 'player' })
api.track.enable('lang-fr')
api.track.disable('lang-en')
api.player.play()

api.event.emitUser('pointer:up', { x: 120, y: 340, targetId: 'storyA#1/item12' }, { recordable: true })
api.player.seek(12000, { rebuild: 'state' })
api.player.pause()
```

### Strap

```ts
function onPointerUp(data, api: StrapApi) {
  // Le strap met a jour un item sans emettre un nouvel event runtime.
  api.patchItem('hud#1/cursorLabel', { payload: { x: data.x, y: data.y } })
}
```

### Editeur

```ts
const ref = api.editor.resolveNodeRef('storyA#1/item12')

if (ref.ok) {
  // nodeRef stable tant que runtimeRevision ne change pas.
  focusInspectorOnNode(ref.data.nodeRef)
}

api.player.rebuild({ mode: 'full', reason: 'scene-structure-updated' })
```

### Story d'attente (click -> attente -> retour)

```ts
const wait = api.scenario.startWait({
  waitStory: { storyId: 'story-wait', instanceId: 'story-wait#1' },
  fromStory: { storyId: 'story-main', instanceId: 'story-main#1' },
  mode: 'parallel',
  reason: 'await-user-confirmation',
  showWaitStory: true
})

if (wait.ok) {
  // ... plus tard, sur click de confirmation
  api.scenario.resolveWait({ waitId: wait.data.waitId, resumePolicy: 'fromCursor' })
}
```

### Form submit backend via strap

```ts
async function onSubmitForm(formValue, api: StrapApi, waitId: string) {
  const res = await api.effect.run('form.submit', { value: formValue }, { timeoutMs: 8000 })

  if (!res.ok) {
    api.patchItem('story-wait#1/formError', { payload: { message: 'Echec enregistrement' } })
    return
  }

  // Fin de la story d'attente puis poursuite narrative.
  api.scenario.resolveWait({ waitId })
  api.scenario.gotoStory({ storyId: 'story-next', instanceId: 'story-next#1' })
}
```

## 15) Convertisseur legacy (hors runtime)

La conversion legacy (`persos` + `eventtimes`) est un outil externe.

Regles API:

- pas de mode `legacy` dans `player.init`
- le runtime accepte uniquement `SceneDoc`
- la conversion est faite avant appel a `player.init`

Contrat minimal recommande:

```ts
type LegacyConverterApi = {
  convert: (input: LegacyInput) => Result<{ scene: SceneDoc; warnings: ConversionWarning[] }>
}
```

Reference de mapping:

- `evolution/07-compat-legacy-convertisseur-v1.md`

## 16) Suggestions de libs (facultatives)

Hors animejs, aucune dependance obligatoire.

Options utiles:

- `zod`: valider les payloads d'API et schemas scene
- `eventemitter3`: bus d'events leger

Ces libs restent facultatives et ne doivent pas imposer le design.

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createActor, type Actor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { createDecorEditorBridge, PHASE_IDLE_FLUSH_MS } from '../src/app/bridges/decor-editor-bridge'
import type { EditorScene } from '../src/app/commands/types'
import type { AuthorApi } from '@codplay/selection-frame'
import type { OffsetEditorBridge, OffsetPatch, OffsetValuesPx } from '../src/decor-editor/types'
import { createDecorLiveSession } from '../src/decor-editor/decor-live-session'

/**
 * `2026-07-17-phase-commit-selection-recovery-plan.md` §Étape B — invariants A2/A3 de la charte
 * des acquis : aucun `RUN_TRANSACTION` tant qu'aucun signal de fin de phase n'est survenu (jamais
 * un minuteur court réarmé à chaque micro-geste), un seul commit par phase quelle que soit son
 * origine (geste CS, palette, ou une combinaison des deux). Exercé via `createDecorEditorBridge`
 * réel — pas une réimplémentation de sa logique — pilotée par le pont offset (le seul canal qui ne
 * nécessite pas de faire interagir du DOM de palette rendu).
 */

/**
 * Deux keyframes du MÊME item référençant le MÊME `decorId` — reproduit `KEYFRAME.ADD`'s héritage
 * délibéré du décor voisin (`2026-06-11-sequence-editor-grid-spec.md` §2.3), le point de départ du
 * bug de partage (2026-07-17) : éditer kf-2 ne doit jamais muter le décor que kf-1 lit aussi.
 */
function sceneWithSharedKeyframeDecor(): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Fixture', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [
      {
        id: 'item-1',
        type: 'text',
        parentId: null,
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-shared',
        keyframes: [
          { id: 'kf-1', timeMs: 0, decorId: 'decor-shared' },
          { id: 'kf-2', timeMs: 1000, decorId: 'decor-shared' },
        ],
      },
    ],
    contents: {},
    decors: { 'decor-shared': { id: 'decor-shared', style: { 'background-color': 'red' } } },
    zones: {},
    markerTracks: {},
  }
}

function sceneWithTwoItems(): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Fixture', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [
      { id: 'item-1', type: 'text', parentId: null, order: 'a0', visible: true, contentId: null, initialDecorId: 'decor-1', keyframes: [] },
      { id: 'item-2', type: 'text', parentId: null, order: 'a1', visible: true, contentId: null, initialDecorId: 'decor-2', keyframes: [] },
    ],
    contents: {},
    decors: { 'decor-1': { id: 'decor-1' }, 'decor-2': { id: 'decor-2' } },
    zones: {},
    markerTracks: {},
  }
}

function fakeAuthorApi(): AuthorApi {
  return {
    subscribeToNode: () => () => {},
    getNodePose: () => null,
    setNodePose: () => {},
    getNodeSnapshot: () => null,
    getPersoStates: () => new Map(),
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
  }
}

/**
 * `subscribeToNode` réel (pas un no-op) — un node par `itemId`, remplaçable via `setNode` pour
 * simuler le remplacement de node d'un rebuild (§Étape "playing", `scene-player-bridge.ts` en
 * fait un inconditionnel à l'entrée en lecture). Appel immédiat au branchement (contrat de la spec
 * `v1-author-api-spec.md`), comme `subscribeToNode` réel.
 */
function fakeAuthorApiWithNodes(
  snapshots: Record<string, Record<string, string>> = {},
): AuthorApi & { nodeFor: (itemId: string) => HTMLElement; setNode: (itemId: string, node: HTMLElement) => void } {
  const nodes = new Map<string, HTMLElement>()
  const listeners = new Map<string, Set<(node: Element | null) => void>>()
  function nodeFor(itemId: string): HTMLElement {
    let node = nodes.get(itemId)
    if (!node) {
      node = document.createElement('div')
      nodes.set(itemId, node)
    }
    return node
  }
  return {
    subscribeToNode: (itemId, cb) => {
      cb(nodeFor(itemId))
      let set = listeners.get(itemId)
      if (!set) {
        set = new Set()
        listeners.set(itemId, set)
      }
      set.add(cb)
      return () => set!.delete(cb)
    },
    getNodePose: () => null,
    setNodePose: () => {},
    getNodeSnapshot: (itemId, props) => {
      const values = snapshots[itemId]
      if (!values) return null
      const result: Record<string, string> = {}
      for (const prop of props) if (values[prop] !== undefined) result[prop] = values[prop]!
      return result
    },
    getPersoStates: () => new Map(Object.entries(snapshots)),
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
    nodeFor,
    setNode: (itemId, node) => {
      nodes.set(itemId, node)
      for (const cb of listeners.get(itemId) ?? []) cb(node)
    },
  }
}

type FakeOffsetBridge = OffsetEditorBridge & {
  emitValues: (v: OffsetValuesPx) => void
  setGestureActive: (active: boolean) => void
  emitCommit: (kind: 'move' | 'resize' | 'rotate' | 'scale') => void
}

/** 100px de large : `pxToCqw(px, 100) === px` — conversion identité, assertions lisibles directement en px. */
function fakeOffsetBridge(containerWidthPx = 100): FakeOffsetBridge {
  const valueListeners = new Set<(v: OffsetValuesPx) => void>()
  const gestureListeners = new Set<(active: boolean) => void>()
  const commitListeners = new Set<(kind: 'move' | 'resize' | 'rotate' | 'scale') => void>()
  let gestureActive = false
  // Vraie session, pas une fausse — exerce le même canal §2/§4 que le pont réel plutôt que d'en
  // simuler une version parallèle (2026-07-25-decor-unified-channel-plan.md).
  const liveSession = createDecorLiveSession()
  return {
    activate() {},
    deactivate() {},
    apply() {},
    onValues(cb) {
      valueListeners.add(cb)
      return () => valueListeners.delete(cb)
    },
    containerRefWidthPx: () => containerWidthPx,
    isGestureActive: () => gestureActive,
    onGestureActiveChange(cb) {
      gestureListeners.add(cb)
      return () => gestureListeners.delete(cb)
    },
    onCommit(cb) {
      commitListeners.add(cb)
      return () => commitListeners.delete(cb)
    },
    getLiveSession() {
      return liveSession
    },
    emitValues(v) {
      for (const cb of valueListeners) cb(v)
      // `containerWidthPx = 100` par défaut : conversion px→cqw identité (cf commentaire de
      // `fakeOffsetBridge`), donc `v` (px) réutilisable tel quel comme `OffsetPatch` (cqw) — même
      // forme de champs des deux côtés, seules les unités diffèrent numériquement en général.
      liveSession.reportValues({ offset: v as OffsetPatch })
    },
    setGestureActive(active) {
      gestureActive = active
      for (const cb of gestureListeners) cb(active)
    },
    emitCommit(kind) {
      for (const cb of commitListeners) cb(kind)
      liveSession.commit()
    },
  }
}

/** Compte les vraies mutations du document (`RUN_COMMAND`/`RUN_TRANSACTION`) — un changement de sélection seul ne change jamais la référence `context.scene`. */
function countSceneCommits(actor: Actor<typeof controllerMachine>): () => number {
  let count = 0
  let last = actor.getSnapshot().context.scene
  actor.subscribe((snap) => {
    if (snap.context.scene !== last) {
      count++
      last = snap.context.scene
    }
  })
  return () => count
}

function setup() {
  const actor = createActor(controllerMachine)
  actor.start()
  const container = document.createElement('div')
  const bridge = createDecorEditorBridge(container, actor)
  const offsetBridge = fakeOffsetBridge()
  actor.send({ type: 'PLAYER_READY', authorApi: fakeAuthorApi(), referenceWidthPx: 100, offsetBridge })
  actor.send({ type: 'SCENE_LOADED', scene: sceneWithTwoItems() })
  actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
  return { actor, bridge, offsetBridge }
}

function committedOffset(actor: Actor<typeof controllerMachine>, decorId: string) {
  return actor.getSnapshot().context.scene?.decors[decorId]?.offset
}

/** cqw = px avec un conteneur à 100px (§`fakeOffsetBridge`), mais la division flottante laisse un résidu — comparer par composante. */
function expectTranslate(actual: { x: number; y: number } | undefined, x: number, y: number): void {
  expect(actual?.x).toBeCloseTo(x)
  expect(actual?.y).toBeCloseTo(y)
}

describe('decor-editor-bridge — commit de fin de phase (§Étape B)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
  })

  it('une rafale de valeurs ne committe rien tant qu\'aucun signal de fin de phase ne survient', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 5, y: 5 } })
    offsetBridge.emitValues({ translate: { x: 10, y: 10 } })
    offsetBridge.emitValues({ translate: { x: 15, y: 15 } })
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS - 1)
    expect(committedOffset(actor, 'decor-1')).toBeUndefined()
  })

  it('signal 4 — inactivité longue committe après PHASE_IDLE_FLUSH_MS', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 42, y: 7 } })
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS)
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 42, 7)
  })

  it('signal 1 — changement de sélection committe immédiatement, sans attendre le minuteur', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 1, y: 2 } })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-2'] })
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 1, 2)
  })

  it('signal 1 — CLEAR_SELECTION committe immédiatement', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 3, y: 4 } })
    actor.send({ type: 'CLEAR_SELECTION' })
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 3, 4)
  })

  it('signal 3 — seek committe immédiatement', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 8, y: 9 } })
    actor.send({ type: 'SEEK', timelineMs: 1000 })
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 8, 9)
  })

  it('signal 5 — une mutation externe du document pendant une phase en attente déclenche son flush', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 11, y: 12 } })
    // Mutation externe : un autre module (ex. sequence-editor) commit un décor SANS rapport avec la
    // phase en cours — le patch en attente sur decor-1 doit se committer par la même occasion.
    actor.send({ type: 'RUN_COMMAND', command: { name: 'setDecor', args: { decorId: 'decor-2', patch: { style: { color: 'red' } } } } })
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 11, 12)
  })

  it('signal 6 — Échap (clavier réel) jette le patch en attente, aucun commit même après le minuteur d\'inactivité', () => {
    // `PHASE_ABORT` seul (envoyé directement à la machine) ne suffit pas à reproduire ce signal :
    // c'est `abortPhase()` — déclenché par le VRAI `keydown` Échap, en phase de capture sur
    // `document` — qui vide `pendingCommands` avant d'émettre `PHASE_ABORT`. Un `actor.send`
    // direct saute cette étape locale et ne teste rien d'utile.
    const { actor, offsetBridge } = setup()
    offsetBridge.emitValues({ translate: { x: 99, y: 99 } })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS)
    expect(committedOffset(actor, 'decor-1')).toBeUndefined()
  })

  it('un geste actif bloque le flush même si le minuteur d\'inactivité expire', () => {
    const { actor, offsetBridge } = setup()
    offsetBridge.setGestureActive(true)
    offsetBridge.emitValues({ translate: { x: 1, y: 1 } })
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS * 2)
    expect(committedOffset(actor, 'decor-1')).toBeUndefined()
    offsetBridge.setGestureActive(false)
    // `onCommit` — message explicite de fin de geste (§7 de l'étude pose-edit) : c'est lui, pas
    // `setGestureActive(false)` seul, qui arme le flush en production (`selection-frame.ts`'s
    // `onEnd` appelle `syncTrackedGestureEnd` PUIS `adapter.onCommit`).
    offsetBridge.emitCommit('move')
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS)
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 1, 1)
  })

  it('resize→rotate→move enchaînés (fins de geste répétées) ne produisent qu\'un seul commit', () => {
    const { actor, offsetBridge } = setup()
    const commits = countSceneCommits(actor)

    offsetBridge.setGestureActive(true)
    offsetBridge.emitValues({ width: 100, height: 50 })
    offsetBridge.setGestureActive(false) // fin resize
    vi.advanceTimersByTime(200)

    offsetBridge.setGestureActive(true)
    offsetBridge.emitValues({ width: 100, height: 50, rotate: 30 })
    offsetBridge.setGestureActive(false) // fin rotate
    vi.advanceTimersByTime(200)

    offsetBridge.setGestureActive(true)
    offsetBridge.emitValues({ width: 100, height: 50, rotate: 30, translate: { x: 20, y: 20 } })
    offsetBridge.setGestureActive(false) // fin move
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS)

    expect(commits()).toBe(1)
    expectTranslate(committedOffset(actor, 'decor-1')?.translate, 20, 20)
  })
})

describe('decor-editor-bridge — copy-on-write sur décor partagé entre keyframes (2026-07-17)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('éditer le fond de kf-2 (décor partagé avec kf-1) fork un nouveau décor — kf-1 reste inchangé', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    const container = document.createElement('div')
    createDecorEditorBridge(container, actor)
    actor.send({ type: 'PLAYER_READY', authorApi: fakeAuthorApi(), referenceWidthPx: 100, offsetBridge: fakeOffsetBridge() })
    actor.send({ type: 'SCENE_LOADED', scene: sceneWithSharedKeyframeDecor() })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })

    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    colorInput.value = '#0000ff'
    colorInput.dispatchEvent(new Event('input', { bubbles: true }))
    colorInput.dispatchEvent(new Event('change', { bubbles: true }))
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS)

    const scene = actor.getSnapshot().context.scene!
    const item = scene.items[0]!
    const kf1DecorId = item.keyframes.find((k) => k.id === 'kf-1')!.decorId
    const kf2DecorId = item.keyframes.find((k) => k.id === 'kf-2')!.decorId

    expect(kf1DecorId).toBe('decor-shared')
    expect(kf2DecorId).not.toBe('decor-shared')
    expect(scene.decors['decor-shared']?.style?.['background-color']).toBe('red')
    expect(scene.decors[kf2DecorId]?.style?.['background-color']).not.toBe('red')
  })
})

/**
 * Deux keyframes du MÊME item avec des `decorId` INDÉPENDANTS dès la création (`kf-2` vide) —
 * pour exercer la cascade de lecture (`2026-07-17-decor-keyframe-layering-plan.md` §3),
 * indépendamment du fork-à-l'écriture testé ci-dessus.
 */
function sceneWithIndependentKeyframeDecors(): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Fixture', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [
      {
        id: 'item-1',
        type: 'text',
        parentId: null,
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-initial',
        keyframes: [
          { id: 'kf-1', timeMs: 0, decorId: 'decor-kf1' },
          { id: 'kf-2', timeMs: 1000, decorId: 'decor-kf2' },
        ],
      },
    ],
    contents: {},
    decors: {
      'decor-initial': { id: 'decor-initial' },
      // Format `oklch(...)` — celui que le picker natif écrit réellement (`hexToCssOklch`,
      // `color-adapter.ts`) ; `toHexForPicker` (render.ts:239) ne reconnaît QUE ce format via une
      // regex stricte, un simple nom de couleur CSS ('red') retomberait sur le gris par défaut.
      'decor-kf1': { id: 'decor-kf1', style: { 'background-color': 'oklch(0.63 0.26 29.2)' } },
      'decor-kf2': { id: 'decor-kf2' },
    },
    zones: {},
    markerTracks: {},
  }
}

describe('decor-editor-bridge — cascade en direct à la lecture (2026-07-17)', () => {
  function mount(scene: EditorScene) {
    const actor = createActor(controllerMachine)
    actor.start()
    const container = document.createElement('div')
    createDecorEditorBridge(container, actor)
    actor.send({ type: 'PLAYER_READY', authorApi: fakeAuthorApi(), referenceWidthPx: 100, offsetBridge: fakeOffsetBridge() })
    actor.send({ type: 'SCENE_LOADED', scene })
    return { actor, container }
  }

  it('un keyframe jamais retouché (kf-2) affiche la couleur du keyframe précédent (kf-1), pas un défaut vide', () => {
    const { actor, container } = mount(sceneWithIndependentKeyframeDecors())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })

    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    expect(colorInput.value.toLowerCase()).not.toBe('#808080')
  })

  it('une édition faite APRÈS COUP sur kf-1 (un border qu\'il n\'avait pas) apparaît en resélectionnant kf-2, jamais figée à la création de kf-2', () => {
    const { actor, container } = mount(sceneWithIndependentKeyframeDecors())

    // Édite kf-1 après que kf-2 existe déjà — répro exacte de l'auteur (2026-07-17).
    actor.send({
      type: 'RUN_COMMAND',
      command: { name: 'setDecor', args: { decorId: 'decor-kf1', patch: { style: { 'border-color': 'oklch(0.85 0.15 195)' } } } },
    })

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })
    const borderInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[1]!
    expect(borderInput.value.toLowerCase()).not.toBe('#808080')
  })

  it('sans keyframe sélectionné mais playhead aligné sur kf1 (t=0), affiche kf1 — pas le décor initial brut (2026-07-18)', () => {
    // Avant ce chantier, "pas de kf sélectionné" retombait toujours sur `initialDecorId` brut,
    // même quand la tête de lecture coïncidait avec kf1 — bug confirmé en direct (item avec kf1
    // rouge, sélectionner l'item sans kf affichait le gris par défaut du décor initial vide).
    // `initialDecorId ≈ kf1` (`2026-07-17-resolved-state-at-time-notes.md`) : à t=0, l'alignement
    // résout maintenant vers la cascade de kf1, pas vers `initialDecorId` seul.
    const { actor, container } = mount(sceneWithIndependentKeyframeDecors())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    expect(colorInput.value.toLowerCase()).not.toBe('#808080')
  })

  it('sans keyframe sélectionné et AUCUN keyframe à t=0 (avant le premier kf), le décor initial de l\'item seul reste affiché', () => {
    const scene = sceneWithIndependentKeyframeDecors()
    // kf1 déplacé après t=0 — la tête (0 par défaut) tombe maintenant AVANT le premier keyframe.
    scene.items[0]!.keyframes[0]!.timeMs = 500
    const { actor, container } = mount(scene)
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    expect(colorInput.value.toLowerCase()).toBe('#808080')
  })
})

/** Répro directe du bug d'origine (2026-07-17) : deux kf, couleurs différentes. */
function sceneWithTwoColoredKeyframes(): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Fixture', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [
      {
        id: 'item-1',
        type: 'text',
        parentId: null,
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-initial',
        keyframes: [
          { id: 'kf-1', timeMs: 0, decorId: 'decor-kf1' },
          { id: 'kf-2', timeMs: 5000, decorId: 'decor-kf2' },
        ],
      },
    ],
    contents: {},
    decors: {
      'decor-initial': { id: 'decor-initial' },
      'decor-kf1': { id: 'decor-kf1', style: { 'background-color': 'red' } },
      'decor-kf2': { id: 'decor-kf2', style: { 'background-color': 'blue' } },
    },
    zones: {},
    markerTracks: {},
  }
}

describe('decor-editor-bridge — état playing (2026-07-17-play-mode-decor-editor-deactivation-plan)', () => {
  function mountWithNodes(scene: EditorScene) {
    const actor = createActor(controllerMachine)
    actor.start()
    const container = document.createElement('div')
    createDecorEditorBridge(container, actor)
    const authorApi = fakeAuthorApiWithNodes()
    actor.send({ type: 'PLAYER_READY', authorApi, referenceWidthPx: 100, offsetBridge: fakeOffsetBridge() })
    actor.send({ type: 'SCENE_LOADED', scene })
    return { actor, authorApi }
  }

  it('la preview live écrit bien sur le node à la sélection (comportement de référence, avant tout play)', () => {
    const { actor, authorApi } = mountWithNodes(sceneWithTwoColoredKeyframes())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })

    expect(authorApi.nodeFor('item-1').style.getPropertyValue('background-color')).toBe('blue')
  })

  it('TELCO_ACTION_REQUEST (entrée en lecture) suspend l\'écriture — même quand le rebuild forcé remonte un node flambant neuf', () => {
    const { actor, authorApi } = mountWithNodes(sceneWithTwoColoredKeyframes())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })
    expect(authorApi.nodeFor('item-1').style.getPropertyValue('background-color')).toBe('blue')

    actor.send({ type: 'TELCO_ACTION_REQUEST' })
    expect(actor.getSnapshot().value).toBe('playing')

    // Simule le rebuild inconditionnel de `scene-player-bridge.ts` à l'entrée en lecture — le node
    // est remplacé, `subscribeToNode` renotifie ; sans le gel, `applyResolvedDecor` réécrirait
    // aussitôt la couleur du kf sélectionné dessus (c'est exactement le bug d'origine).
    const freshNode = document.createElement('div')
    authorApi.setNode('item-1', freshNode)

    expect(freshNode.style.getPropertyValue('background-color')).toBe('')
  })

  it('TELCO_PAUSE_REQUEST reprend la lecture — réapplique la preview sur le node courant', () => {
    const { actor, authorApi } = mountWithNodes(sceneWithTwoColoredKeyframes())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })
    actor.send({ type: 'TELCO_ACTION_REQUEST' })
    const freshNode = document.createElement('div')
    authorApi.setNode('item-1', freshNode)
    expect(freshNode.style.getPropertyValue('background-color')).toBe('')

    actor.send({ type: 'TELCO_PAUSE_REQUEST' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(freshNode.style.getPropertyValue('background-color')).toBe('blue')
  })

  it('SEEK (Stop) pendant la lecture reprend aussi la preview sur le node courant', () => {
    const { actor, authorApi } = mountWithNodes(sceneWithTwoColoredKeyframes())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })
    actor.send({ type: 'TELCO_ACTION_REQUEST' })
    const freshNode = document.createElement('div')
    authorApi.setNode('item-1', freshNode)
    expect(freshNode.style.getPropertyValue('background-color')).toBe('')

    actor.send({ type: 'SEEK', timelineMs: 0 })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(freshNode.style.getPropertyValue('background-color')).toBe('blue')
  })

  it('Échap pendant la lecture ne committe rien et ne lève pas (garde, §4 du plan)', () => {
    const { actor } = mountWithNodes(sceneWithTwoColoredKeyframes())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-2' })
    actor.send({ type: 'TELCO_ACTION_REQUEST' })
    const scene = actor.getSnapshot().context.scene

    expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))).not.toThrow()
    expect(actor.getSnapshot().context.scene).toBe(scene)
  })
})

/** Deux kf avec un vrai écart entre eux (0 → 1000ms) — pour situer un playhead STRICTEMENT entre les deux. */
function sceneWithGapBetweenKeyframes(): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Fixture', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items: [
      {
        id: 'item-1',
        type: 'text',
        parentId: null,
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-initial',
        keyframes: [
          { id: 'kf-1', timeMs: 0, decorId: 'decor-kf1' },
          { id: 'kf-2', timeMs: 1000, decorId: 'decor-kf2' },
        ],
      },
    ],
    contents: {},
    decors: {
      'decor-initial': { id: 'decor-initial' },
      'decor-kf1': { id: 'decor-kf1', style: { 'background-color': 'oklch(0.6 0.24 25)' } },
      'decor-kf2': { id: 'decor-kf2', style: { 'background-color': 'oklch(0.6 0.24 260)' } },
    },
    zones: {},
    markerTracks: {},
  }
}

describe('decor-editor-bridge — décor temporaire entre deux kf (2026-07-17-resolved-state-at-time-notes)', () => {
  function mount(scene: EditorScene, snapshots: Record<string, Record<string, string>>) {
    const actor = createActor(controllerMachine)
    actor.start()
    const container = document.createElement('div')
    createDecorEditorBridge(container, actor)
    const authorApi = fakeAuthorApiWithNodes(snapshots)
    const offsetBridge = fakeOffsetBridge()
    actor.send({ type: 'PLAYER_READY', authorApi, referenceWidthPx: 100, offsetBridge })
    actor.send({ type: 'SCENE_LOADED', scene })
    return { actor, container, offsetBridge }
  }

  it('playhead entre kf1 et kf2, item sélectionné sans kf : affiche la couleur live du perso (ni kf1 ni le preset), marque le décor temporaire', () => {
    const { actor, container } = mount(sceneWithGapBetweenKeyframes(), { 'item-1': { 'background-color': 'oklch(0.5 0.2 100)' } })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    const liveColor = colorInput.value.toLowerCase()
    expect(liveColor).not.toBe('#808080')
    const palette = container.querySelector('.dedit-palette')!
    expect(palette.classList.contains('dedit-palette--temporary')).toBe(true)
    expect(actor.getSnapshot().context.scene?.decors).not.toHaveProperty('decor-live')

    // Assertion stricte : la couleur affichée n'est PAS celle de kf1 (`oklch(0.6 0.24 25)`) —
    // sinon un patch retombé sur la cascade seule (bug régressé, la lecture live `getPersoStates`
    // aurait disparu silencieusement) serait indiscernable d'une lecture live réussie.
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-1' })
    const kf1Color = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!.value.toLowerCase()
    expect(liveColor).not.toBe(kf1Color)
  })

  it('reste fiable pendant un geste CS actif — plus d\'exception isGestureActive (2026-07-18-pose-edit-architecture-study.md §8)', () => {
    // Couleur live délibérément DIFFÉRENTE de celle de kf1 (`oklch(0.6 0.24 25)`, rouge) — sinon un
    // patch retombé sur la base (kf1 seul, l'ancien comportement bogué) serait indiscernable d'une
    // lecture live réussie. `oklch(0.4 0.15 200)` → un bleu-vert net, jamais confondu avec le rouge.
    const { actor, container, offsetBridge } = mount(sceneWithGapBetweenKeyframes(), { 'item-1': { 'background-color': 'oklch(0.4 0.15 200)' } })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    const liveColorWhenIdle = colorInput.value.toLowerCase()

    offsetBridge.setGestureActive(true)
    // Resynchronise explicitement (comme un vrai onValues/onDecorChange le ferait pendant le geste).
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    expect(colorInput.value.toLowerCase()).toBe(liveColorWhenIdle)
  })

  it('raccourci « aller à kf1 » depuis le décor temporaire : seek vers kf1, la palette redevient non-temporaire', () => {
    const { actor, container } = mount(sceneWithGapBetweenKeyframes(), { 'item-1': { 'background-color': 'oklch(0.5 0.2 100)' } })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
    const palette = container.querySelector('.dedit-palette')!
    expect(palette.classList.contains('dedit-palette--temporary')).toBe(true)

    const snapButton = container.querySelector<HTMLButtonElement>('.dedit-snap-to-kf1')!
    expect(snapButton.classList.contains('dedit-snap-to-kf1--hidden')).toBe(false)
    snapButton.click()

    expect(palette.classList.contains('dedit-palette--temporary')).toBe(false)
    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    expect(colorInput.value.toLowerCase()).not.toBe('#808080') // kf1 réel, pas le preset
  })

  it('raccourci masqué quand le décor n\'est pas temporaire', () => {
    const { container } = mount(sceneWithGapBetweenKeyframes(), {})
    const snapButton = container.querySelector<HTMLButtonElement>('.dedit-snap-to-kf1')!
    expect(snapButton.classList.contains('dedit-snap-to-kf1--hidden')).toBe(true)
  })

  it('playhead exactement sur kf2, item sélectionné sans kf : cascade du document, jamais temporaire', () => {
    const { actor, container } = mount(sceneWithGapBetweenKeyframes(), {})
    actor.send({ type: 'SEEK', timelineMs: 1000 })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    const palette = container.querySelector('.dedit-palette')!
    expect(palette.classList.contains('dedit-palette--temporary')).toBe(false)
  })

  it('playhead avant kf1 (aucun keyframe encore atteint) : décor initial de l\'item, jamais temporaire', () => {
    const { actor, container } = mount(sceneWithGapBetweenKeyframes(), {})
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    const palette = container.querySelector('.dedit-palette')!
    expect(palette.classList.contains('dedit-palette--temporary')).toBe(false)
  })

  it('éditer pendant un décor temporaire ne committe rien (aucun keyframe réel à cet instant)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { actor, container } = mount(sceneWithGapBetweenKeyframes(), { 'item-1': { 'background-color': 'oklch(0.5 0.2 100)' } })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })

    const colorInput = container.querySelectorAll<HTMLInputElement>('input[type="color"]')[0]!
    colorInput.value = '#00ff00'
    colorInput.dispatchEvent(new Event('input', { bubbles: true }))
    colorInput.dispatchEvent(new Event('change', { bubbles: true }))

    expect(actor.getSnapshot().context.scene?.decors['decor-kf1']?.style?.['background-color']).toBe('oklch(0.6 0.24 25)')
    expect(actor.getSnapshot().context.scene?.decors['decor-kf2']?.style?.['background-color']).toBe('oklch(0.6 0.24 260)')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

// `Decor.custom` — même traitement qu'`offset` (2026-07-17, suite du plan de couches). Round-trip
// complet dedit↔document, plus un warn (le gap `patch.custom non routé` est fermé).
describe('decor-editor-bridge — CSS libre (Decor.custom, même traitement que offset)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function mount(scene: EditorScene) {
    const actor = createActor(controllerMachine)
    actor.start()
    const container = document.createElement('div')
    createDecorEditorBridge(container, actor)
    actor.send({ type: 'PLAYER_READY', authorApi: fakeAuthorApi(), referenceWidthPx: 100, offsetBridge: fakeOffsetBridge() })
    actor.send({ type: 'SCENE_LOADED', scene })
    return { actor, container }
  }

  function selectCustomTab(container: HTMLElement): void {
    const tab = Array.from(container.querySelectorAll<HTMLButtonElement>('.dedit-tab')).find((b) => b.textContent === 'Custom')!
    tab.click()
  }

  it('un Decor.custom déjà présent se lit dans le textarea Custom à la sélection', () => {
    const scene = sceneWithTwoItems()
    scene.decors['decor-1']!.custom = 'display: flex'
    const { actor, container } = mount(scene)
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
    selectCustomTab(container)

    const textarea = container.querySelector<HTMLTextAreaElement>('.dedit-custom textarea')!
    expect(textarea.value).toBe('display: flex')
  })

  it('éditer le textarea Custom écrit Decor.custom (RUN_TRANSACTION), plus de warn "non routé"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { actor, container } = mount(sceneWithTwoItems())
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
    selectCustomTab(container)

    const textarea = container.querySelector<HTMLTextAreaElement>('.dedit-custom textarea')!
    textarea.value = 'align-items: center'
    textarea.dispatchEvent(new Event('change', { bubbles: true }))
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS) // signal 4 — inactivité longue (§Étape B)

    expect(actor.getSnapshot().context.scene?.decors['decor-1']?.custom).toBe('align-items: center')
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('patch.custom'))
    warn.mockRestore()
  })
})

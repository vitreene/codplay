// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createActor, type Actor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { createDecorEditorBridge, PHASE_IDLE_FLUSH_MS } from '../src/app/bridges/decor-editor-bridge'
import type { EditorScene } from '../src/app/commands/types'
import type { AuthorApi } from '@codplay/selection-frame'
import type { OffsetEditorBridge, OffsetValuesPx } from '../src/decor-editor/types'

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
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
  }
}

type FakeOffsetBridge = OffsetEditorBridge & {
  emitValues: (v: OffsetValuesPx) => void
  setGestureActive: (active: boolean) => void
}

/** 100px de large : `pxToCqw(px, 100) === px` — conversion identité, assertions lisibles directement en px. */
function fakeOffsetBridge(containerWidthPx = 100): FakeOffsetBridge {
  const valueListeners = new Set<(v: OffsetValuesPx) => void>()
  const gestureListeners = new Set<(active: boolean) => void>()
  let gestureActive = false
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
    emitValues(v) {
      for (const cb of valueListeners) cb(v)
    },
    setGestureActive(active) {
      gestureActive = active
      for (const cb of gestureListeners) cb(active)
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
    offsetBridge.emitValues({ translate: { x: 1, y: 1 } })
    offsetBridge.setGestureActive(true)
    vi.advanceTimersByTime(PHASE_IDLE_FLUSH_MS * 2)
    expect(committedOffset(actor, 'decor-1')).toBeUndefined()
    offsetBridge.setGestureActive(false)
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

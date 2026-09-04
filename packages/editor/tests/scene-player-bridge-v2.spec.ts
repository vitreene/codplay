/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { createSequenceEditorBridge } from '../src/app/bridges/sequence-editor-bridge'
import { createDecorEditorBridge } from '../src/app/bridges/decor-editor-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'

/** Creates the V2 position scene used by the real bridge integration. */
function scene() {
  return {
    id: 'position-repro',
    meta: { title: 'position', durationMs: 5000, durationSource: 'arbitrary' as const, timeUnit: 'ms' as const, capsuleOrder: 'forward' as const },
    items: [{ id: 'item', type: 'text' as const, parentId: null, order: 'a', visible: true, contentId: 'content', initialDecorId: 'first', keyframes: [{ id: 'a', timeMs: 0, decorId: 'first' }, { id: 'b', timeMs: 5000, decorId: 'second' }] }],
    contents: { content: { id: 'content', type: 'text' as const, text: 'item' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { 'background-color': '#ff0000' } },
      second: { id: 'second', offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 }, style: { 'background-color': '#0000ff' } },
    },
    zones: {}, markerTracks: {},
  }
}

/** Creates a multi-keyframe position chain whose projected ghosts can be compared across replay. */
function motionChainScene() {
  const keyframes = [0, 1_000, 2_000, 3_000, 4_000].map((timeMs, index) => ({
    id: `chain-kf-${index}`,
    timeMs,
    decorId: `chain-decor-${index}`,
  }))
  const decors = Object.fromEntries(keyframes.map((keyframe, index) => [keyframe.decorId, {
    id: keyframe.decorId,
    offset: { translate: { x: 10 + index * 8, y: 10 + index * 6 }, width: 20, height: 20 },
  }]))
  return {
    ...scene(),
    id: 'motion-chain-replay',
    items: [{
      ...scene().items[0]!,
      initialDecorId: 'chain-decor-0',
      keyframes,
    }],
    decors,
  }
}

/** Same-parent scene with a style property authored only on the middle keyframe. */
function destinationOnlyStyleScene() {
  const base = scene()
  return {
    ...base,
    decors: {
      ...base.decors,
      middle: { id: 'middle', style: { color: '#ff0000' } },
    },
    items: base.items.map((item) => ({
      ...item,
      keyframes: [
        item.keyframes[0]!,
        { id: 'middle', timeMs: 2_500, decorId: 'middle' },
        item.keyframes[1]!,
      ],
    })),
  }
}

/** Two-lane scene emitted by the editor's Test position + couleur demo. */
function positionColorScene() {
  return {
    id: 'position-color-repro',
    meta: { title: 'position + couleur', durationMs: 5000, durationSource: 'arbitrary' as const, timeUnit: 's' as const, capsuleOrder: 'forward' as const },
    items: [
      { id: 'item-a', type: 'text' as const, parentId: null, order: 'a', visible: true, contentId: 'content-a', initialDecorId: 'a-first', keyframes: [{ id: 'a-first-kf', timeMs: 0, decorId: 'a-first' }, { id: 'a-last-kf', timeMs: 5000, decorId: 'a-last' }] },
      { id: 'item-b', type: 'text' as const, parentId: null, order: 'b', visible: true, contentId: 'content-b', initialDecorId: 'b-first', keyframes: [{ id: 'b-first-kf', timeMs: 0, decorId: 'b-first' }, { id: 'b-last-kf', timeMs: 5000, decorId: 'b-last' }] },
    ],
    contents: {
      'content-a': { id: 'content-a', type: 'text' as const, text: 'Item A' },
      'content-b': { id: 'content-b', type: 'text' as const, text: 'Item B' },
    },
    decors: {
      'a-first': { id: 'a-first', offset: { translate: { x: 8, y: 15 }, width: 18, height: 18, rotate: 0 }, style: { 'background-color': 'oklch(0.6 0.24 25)' } },
      'a-last': { id: 'a-last', offset: { translate: { x: 8, y: 50 }, width: 18, height: 18, rotate: 15 }, style: { 'background-color': 'oklch(0.6 0.24 260)' } },
      'b-first': { id: 'b-first', offset: { translate: { x: 54, y: 15 }, width: 18, height: 18, rotate: 0 }, style: { 'background-color': 'oklch(0.6 0.24 145)' } },
      'b-last': { id: 'b-last', offset: { translate: { x: 54, y: 50 }, width: 18, height: 18, rotate: -15 }, style: { 'background-color': 'oklch(0.7 0.2 80)' } },
    },
    zones: {}, markerTracks: {},
  }
}

/** Empty document used to reproduce the menu's create-item transaction sequence. */
function emptyDemoScene() {
  return {
    id: 'demo-scene',
    meta: { title: 'demo', durationMs: 5_000, durationSource: 'arbitrary' as const, timeUnit: 's' as const, capsuleOrder: 'forward' as const },
    items: [], contents: {}, decors: {}, zones: {}, markerTracks: {},
  }
}

/** Lets the asynchronous V2 bridge finish one staged bind and its seek handoff. */
const waitTurns = async (count = 8): Promise<void> => {
  for (let i = 0; i < count; i += 1) await Promise.resolve()
}

/** Builds a pointer event with the capture fields used by the Selection Frame gesture. */
function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  return event
}

beforeAll(() => {
  if (typeof HTMLElement.prototype.setPointerCapture !== 'function') {
    HTMLElement.prototype.setPointerCapture = function (): void {}
    HTMLElement.prototype.hasPointerCapture = function (): boolean { return false }
    HTMLElement.prototype.releasePointerCapture = function (): void {}
  }
})

describe('V2 editor position seek integration', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let sceneBridge: ReturnType<typeof createScenePlayerBridge> | undefined
  let sequenceBridge: ReturnType<typeof createSequenceEditorBridge> | undefined
  let decorBridge: ReturnType<typeof createDecorEditorBridge> | undefined
  let root: HTMLElement | undefined
  let now = 0
  let nextFrameId = 1
  const frames = new Map<number, () => void>()

  afterEach(() => {
    sceneBridge?.destroy()
    sequenceBridge?.destroy()
    decorBridge?.destroy()
    coordination?.destroy()
    actor?.stop()
    sceneBridge = undefined
    sequenceBridge = undefined
    decorBridge = undefined
    coordination = undefined
    actor = undefined
    root = undefined
    frames.clear()
  })

  it('plays, seeks back, plays again, then seeks again without freezing the scene', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: scene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      root = document.createElement('div')
      Object.defineProperty(root, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      document.body.append(root)
      sceneBridge = createScenePlayerBridge(root, actor, coordination)
      await waitTurns()
      const initialNode = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
      expect(initialNode).not.toBeNull()

      coordination.transport.play()
      await waitTurns()
      now = 100
      const firstFrame = [...frames.values()][0]
      expect(firstFrame).toBeDefined()
      firstFrame?.()
      await waitTurns()
      now = 1100
      const secondFrame = [...frames.values()][0]
      secondFrame?.()
      await waitTurns()
      const node = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
      expect(node).toBe(initialNode)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1000)
      expect(node?.style.transform).toContain('translate(')

      coordination.transport.pause()
      await waitTurns()
      expect(actor.getSnapshot().value).toBe('idle')
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1000)
      coordination.transport.play()
      await waitTurns()
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).toBe(initialNode)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1000)

      actor.send({ type: 'SEEK', timelineMs: 500 })
      await waitTurns()
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).toBe(initialNode)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(500)
      expect(node?.style.transform).toContain('translate(')

      coordination.transport.play()
      await waitTurns()
      now = 1200
      const thirdFrame = [...frames.values()][0]
      thirdFrame?.()
      await waitTurns()
      now = 2200
      const fourthFrame = [...frames.values()][0]
      fourthFrame?.()
      await waitTurns()
      const afterResume = coordination.transport.getProgress()?.timelineMs
      expect(afterResume).toBe(1500)
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).toBe(initialNode)
      const resumedTransform = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform

      actor.send({ type: 'SEEK', timelineMs: 250 })
      await waitTurns()
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).toBe(initialNode)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(250)
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform).toContain('translate(')

      coordination.transport.play()
      await waitTurns()
      now = 2300
      ;[...frames.values()][0]?.()
      await waitTurns()
      now = 3300
      ;[...frames.values()][0]?.()
      await waitTurns()
      // A simple play/seek cycle keeps the same instance and resumes from the author seek (250 ms),
      // not from a rebuilt runtime horizon. The second frame advances the preserved author
      // position by 1,000 ms.
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1250)
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).toBe(initialNode)
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform).not.toBe(resumedTransform)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
    }
  })

  it('resynchronizes every motion ghost after natural playback reaches the end', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    const originalResizeObserver = globalThis.ResizeObserver
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: motionChainScene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      const sceneRoot = document.createElement('div')
      Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      })
      const timelineRoot = document.createElement('div')
      const panelRoot = document.createElement('div')
      document.body.append(sceneRoot, timelineRoot, panelRoot)
      sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
      sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
      decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
      await waitTurns(32)

      // Reproduce a selection after the author has worked on a middle keyframe. The bridge must
      // still resolve the complete chain when playback starts from that pose.
      actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'chain-kf-2' })
      actor.send({ type: 'SEEK', timelineMs: 2_000 })
      await waitTurns(32)

      const selectionFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
      expect(selectionFrame).not.toBeNull()
      // Leave the CS edit pending, as it is in the application until the next phase boundary. Play
      // must flush this accepted pose before suspending the authoring overlays.
      selectionFrame!.dispatchEvent(pointerEvent('pointerdown', 240, 200))
      selectionFrame!.dispatchEvent(pointerEvent('pointermove', 320, 280))
      selectionFrame!.dispatchEvent(pointerEvent('pointerup', 320, 280))
      await waitTurns(16)

      const readGhostPositions = (): Map<string, string> => new Map(
        [...sceneRoot.querySelectorAll<HTMLElement>('[data-motion-ghost]')]
          .flatMap((ghost) => ghost.dataset.motionKeyframeId === undefined
            ? []
            : [[ghost.dataset.motionKeyframeId, `${ghost.style.left}|${ghost.style.top}`] as const]),
      )
      const ghostPositionsBeforePlay = readGhostPositions()
      expect(ghostPositionsBeforePlay.get('chain-kf-0')).toBe('80px|80px')
      expect(ghostPositionsBeforePlay.get('chain-kf-4')).toBe('336px|272px')

      // An endpoint ghost must use the same author-seek owner as the timeline. The visible source
      // ghost is the persisted 1 s KF of the active 1 s → 2 s segment.
      sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.click()
      await waitTurns(48)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1_000)
      expect(timelineRoot.querySelector<HTMLElement>('.seq-toolbar__time')?.textContent).toBe('1.0 s')
      expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'chain-kf-1' })

      // Restore the original active segment before exercising playback/reconciliation below.
      actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'chain-kf-2' })
      coordination.requestAuthorSeek(2_000)
      await waitTurns(48)

      timelineRoot.querySelector<HTMLButtonElement>('button[title="Play / Pause"]')?.click()
      await waitTurns(32)
      expect(actor.getSnapshot().value).toBe('playing')
      now = 100
      ;[...frames.values()][0]?.()
      await waitTurns(32)
      now = 6_000
      ;[...frames.values()][0]?.()
      await waitTurns(64)

      expect(actor.getSnapshot().value).toBe('idle')
      expect(sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')?.style.display).not.toBe('none')
      expect(actor.getSnapshot().context.selection).toEqual({ itemIds: ['item'] })
      const ghostPositionsAfterPlay = readGhostPositions()
      expect(ghostPositionsAfterPlay).toEqual(ghostPositionsBeforePlay)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('keeps the complete ghost chain after creating successive displaced keyframes and playing to the end', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    const originalResizeObserver = globalThis.ResizeObserver
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: scene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      const sceneRoot = document.createElement('div')
      Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
      })
      const timelineRoot = document.createElement('div')
      const panelRoot = document.createElement('div')
      document.body.append(sceneRoot, timelineRoot, panelRoot)
      sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
      sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
      decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
      await waitTurns(32)

      await waitTurns(32)

      // A movement-surface drop on a real KF updates that KF. To create a chain, each gesture therefore
      // starts from an unkeyed playhead between its neighbours and is written at that exact time.
      for (const [timeMs, dx, dy] of [[1_000, 80, 40], [2_000, 70, 35], [3_000, 60, 30]]) {
        actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
        actor.send({ type: 'SEEK', timelineMs: timeMs })
        await waitTurns(32)
        const moveZone = sceneRoot.querySelector<HTMLElement>('[data-motion-central]')
        expect(moveZone).not.toBeNull()
        moveZone!.dispatchEvent(pointerEvent('pointerdown', 100, 100))
        moveZone!.dispatchEvent(pointerEvent('pointermove', 100 + dx, 100 + dy))
        moveZone!.dispatchEvent(pointerEvent('pointerup', 100 + dx, 100 + dy))
        await waitTurns(48)
      }

      const createdItem = actor.getSnapshot().context.scene?.items.find((item) => item.id === 'item')
      expect(createdItem?.keyframes).toHaveLength(5)
      actor.send({ type: 'SEEK', timelineMs: 0 })
      await waitTurns(48)
      const readGhostPositions = (): Map<string, string> => new Map(
        [...sceneRoot.querySelectorAll<HTMLElement>('[data-motion-ghost]')]
          .flatMap((ghost) => ghost.dataset.motionKeyframeId === undefined
            ? []
            : [[ghost.dataset.motionKeyframeId, `${ghost.style.left}|${ghost.style.top}`] as const]),
      )
      const ghostPositionsBeforePlay = readGhostPositions()
      expect(ghostPositionsBeforePlay.size).toBe(5)

      timelineRoot.querySelector<HTMLButtonElement>('button[title="Play / Pause"]')?.click()
      await waitTurns(48)
      expect(actor.getSnapshot().value).toBe('playing')
      now = 100
      ;[...frames.values()][0]?.()
      await waitTurns(32)
      now = 6_000
      ;[...frames.values()][0]?.()
      await waitTurns(96)

      expect(actor.getSnapshot().value).toBe('idle')
      expect(sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')?.style.display).not.toBe('none')
      expect(coordination.transport.getProgress()?.timelineMs).toBe(5_000)
      expect(coordination.presentation.get()?.timeMs).toBe(5_000)
      expect(actor.getSnapshot().context.selection).toEqual({ itemIds: ['item'], keyframeId: 'b' })
      expect(readGhostPositions()).toEqual(ghostPositionsBeforePlay)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('rebuilds after a committed document change, then keeps that instance for Play', async () => {
    actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: scene() })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    sceneBridge = createScenePlayerBridge(root, actor, coordination)
    await waitTurns(24)

    const initialNode = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(initialNode).not.toBeNull()
    actor.send({
      type: 'RUN_COMMAND',
      command: { name: 'moveKeyframe', args: { itemId: 'item', keyframeId: 'b', timeMs: 4000 } },
    })
    await waitTurns(24)
    const committedNode = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(committedNode).not.toBeNull()
    expect(committedNode).not.toBe(initialNode)

    coordination.transport.play()
    await waitTurns(24)
    expect(actor.getSnapshot().value).toBe('playing')
    expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).toBe(committedNode)
  })

  it('creates the bridge instance when a destination-only style property is present', async () => {
    actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: destinationOnlyStyleScene() })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    sceneBridge = createScenePlayerBridge(root, actor, coordination)
    await waitTurns(24)

    expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')).not.toBeNull()
    coordination.transport.play()
    await waitTurns(24)
    expect(actor.getSnapshot().value).toBe('playing')
    expect(coordination.transport.getState()?.status).toBe('playing')
  })

  it('plays after a keyframe commit followed by rewind and Play', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: scene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      root = document.createElement('div')
      Object.defineProperty(root, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      document.body.append(root)
      sceneBridge = createScenePlayerBridge(root, actor, coordination)
      await waitTurns(24)

      actor.send({
        type: 'RUN_TRANSACTION',
        commands: [
          { name: 'createNamedKeyframe', args: { itemId: 'item', keyframeId: 'middle', timeMs: 2_500 } },
          {
            name: 'setDecor',
            args: {
              decorId: 'decor-middle',
              patch: {
                offset: { translate: { x: 30, y: 30 }, width: 20, height: 20 },
                path: 'M 0 0 A 0.65 0.65 0 0 1 1 0',
              },
            },
          },
        ],
      })
      // Exercise the user-visible race as well: the rewind and Play can arrive while the
      // committed scene is still being staged. Playback must queue behind that one rebuild.
      coordination.transport.rewind()
      coordination.transport.play()
      await waitTurns(24)
      expect(actor.getSnapshot().context.scene?.items[0]?.keyframes).toHaveLength(3)
      expect(actor.getSnapshot().value).toBe('playing')

      coordination.transport.rewind()
      await waitTurns(24)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(0)

      coordination.transport.play()
      await waitTurns(24)
      expect(actor.getSnapshot().value).toBe('playing')
      now = 100
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      now = 200
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      expect(coordination.transport.getProgress()?.timelineMs).toBeGreaterThan(0)

      coordination.transport.pause()
      await waitTurns(24)
      actor.send({ type: 'SEEK', timelineMs: 0 })
      coordination.transport.play()
      await waitTurns(24)
      expect(coordination.transport.getProgress()?.timelineMs).toBe(0)
      now = 300
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      now = 400
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      expect(coordination.transport.getProgress()?.timelineMs).toBeGreaterThan(0)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
    }
  })

  it('keeps the real timeline Play control active after a keyframe commit and Stop', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    const originalResizeObserver = globalThis.ResizeObserver
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: scene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      const sceneRoot = document.createElement('div')
      Object.defineProperty(sceneRoot, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      document.body.append(sceneRoot)
      sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
      const timelineRoot = document.createElement('div')
      document.body.append(timelineRoot)
      sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
      const panelRoot = document.createElement('div')
      document.body.append(panelRoot)
      decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
      await waitTurns(24)

      actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'a' })
      const row = timelineRoot.querySelector<HTMLElement>('.seq-row[data-track-id="item"]')
      expect(row).not.toBeNull()
      Object.defineProperty(row!, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, top: 0, right: 800, bottom: 28, width: 800, height: 28 }),
      })
      // This is the actual sequence-editor double-click path: it first seeks to the insertion
      // time, then captures the presented frame and commits the new keyframe.
      // The inserted KF reuses the adjacent decor when no property was edited. Advance past the
      // insertion time before asserting that Play changes the pose.
      row!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 20, clientY: 14, detail: 2 }))
      await waitTurns(24)
      expect(actor.getSnapshot().context.scene?.items[0]?.keyframes).toHaveLength(3)
      await waitTurns(24)

      timelineRoot.querySelector<HTMLButtonElement>('button[title="Stop"]')?.click()
      timelineRoot.querySelector<HTMLButtonElement>('button[title="Play / Pause"]')?.click()
      await waitTurns(24)
      expect(actor.getSnapshot().value).toBe('playing')
      expect(coordination.transport.getState()?.status).toBe('playing')
      const initialTransform = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform

      // The insertion is intentionally before the destination, so advancing beyond its author
      // time also verifies that Play continues through the newly created segment.
      now = 100
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      now = 200
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      expect(coordination.transport.getProgress()?.timelineMs).toBeGreaterThan(0)
      now = 3_000
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      expect(sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform).not.toBe(initialTransform)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('plays the generated demo item after its menu creation and a timeline keyframe', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    const originalResizeObserver = globalThis.ResizeObserver
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: emptyDemoScene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      const sceneRoot = document.createElement('div')
      Object.defineProperty(sceneRoot, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      const timelineRoot = document.createElement('div')
      const panelRoot = document.createElement('div')
      document.body.append(sceneRoot, timelineRoot, panelRoot)
      sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
      sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
      decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
      await waitTurns(24)

      actor.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })
      const itemId = actor.getSnapshot().context.scene?.items.at(-1)?.id
      expect(itemId).toBeDefined()
      actor.send({
        type: 'RUN_TRANSACTION',
        commands: [
          { name: 'assignType', args: { itemId: itemId!, type: 'text' } },
          { name: 'assignContent', args: { itemId: itemId!, content: { type: 'text', text: 'Nouvel item' } } },
          { name: 'createKeyframe', args: { itemId: itemId!, timeMs: 0 } },
          { name: 'createKeyframe', args: { itemId: itemId!, timeMs: 5_000 } },
        ],
      })
      const generatedItem = actor.getSnapshot().context.scene?.items.find((item) => item.id === itemId)
      expect(generatedItem).toBeDefined()
      actor.send({
        type: 'RUN_TRANSACTION',
        commands: generatedItem!.keyframes.flatMap((keyframe, index) => [{
          name: 'setDecor' as const,
          args: {
            decorId: keyframe.decorId,
            patch: {
              offset: { translate: { x: index === 0 ? 8 : 54, y: index === 0 ? 15 : 50 }, width: 18, height: 18, ...(index === 0 ? {} : { rotate: 15 }) },
              style: { 'background-color': index === 0 ? 'oklch(0.6 0.24 25)' : 'oklch(0.6 0.24 260)' },
            },
          },
        }]),
      })
      actor.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })
      const secondItemId = actor.getSnapshot().context.scene?.items.at(-1)?.id
      expect(secondItemId).toBeDefined()
      actor.send({
        type: 'RUN_TRANSACTION',
        commands: [
          { name: 'assignType', args: { itemId: secondItemId!, type: 'text' } },
          { name: 'assignContent', args: { itemId: secondItemId!, content: { type: 'text', text: 'Item B' } } },
          { name: 'createKeyframe', args: { itemId: secondItemId!, timeMs: 0 } },
          { name: 'createKeyframe', args: { itemId: secondItemId!, timeMs: 5_000 } },
        ],
      })
      actor.send({ type: 'SELECT_ITEM', itemIds: [itemId!] })
      await waitTurns(24)

      const row = timelineRoot.querySelector<HTMLElement>(`.seq-row[data-track-id="${itemId}"]`)
      expect(row).not.toBeNull()
      Object.defineProperty(row!, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, top: 0, right: 800, bottom: 28, width: 800, height: 28 }),
      })
      // The inserted KF reuses the adjacent decor when no property was edited. Advance past the
      // insertion time before asserting that Play changes the pose.
      row!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 20, clientY: 14, detail: 2 }))
      await waitTurns(24)
      expect(actor.getSnapshot().context.scene?.items[0]?.keyframes).toHaveLength(3)

      timelineRoot.querySelector<HTMLButtonElement>('button[title="Stop"]')?.click()
      timelineRoot.querySelector<HTMLButtonElement>('button[title="Play / Pause"]')?.click()
      await waitTurns(24)
      expect(actor.getSnapshot().value).toBe('playing')
      expect(coordination.transport.getState()?.status).toBe('playing')
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('keeps a menu-created item bounded and exposes its selection frame', async () => {
    actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: emptyDemoScene() })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const panelRoot = document.createElement('div')
    document.body.append(sceneRoot, panelRoot)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
    await waitTurns(24)

    const geometry = { translate: { x: 20, y: 18 }, width: 60, height: 18 }
    actor.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry } } })
    const itemId = actor.getSnapshot().context.scene?.items.at(-1)?.id
    expect(itemId).toBeDefined()
    actor.send({
      type: 'RUN_TRANSACTION',
      commands: [
        { name: 'assignType', args: { itemId: itemId!, type: 'text' } },
        { name: 'assignContent', args: { itemId: itemId!, content: { type: 'text', text: 'Nouvel item' } } },
        { name: 'createKeyframe', args: { itemId: itemId!, timeMs: 0 } },
        { name: 'createKeyframe', args: { itemId: itemId!, timeMs: 5_000 } },
      ],
    })
    actor.send({ type: 'SELECT_ITEM', itemIds: [itemId!] })
    await waitTurns(48)

    const item = actor.getSnapshot().context.scene?.items.find((candidate) => candidate.id === itemId)
    expect(item).toBeDefined()
    expect(actor.getSnapshot().context.scene?.decors[item!.initialDecorId]?.offset).toEqual(geometry)

    const itemNode = sceneRoot.querySelector<HTMLElement>(`[data-item-id="story-main:${itemId}"]`)
    expect(itemNode).not.toBeNull()
    // The jsdom fixture has no layout box for the staged instance root, so the runtime's
    // numeric-length scale falls back to 1 here. The important invariant is that authored cqw
    // geometry reaches the item instead of the root card's full-surface stretch.
    expect(itemNode?.style.width).toBe('60px')
    expect(itemNode?.style.height).toBe('18px')

    const selectionFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame]')
    expect(selectionFrame?.style.display).not.toBe('none')
    // The preset border is outside the authored content-box. The CS keeps the authored width and
    // height, but its origin starts after the 0.6cqw left/top border (4.8px at this root width).
    expect(selectionFrame?.style.left).toBe('164.8px')
    expect(selectionFrame?.style.top).toBe('148.8px')
    expect(selectionFrame?.style.width).toBe('480px')
    expect(selectionFrame?.style.height).toBe('144px')
  })

  it('plays the two-item position demo after adding a keyframe, Stop, and Play', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    const originalResizeObserver = globalThis.ResizeObserver
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: positionColorScene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      const sceneRoot = document.createElement('div')
      Object.defineProperty(sceneRoot, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      const timelineRoot = document.createElement('div')
      const panelRoot = document.createElement('div')
      document.body.append(sceneRoot, timelineRoot, panelRoot)
      sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
      sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
      decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
      await waitTurns(24)

      actor.send({ type: 'SELECT_ITEM', itemIds: ['item-a'], keyframeId: 'a-last-kf' })
      const row = timelineRoot.querySelector<HTMLElement>('.seq-row[data-track-id="item-a"]')
      expect(row).not.toBeNull()
      Object.defineProperty(row!, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, top: 0, right: 800, bottom: 28, width: 800, height: 28 }),
      })
      row!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 200, clientY: 14, detail: 2 }))
      await waitTurns(32)
      expect(actor.getSnapshot().context.scene?.items.find((item) => item.id === 'item-a')?.keyframes).toHaveLength(3)

      timelineRoot.querySelector<HTMLButtonElement>('button[title="Stop"]')?.click()
      timelineRoot.querySelector<HTMLButtonElement>('button[title="Play / Pause"]')?.click()
      await waitTurns(32)
      expect(actor.getSnapshot().value).toBe('playing')
      expect(coordination.transport.getState()?.status).toBe('playing')
      const initialTransform = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item-a"]')?.style.transform
      // The insertion is intentionally before the destination, so advancing beyond its author
      // time also verifies that Play continues through the newly created segment.
      now = 100
      ;[...frames.values()][0]?.()
      await waitTurns(32)
      now = 200
      ;[...frames.values()][0]?.()
      await waitTurns(32)
      expect(coordination.transport.getProgress()?.timelineMs).toBeGreaterThan(0)
      now = 3_000
      ;[...frames.values()][0]?.()
      await waitTurns(32)
      expect(sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item-a"]')?.style.transform).not.toBe(initialTransform)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
      globalThis.ResizeObserver = originalResizeObserver
    }
  })

  it('does not turn an immediate Stop then Play into a paused no-op', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    const originalResizeObserver = globalThis.ResizeObserver
    now = 0
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: positionColorScene() })
      coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
      const sceneRoot = document.createElement('div')
      Object.defineProperty(sceneRoot, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      const timelineRoot = document.createElement('div')
      const panelRoot = document.createElement('div')
      document.body.append(sceneRoot, timelineRoot, panelRoot)
      sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
      sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
      decorBridge = createDecorEditorBridge(panelRoot, actor, coordination)
      await waitTurns(24)

      actor.send({ type: 'SELECT_ITEM', itemIds: ['item-a'], keyframeId: 'a-last-kf' })
      const row = timelineRoot.querySelector<HTMLElement>('.seq-row[data-track-id="item-a"]')
      expect(row).not.toBeNull()
      Object.defineProperty(row!, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ left: 0, top: 0, right: 800, bottom: 28, width: 800, height: 28 }),
      })
      row!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 200, clientY: 14, detail: 2 }))
      // Do not wait for the rebuild/seek handoff: this is the ordering a user can produce by
      // clicking Stop and Play immediately after the keyframe is inserted.
      timelineRoot.querySelector<HTMLButtonElement>('button[title="Stop"]')?.click()
      timelineRoot.querySelector<HTMLButtonElement>('button[title="Play / Pause"]')?.click()
      await waitTurns(200)
      expect(actor.getSnapshot().value).toBe('playing')
      expect(coordination.transport.getState()?.status).toBe('playing')
      now = 100
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      now = 200
      ;[...frames.values()][0]?.()
      await waitTurns(24)
      expect(coordination.transport.getProgress()?.timelineMs).toBeGreaterThan(0)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
      globalThis.ResizeObserver = originalResizeObserver
    }
  })
})

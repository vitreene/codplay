/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../src/app/bridges/decor-editor-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import type { EditorPlayerPresentationFrame } from '../src/app/commands/editor-player-command-facade'

/** Creates the two-keyframe scene used to exercise a temporary decor preview end to end. */
function scene() {
  return {
    id: 'decor-preview-integration',
    meta: {
      title: 'Decor preview integration V2',
      durationMs: 5_000,
      durationSource: 'arbitrary' as const,
      timeUnit: 'ms' as const,
      capsuleOrder: 'forward' as const,
    },
    items: [{
      id: 'item',
      type: 'text' as const,
      parentId: null,
      order: 'a',
      visible: true,
      contentId: 'content',
      initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'last-kf', timeMs: 5_000, decorId: 'last' },
      ],
    }],
    contents: { content: { id: 'content', type: 'text' as const, text: 'item' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { 'background-color': '#ff0000' } },
      last: { id: 'last', offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 }, style: { 'background-color': '#0000ff' } },
    },
    zones: {},
    markerTracks: {},
  }
}

/** Lets the asynchronous V2 scene bridge finish binding and acknowledging one seek. */
async function waitTurns(count = 16): Promise<void> {
  for (let i = 0; i < count; i += 1) await Promise.resolve()
}

/** Builds a pointer event whose capture lifecycle is sufficient for the V2 overlay in jsdom. */
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

describe('decor-editor bridge V2 — preview interpolée et seek', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let sceneBridge: ReturnType<typeof createScenePlayerBridge> | undefined
  let decorBridge: ReturnType<typeof createDecorEditorBridge> | undefined
  let originalResizeObserver: typeof ResizeObserver | undefined

  afterEach(() => {
    decorBridge?.destroy()
    sceneBridge?.destroy()
    coordination?.destroy()
    actor?.stop()
    if (originalResizeObserver !== undefined) globalThis.ResizeObserver = originalResizeObserver
    document.body.replaceChildren()
    decorBridge = undefined
    sceneBridge = undefined
    coordination = undefined
    actor = undefined
    originalResizeObserver = undefined
  })

  it('efface le snapshot au seek, conserve le candidat, puis le réapplique au retour', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    const facade = new EditorPlayerCommandFacade()
    coordination = new EditorCoordinationBridge(actor, facade)

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()

    const item = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(item).not.toBeNull()
    const colorInput = decorPanel.querySelector<HTMLInputElement>('input[type="color"]')
    expect(colorInput).not.toBeNull()
    colorInput!.value = '#00ff00'
    colorInput!.dispatchEvent(new Event('input', { bubbles: true }))
    colorInput!.dispatchEvent(new Event('change', { bubbles: true }))
    const candidateStyle = item!.getAttribute('style')
    expect(candidateStyle).toContain('oklch')
    expect(coordination.decorPreview.getAt('item', 2_500)).not.toBeNull()
    expect(actor.getSnapshot().context.scene).toBe(documentScene)

    actor.send({ type: 'SEEK', timelineMs: 3_500 })
    await waitTurns()
    const awayStyle = item!.getAttribute('style')
    expect(awayStyle).not.toBe(candidateStyle)

    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()
    expect(item!.getAttribute('style')).toBe(candidateStyle)
    expect(actor.getSnapshot().context.scene).toBe(documentScene)
  })

  it('fait passer rotation, axe, preview puis commit par le circuit V2 du décor', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 2_500 })
    await waitTurns()

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    const tip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')
    const pivot = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-pivot]')
    expect(frame).not.toBeNull()
    expect(tip).not.toBeNull()
    expect(pivot).not.toBeNull()

    // At 2.5s the interpolated item is x/y=30cqw and 20cqw wide: the default axis is (320, 320).
    tip!.dispatchEvent(pointerEvent('pointerdown', 320, 284))
    tip!.dispatchEvent(pointerEvent('pointermove', 356, 320))
    tip!.dispatchEvent(pointerEvent('pointerup', 356, 320))

    const itemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(itemNode.style.transform).toContain('rotate(90deg)')
    expect(frame!.style.transformOrigin).toBe('50% 50%')

    // The pivot drag is previewed in the same frame channel and updates the origin without a
    // second player circuit. Move it to the top-left characteristic point.
    pivot!.dispatchEvent(pointerEvent('pointerdown', 320, 320))
    pivot!.dispatchEvent(pointerEvent('pointermove', 400, 240))
    pivot!.dispatchEvent(pointerEvent('pointerup', 400, 240))
    expect(itemNode.style.transformOrigin).toBe('0% 0%')
    expect(coordination.decorPreview.getAt('item', 2_500)).not.toBeNull()
    expect(actor.getSnapshot().context.scene).toBe(documentScene)

    // At an exact keyframe the same modifier path targets the document decor. The explicit
    // deselection is the phase boundary that flushes the pending patch; a temporary target above
    // remains preview-only, as required by the V2 contract.
    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns()
    const exactFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const exactTip = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')!
    const exactPivot = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-pivot]')!
    exactTip.dispatchEvent(pointerEvent('pointerdown', 160, 124))
    exactTip.dispatchEvent(pointerEvent('pointermove', 196, 160))
    exactTip.dispatchEvent(pointerEvent('pointerup', 196, 160))
    exactPivot.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    exactPivot.dispatchEvent(pointerEvent('pointermove', 240, 80))
    exactPivot.dispatchEvent(pointerEvent('pointerup', 240, 80))
    const exactItemNode = sceneRoot.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(exactFrame.style.transformOrigin).toBe('0% 0%')
    expect(exactItemNode.style.transform).toContain('rotate(90deg)')
    expect(exactItemNode.style.transformOrigin).toBe('0% 0%')

    actor.send({ type: 'CLEAR_SELECTION' })
    await waitTurns(24)
    const committedScene = actor.getSnapshot().context.scene!
    expect(committedScene).not.toBe(documentScene)
    expect(committedScene.decors.first?.offset).toMatchObject({
      rotate: 90,
      rotationOrigin: { fx: 0, fy: 0 },
    })
  })

  it('met à jour le KF exact ou matérialise le playhead entre KFs sans toucher au parent', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'first-kf' })
    actor.send({ type: 'SEEK', timelineMs: 0 })
    await waitTurns()

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-motion-central]')
    expect(moveZone).not.toBeNull()
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('none')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector('[data-motion-path]')).not.toBeNull()

    // Escape cancels an unreleased trace and leaves the document untouched.
    moveZone!.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    moveZone!.dispatchEvent(pointerEvent('pointermove', 220, 190))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await waitTurns(8)
    expect(actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes).toHaveLength(2)

    moveZone!.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    moveZone!.dispatchEvent(pointerEvent('pointermove', 240, 200))
    moveZone!.dispatchEvent(pointerEvent('pointerup', 240, 200))
    await waitTurns(24)

    // At a real KF the central gesture updates that KF at the same time; it does not invent a
    // future target from a provisional duration.
    let committedItem = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!
    expect(committedItem.keyframes).toHaveLength(2)
    expect(actor.getSnapshot().context.scene!.decors.first?.offset).toMatchObject({ translate: { x: 20, y: 15 } })

    // Between real KFs the same gesture materializes the current author playhead.
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)
    const betweenMoveZone = sceneRoot.querySelector<HTMLElement>('[data-motion-central]')
    expect(betweenMoveZone).not.toBeNull()
    const betweenFrame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(betweenMoveZone!.style.left).toBe(betweenFrame?.style.left)
    expect(betweenMoveZone!.style.top).toBe(betweenFrame?.style.top)
    expect(betweenFrame?.style.zIndex).toBe('1100')
    expect(betweenFrame?.style.pointerEvents).toBe('none')
    expect(sceneRoot.querySelector('[data-selection-frame-needle-tip]')).not.toBeNull()
    expect(sceneRoot.querySelector<HTMLElement>('[data-selection-frame-needle-tip]')?.style.pointerEvents).toBe('auto')
    expect(sceneRoot.querySelector<HTMLElement>('[data-selection-frame-pivot]')?.style.pointerEvents).toBe('auto')
    const betweenHandles = [...sceneRoot.querySelectorAll<HTMLElement>('[data-selection-frame-handle]')]
    expect(betweenHandles).toHaveLength(8)
    expect(betweenHandles.every((handle) => handle.style.pointerEvents === 'auto')).toBe(true)
    betweenMoveZone!.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    betweenMoveZone!.dispatchEvent(pointerEvent('pointermove', 180, 140))
    const previewPaths = [...sceneRoot.querySelectorAll<SVGPathElement>('[data-motion-path]')]
    expect(previewPaths).toHaveLength(2)
    expect(sceneRoot.querySelectorAll('[data-motion-path-inactive]')).toHaveLength(1)
    const previewPathData = previewPaths.map((path) => path.getAttribute('d'))
    expect(previewPathData[0]).not.toBe(previewPathData[1])
    betweenMoveZone!.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const committedScene = actor.getSnapshot().context.scene!
    committedItem = committedScene.items.find((item) => item.id === 'item')!
    const target = committedItem.keyframes.find((keyframe) => keyframe.timeMs === 500)
    expect(target).toBeDefined()
    expect(committedItem.keyframes).toHaveLength(3)
    expect(committedItem.parentId).toBe(documentScene.items[0]!.parentId)
    expect(committedScene.decors[target!.decorId]?.offset?.translate).not.toEqual({ x: 20, y: 15 })
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: target!.id })
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.style.display).toBe('none')
    expect(sceneRoot.querySelector('[data-selection-frame="v2"]')).not.toBeNull()
    expect([...sceneRoot.querySelectorAll<SVGPathElement>('[data-motion-path]')].map((path) => path.getAttribute('d')))
      .toEqual(previewPathData)

    // A second central drag on the newly-created KF updates that same KF; it does not duplicate it.
    const targetOffsetBeforeSecondMove = committedScene.decors[target!.decorId]?.offset?.translate
    betweenMoveZone!.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    betweenMoveZone!.dispatchEvent(pointerEvent('pointermove', 300, 230))
    betweenMoveZone!.dispatchEvent(pointerEvent('pointerup', 300, 230))
    await waitTurns(24)
    committedItem = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!
    const sameTarget = committedItem.keyframes.find((keyframe) => keyframe.timeMs === 500)
    expect(sameTarget?.id).toBe(target!.id)
    expect(committedItem.keyframes).toHaveLength(3)
    expect(actor.getSnapshot().context.scene!.decors[sameTarget!.decorId]?.offset?.translate).not.toEqual(targetOffsetBeforeSecondMove)

    const pathControl = sceneRoot.querySelector<HTMLElement>('[data-motion-path-control]')
    expect(pathControl).not.toBeNull()
    pathControl!.dispatchEvent(pointerEvent('pointerdown', 200, 180))
    pathControl!.dispatchEvent(pointerEvent('pointermove', 200, 240))
    pathControl!.dispatchEvent(pointerEvent('pointerup', 200, 240))
    await waitTurns(24)
    const pathDecorId = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 500)!.decorId
    expect(actor.getSnapshot().context.scene!.decors[pathDecorId]?.path).toMatch(/^M 0 0 A /)

    // Seeking inside the active segment must not rebuild the path from the live interpolated
    // snapshot. The target decor remains the authored source of the path, while the CS follows
    // its projected point at the new time.
    const pathBeforeSeek = sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')
    const frameBeforeSeek = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(pathBeforeSeek).toContain('A')
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 750,
      playerTimeMs: 750,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 420, y: 300 },
          matrix: { a: 1, b: 0, c: 0, d: 1 },
          localWidth: 80,
          localHeight: 80,
        },
        representation: 'local',
        progress: 0.5,
      }],
    })
    actor.send({ type: 'SEEK', timelineMs: 750 })
    await waitTurns(24)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')).toBe(pathBeforeSeek)
    expect(frameBeforeSeek?.style.left).not.toBe('')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')?.style.display).toBe('')
    expect(frameBeforeSeek?.style.left).toBe('420px')
    expect(frameBeforeSeek?.style.top).toBe('300px')


    // Both endpoint ghosts are navigation targets. Each click selects its KF and seeks through
    // the same controller path as a timeline click; the endpoint projections remain available.
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    sourceGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'first-kf' })
    targetGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: target!.id })
    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')).toBe(pathBeforeSeek)

    pathControl!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.scene!.decors[pathDecorId]?.path).toBeUndefined()

    // Selecting a different keyframe on the same item reconstructs its own adjacent segment;
    // the previous active projection must not overwrite this selection.
    const pathAtSecondTarget = sceneRoot.querySelector('[data-motion-path]')?.getAttribute('d')
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)
    expect(sceneRoot.querySelector('[data-motion-path]')?.getAttribute('d')).not.toBe(pathAtSecondTarget)
  })

  it('recalcule la pose cible du segment pendant le repositionnement CS du KF matérialisé', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns()

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-motion-central]')!
    const middleBaseLeft = Number.parseFloat(moveZone.style.left)
    const middleBaseTop = Number.parseFloat(moveZone.style.top)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const initialTargetLeft = targetGhost.style.left
    const initialSourceLeft = sourceGhost.style.left
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!

    // Reposition the newly-created target directly through the existing CS move channel. The
    // target ghost must follow this live candidate before the deferred document flush.
    frame.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    frame.dispatchEvent(pointerEvent('pointermove', 280, 220))
    expect(targetGhost.style.left).not.toBe(initialTargetLeft)
    expect(sourceGhost.style.left).toBe(initialSourceLeft)
    frame.dispatchEvent(pointerEvent('pointerup', 280, 220))

    // A seek is the phase boundary that persists the CS patch. The target ghost is hidden because
    // the item occupies that pose; the source remains the navigation artefact.
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)

    const committed = actor.getSnapshot().context.scene!
    const item = committed.items.find((candidate) => candidate.id === 'item')!
    const target = item.keyframes.find((keyframe) => keyframe.timeMs === 500)!
    expect(committed.decors[target.decorId]?.offset?.translate?.x).toBeCloseTo((middleBaseLeft + 80 + 40) / 8)
    expect(committed.decors[target.decorId]?.offset?.translate?.y).toBeCloseTo((middleBaseTop + 40 + 20) / 8)
    expect(targetGhost.style.display).toBe('none')
    expect(targetGhost.style.left).toBe(frame.style.left)
    expect(sourceGhost.style.left).toBe(initialSourceLeft)
  })

  it('repositionne le dernier KF sans en créer et isole son décor partagé', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const documentScene = {
      ...baseScene,
      items: baseScene.items.map((item) => ({
        ...item,
        keyframes: item.keyframes.map((keyframe) => (
          keyframe.id === 'last-kf' ? { ...keyframe, decorId: 'first' } : keyframe
        )),
      })),
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns(24)

    const moveZones = sceneRoot.querySelectorAll<HTMLElement>('[data-motion-move-zone]')
    expect(moveZones).toHaveLength(1)
    expect(sceneRoot.querySelector('[data-motion-border]')).toBeNull()

    moveZones[0]!.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    moveZones[0]!.dispatchEvent(pointerEvent('pointermove', 240, 200))
    moveZones[0]!.dispatchEvent(pointerEvent('pointerup', 240, 200))
    await waitTurns(24)

    const committedScene = actor.getSnapshot().context.scene!
    const committedItem = committedScene.items.find((item) => item.id === 'item')!
    const firstKeyframe = committedItem.keyframes.find((keyframe) => keyframe.id === 'first-kf')!
    const lastKeyframe = committedItem.keyframes.find((keyframe) => keyframe.id === 'last-kf')!
    expect(committedItem.keyframes).toHaveLength(2)
    expect(firstKeyframe.decorId).toBe('first')
    expect(lastKeyframe.decorId).not.toBe('first')
    expect(committedScene.decors.first?.offset?.translate).toEqual({ x: 10, y: 10 })
    expect(committedScene.decors[lastKeyframe.decorId]?.offset?.translate).toEqual({ x: 20, y: 15 })
  })

  it('projette tous les ghosts de la chaîne et repositionne le KF exact sans en créer un autre', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const chainKeyframes = [0, 500, 1_000, 1_500, 2_000].map((timeMs, index) => ({
      id: `chain-kf-${index}`,
      timeMs,
      decorId: `chain-decor-${index}`,
    }))
    const chainDecors = Object.fromEntries(chainKeyframes.map((keyframe, index) => [keyframe.decorId, {
      id: keyframe.decorId,
      offset: {
        translate: { x: 10 + index * 10, y: 10 + index * 5 },
        width: 20,
        height: 20,
      },
    }]))
    const documentScene = {
      ...baseScene,
      items: [{
        ...baseScene.items[0]!,
        initialDecorId: 'chain-decor-0',
        keyframes: chainKeyframes,
      }],
      decors: chainDecors,
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'chain-kf-2' })
    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)

    const ghosts = [...sceneRoot.querySelectorAll<HTMLElement>('[data-motion-ghost]')]
    expect(ghosts).toHaveLength(5)
    expect(new Set(ghosts.map((ghost) => ghost.dataset.motionKeyframeId))).toEqual(new Set(
      chainKeyframes.map((keyframe) => keyframe.id),
    ))
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-2"]')?.style.display).toBe('none')
    for (const keyframe of chainKeyframes.filter((candidate) => candidate.id !== 'chain-kf-2')) {
      expect(sceneRoot.querySelector<HTMLElement>(`[data-motion-keyframe-id="${keyframe.id}"]`)?.style.display).not.toBe('none')
    }
    expect(sceneRoot.querySelectorAll('[data-motion-path]')).toHaveLength(4)
    expect(sceneRoot.querySelectorAll('[data-motion-path-inactive]')).toHaveLength(3)
    expect(sceneRoot.querySelectorAll('[data-motion-path-control]')).toHaveLength(1)

    const nearGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-1"]')!
    const nearbyInactiveGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-3"]')!
    const farGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-0"]')!
    expect(nearGhost.dataset.motionGhostDistance).toBe('1')
    expect(farGhost.dataset.motionGhostDistance).toBe('2')
    expect(nearGhost.style.opacity).toBe('1')
    expect(nearbyInactiveGhost.style.opacity).toBe('0.18')
    expect(farGhost.style.opacity).toBe('0.14')
    expect(nearbyInactiveGhost.style.borderColor).not.toBe(farGhost.style.borderColor)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    frame.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    frame.dispatchEvent(pointerEvent('pointermove', 280, 220))
    frame.dispatchEvent(pointerEvent('pointerup', 280, 220))
    expect(actor.getSnapshot().context.scene!.items[0]!.keyframes).toHaveLength(5)

    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)
    const committed = actor.getSnapshot().context.scene!
    const committedItem = committed.items[0]!
    expect(committedItem.keyframes).toHaveLength(5)
    expect(committed.decors['chain-decor-2']?.offset).toMatchObject({ translate: { x: 35, y: 22.5 } })
    expect(committed.decors['chain-decor-1']?.offset).toMatchObject({ translate: { x: 20, y: 15 } })
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-2"]')?.style.display).toBe('none')

    const distantGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-keyframe-id="chain-kf-4"]')!
    distantGhost.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'chain-kf-4' })
  })

  it('conserve la translation repositionnée quand un resize suit sur le même KF', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)

    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-motion-central]')!
    const middleBaseLeft = Number.parseFloat(moveZone.style.left)
    const middleBaseTop = Number.parseFloat(moveZone.style.top)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const target = actor.getSnapshot().context.scene!.items.find((candidate) => candidate.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 500)!
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const targetBefore = actor.getSnapshot().context.scene!.decors[target.decorId]?.offset
    expect(targetBefore).toMatchObject({ width: 20, height: 20 })
    expect(targetBefore?.translate?.x).toBeCloseTo((middleBaseLeft + 80) / 8)
    expect(targetBefore?.translate?.y).toBeCloseTo((middleBaseTop + 40) / 8)

    // A stale presentation frame is possible during the asynchronous target seek. It must not
    // replace the accepted CS candidate used as the base of the next gesture.
    const presentationPort = coordination.presentation as unknown as {
      get: () => EditorPlayerPresentationFrame | null
    }
    presentationPort.get = () => ({
      timeMs: 500,
      playerTimeMs: 500,
      items: [{
        itemId: 'story-main:item',
        pose: {
          origin: { x: 80, y: 80 },
          matrix: { a: 1, b: 0, c: 0, d: 1 },
          localWidth: 160,
          localHeight: 160,
        },
        representation: 'local',
        progress: 1,
      }],
    })

    // Reposition on the current target KF, then resize it. The resize must start from the
    // repositioned target pose, not from the stale source presentation.
    frame.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    frame.dispatchEvent(pointerEvent('pointermove', 280, 220))
    frame.dispatchEvent(pointerEvent('pointerup', 280, 220))
    const targetAfterMove = frame.getAttribute('style')
    const east = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-handle="e"]')!
    east.dispatchEvent(pointerEvent('pointerdown', 300, 220))
    east.dispatchEvent(pointerEvent('pointermove', 330, 220))
    east.dispatchEvent(pointerEvent('pointerup', 330, 220))
    expect(Number.parseFloat(frame.style.left)).toBeCloseTo(middleBaseLeft + 80 + 40)
    expect(frame.getAttribute('style')).not.toBe(targetAfterMove)

    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)
    const committed = actor.getSnapshot().context.scene!
    const committedTarget = committed.items.find((candidate) => candidate.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 500)!
    expect(committed.decors[committedTarget.decorId]?.offset).toMatchObject({
      width: 23.75,
    })
    expect(committed.decors[committedTarget.decorId]?.offset?.translate?.x).toBeCloseTo((middleBaseLeft + 80 + 40) / 8)
    expect(committed.decors[committedTarget.decorId]?.offset?.translate?.y).toBeCloseTo((middleBaseTop + 40 + 20) / 8)
  })

  it('reprojette le CS, les ghosts et tous les paths quand la racine change de largeur', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    const resizeCallbacks: Array<() => void> = []
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(() => callback([], this as unknown as ResizeObserver))
      }
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const documentScene = scene()
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    let rootWidth = 800
    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: rootWidth, height: rootWidth * 9 / 16, top: 0, left: 0, right: rootWidth, bottom: rootWidth * 9 / 16 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns(24)

    // The runtime and decor bridges observe the same root. Give the staged player root the same
    // measurable width so its resize callback refreshes PresentationFrame before the decor pass.
    const playerRoot = sceneRoot.querySelector<HTMLElement>('.editor-v2-instance-root')
    expect(playerRoot).not.toBeNull()
    Object.defineProperty(playerRoot!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: rootWidth, height: rootWidth * 9 / 16, top: 0, left: 0, right: rootWidth, bottom: rootWidth * 9 / 16 }),
    })

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)
    const moveZone = sceneRoot.querySelector<HTMLElement>('[data-motion-central]')!
    const middleBaseLeft = Number.parseFloat(moveZone.style.left)
    moveZone.dispatchEvent(pointerEvent('pointerdown', 100, 100))
    moveZone.dispatchEvent(pointerEvent('pointermove', 180, 140))
    moveZone.dispatchEvent(pointerEvent('pointerup', 180, 140))
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    const sourceGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')!
    const targetGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="target"]')!
    const path = sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')!
    const before = {
      frame: { left: frame.style.left, width: frame.style.width },
      source: { left: sourceGhost.style.left, width: sourceGhost.style.width },
      target: { left: targetGhost.style.left, width: targetGhost.style.width },
      path: path.getAttribute('d'),
    }
    expect(Number.parseFloat(before.frame.left)).toBeCloseTo(middleBaseLeft + 80)
    expect(before.frame.width).toBe('160px')
    expect(targetGhost.style.display).toBe('none')

    rootWidth = 400
    // First callback is CodPlay's runtime resize; the last one is the decor bridge projection.
    resizeCallbacks.forEach((callback) => callback())
    await waitTurns(24)
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(Number.parseFloat(frame.style.left)).toBeCloseTo((middleBaseLeft + 80) / 2)
    expect(frame.style.width).toBe('80px')
    expect(sourceGhost.style.left).toBe('40px')
    expect(sourceGhost.style.width).toBe('80px')
    // The overlay uses the empty inline display value for a visible ghost so the
    // stylesheet remains in charge of its layout; only `none` means hidden.
    expect(sourceGhost.style.display).not.toBe('none')
    expect(targetGhost.style.left).toBe(frame.style.left)
    expect(targetGhost.style.width).toBe('80px')
    expect(targetGhost.style.display).toBe('none')
    expect(path.getAttribute('d')).not.toBe(before.path)
  })

  it('garde la pose du dernier KF quand le segment actif commence au KF milieu', async () => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const baseScene = scene()
    const documentScene = {
      ...baseScene,
      items: [{
        ...baseScene.items[0]!,
        keyframes: [
          baseScene.items[0]!.keyframes[0]!,
          { id: 'middle-kf', timeMs: 500, decorId: 'middle' },
          { ...baseScene.items[0]!.keyframes[1]!, timeMs: 1_000 },
        ],
      }],
      decors: {
        ...baseScene.decors,
        middle: { id: 'middle', offset: { translate: { x: 30, y: 30 }, width: 20, height: 20, rotate: 45 } },
        last: {
          ...baseScene.decors.last!,
          offset: { translate: { x: 60, y: 60 }, width: 20, height: 20, rotate: 90 },
          path: 'M 0 0 A 0.65 0.65 0 0 1 1 0',
        },
      },
    }
    actor.send({ type: 'SCENE_LOADED', scene: documentScene })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())

    const sceneRoot = document.createElement('div')
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'middle-kf' })
    actor.send({ type: 'SEEK', timelineMs: 500 })
    await waitTurns(24)

    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'], keyframeId: 'last-kf' })
    actor.send({ type: 'SEEK', timelineMs: 1_000 })
    await waitTurns(24)

    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    expect(frame.style.left).toBe('480px')
    expect(frame.style.top).toBe('480px')
    expect(frame.style.transform).toContain('rotate(90deg)')
    // The selected middle→last segment is the only editable path. The preceding first→middle
    // trajectory remains visible as a faint artefact and does not add another control point.
    expect(sceneRoot.querySelectorAll('[data-motion-path]')).toHaveLength(2)
    expect(sceneRoot.querySelectorAll('[data-motion-path-inactive]')).toHaveLength(1)
    expect(sceneRoot.querySelectorAll('[data-motion-path-control]')).toHaveLength(1)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path-inactive]')?.style.opacity).toBe('0.15')
    const initialGhost = sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="initial"]')
    expect(initialGhost?.style.display).toBe('')
    expect(initialGhost?.style.left).toBe('80px')
    expect(initialGhost?.style.top).toBe('80px')
    expect(initialGhost?.style.opacity).toBe('0.14')
    initialGhost?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await waitTurns(24)
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: 'first-kf' })
  })
})

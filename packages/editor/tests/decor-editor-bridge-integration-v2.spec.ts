/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../src/app/bridges/decor-editor-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'

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

  it('crée un KF cible depuis la zone centrale sans toucher au parent et laisse les artefacts hors scène', async () => {
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

    const committedScene = actor.getSnapshot().context.scene!
    const committedItem = committedScene.items.find((item) => item.id === 'item')!
    const target = committedItem.keyframes.find((keyframe) => keyframe.timeMs === 500)
    expect(target).toBeDefined()
    expect(committedItem.parentId).toBe(documentScene.items[0]!.parentId)
    expect(committedScene.decors[target!.decorId]?.offset).toMatchObject({ translate: { x: 20, y: 15 } })
    expect(actor.getSnapshot().context.selection).toMatchObject({ itemIds: ['item'], keyframeId: target!.id })
    expect(sceneRoot.querySelector<HTMLElement>('[data-motion-ghost="source"]')?.style.display).toBe('')
    expect(sceneRoot.querySelector('[data-selection-frame="v2"]')).not.toBeNull()

    // A second central drag starts from the currently active target, not from the original source.
    // This keeps repeated intra-capsule moves composable while the sequence-editor remains untouched.
    moveZone!.dispatchEvent(pointerEvent('pointerdown', 240, 200))
    moveZone!.dispatchEvent(pointerEvent('pointermove', 300, 230))
    moveZone!.dispatchEvent(pointerEvent('pointerup', 300, 230))
    await waitTurns(24)
    const secondTarget = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 1_000)
    expect(secondTarget).toBeDefined()
    expect(actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes).toHaveLength(4)

    const pathControl = sceneRoot.querySelector<HTMLElement>('[data-motion-path-control]')
    expect(pathControl).not.toBeNull()
    pathControl!.dispatchEvent(pointerEvent('pointerdown', 200, 180))
    pathControl!.dispatchEvent(pointerEvent('pointermove', 200, 240))
    pathControl!.dispatchEvent(pointerEvent('pointerup', 200, 240))
    await waitTurns(24)
    const pathDecorId = actor.getSnapshot().context.scene!.items.find((item) => item.id === 'item')!.keyframes.find((keyframe) => keyframe.timeMs === 1_000)!.decorId
    expect(actor.getSnapshot().context.scene!.decors[pathDecorId]?.path).toMatch(/^M 0 0 A /)

    // Seeking inside the active segment must not rebuild the path from the live interpolated
    // snapshot. The target decor remains the authored source of the path, while the CS follows
    // its projected point at the new time.
    const pathBeforeSeek = sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')
    const frameBeforeSeek = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')
    expect(pathBeforeSeek).toContain('A')
    actor.send({ type: 'SEEK', timelineMs: 750 })
    await waitTurns(24)
    expect(sceneRoot.querySelector<SVGPathElement>('[data-motion-path]')?.getAttribute('d')).toBe(pathBeforeSeek)
    expect(frameBeforeSeek?.style.left).not.toBe('')
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
})

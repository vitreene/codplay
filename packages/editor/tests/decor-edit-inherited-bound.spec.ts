/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../src/app/bridges/decor-editor-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import { EditorActionsFacade } from '../src/app/facades/editor-actions-facade'
import type { EditorScene } from '../src/app/commands/types'
import { resolveTarget } from '../src/app/bridges/decor-edit/decor-target'
import { resolveSceneBounds } from '../src/scene-bounds/scene-bounds'

/** One root item locked at 1000 ms whose outro is inherited from the root (5000 ms). */
function sceneWithInheritedOutro(): EditorScene {
  return {
    id: 'inherited-outro',
    meta: { title: 'Inherited outro', durationMs: 5_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'item', type: 'text', parentId: null, order: 'a', visible: true, contentId: 'content', initialDecorId: 'first',
      keyframes: [{ id: 'first-kf', timeMs: 1_000, decorId: 'first', channel: 'pose' }],
    }],
    contents: { content: { id: 'content', type: 'text', text: 'item' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { 'background-color': 'oklch(0.628 0.2577 29.23)' } },
    },
    zones: {},
    markerTracks: {},
  }
}

/** Lets the bridges, the player and the session settle. */
async function waitTurns(count = 24): Promise<void> {
  for (let index = 0; index < count; index += 1) await Promise.resolve()
}

/** Pointer event shape consumed by the Selection Frame. */
function pointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY, button: 0 })
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

describe('Decor edit on an inherited bound (B-4)', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let sceneBridge: ReturnType<typeof createScenePlayerBridge> | undefined
  let decorBridge: ReturnType<typeof createDecorEditorBridge> | undefined
  let actions: EditorActionsFacade | undefined
  let originalResizeObserver: typeof ResizeObserver | undefined

  afterEach(() => {
    decorBridge?.destroy()
    actions?.destroy()
    sceneBridge?.destroy()
    coordination?.destroy()
    actor?.stop()
    if (originalResizeObserver !== undefined) globalThis.ResizeObserver = originalResizeObserver
    document.body.replaceChildren()
    decorBridge = actions = sceneBridge = coordination = actor = originalResizeObserver = undefined
  })

  /** Mounts the real controller, player and Decor bridges with the playhead on the inherited outro. */
  async function mountAtInheritedOutro() {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class { observe(): void {} disconnect(): void {} } as unknown as typeof ResizeObserver
    actor = createActor(controllerMachine)
    actor.start()
    actions = new EditorActionsFacade(actor)
    actor.send({ type: 'SCENE_LOADED', scene: sceneWithInheritedOutro() })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    const sceneRoot = document.createElement('div')
    sceneRoot.style.width = '800px'
    Object.defineProperty(sceneRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination, actions)
    await waitTurns()
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item'] })
    actor.send({ type: 'SEEK', timelineMs: 5_000 })
    await waitTurns()
    return { sceneRoot, decorPanel }
  }

  it('targets the inherited outro when the playhead sits on it', () => {
    const scene = sceneWithInheritedOutro()
    expect(resolveSceneBounds(scene).nodes.get('item')?.outro).toMatchObject({ timeMs: 5_000, origin: 'implicit' })
    expect(resolveTarget(scene, { itemIds: ['item'], keyframeId: null }, 5_000)).toMatchObject({ isTemporary: true, bound: 'outro', writeDecorId: null })
    expect(resolveTarget(scene, { itemIds: ['item'], keyframeId: null }, 4_000)?.bound).toBeUndefined()
  })

  it('creates a linked decor keyframe with its own decor from a palette edit', async () => {
    const { decorPanel } = await mountAtInheritedOutro()
    const colorInput = decorPanel.querySelector<HTMLInputElement>('input[type="color"]')!
    colorInput.value = '#00ff00'
    colorInput.dispatchEvent(new Event('input', { bubbles: true }))
    colorInput.dispatchEvent(new Event('change', { bubbles: true }))
    await waitTurns()

    const committed = actor!.getSnapshot().context.scene!
    const created = committed.items[0]!.keyframes.find((keyframe) => keyframe.id !== 'first-kf')!
    expect(created).toMatchObject({ timeMs: 5_000, channel: 'decor', autoBound: 'outro' })
    expect(committed.decors[created.decorId]?.style).toEqual({ 'background-color': 'oklch(0.8664 0.2948 142.5)' })
    // The bound itself stays implicit: a decor keyframe does not place the item.
    expect(resolveSceneBounds(committed).nodes.get('item')?.outro.origin).toBe('implicit')
  })

  it('creates the linked pose bound with the complete pose from a Selection Frame move', async () => {
    const { sceneRoot } = await mountAtInheritedOutro()
    const frame = sceneRoot.querySelector<HTMLElement>('[data-selection-frame="v2"]')!
    frame.dispatchEvent(pointerEvent('pointerdown', 160, 160))
    frame.dispatchEvent(pointerEvent('pointermove', 240, 200))
    frame.dispatchEvent(pointerEvent('pointerup', 240, 200))
    await waitTurns()

    const committed = actor!.getSnapshot().context.scene!
    const created = committed.items[0]!.keyframes.find((keyframe) => keyframe.id !== 'first-kf')!
    expect(created).toMatchObject({ timeMs: 5_000, channel: 'pose', autoBound: 'outro' })
    expect(committed.decors[created.decorId]?.offset?.translate).toEqual({ x: 20, y: 15 })
    expect(committed.decors.first?.offset?.translate).toEqual({ x: 10, y: 10 })
    expect(resolveSceneBounds(committed).nodes.get('item')?.outro).toMatchObject({ timeMs: 5_000, origin: 'linked' })
  })
})

/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { createDecorEditorBridge } from '../src/app/bridges/decor-editor-bridge'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import { createEmptyEditorScene } from '../src/app/scenes/editor-scene'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorActionsFacade } from '../src/app/facades/editor-actions-facade'
import { ROOT_PLACEMENT_GRID } from '../src/app/commands/root-placement-commands'
import type { RootPlacementMode } from '../src/app/commands/types'

/** Lets the scene-player bridge finish one staged rebuild and its author-time seek. */
async function waitTurns(count = 20): Promise<void> {
  for (let index = 0; index < count; index += 1) await Promise.resolve()
}

/** Builds pointer events with local coordinates for the full-scene creation surface. */
function pointerEvent(type: string, x: number, y: number): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    buttons: { value: type === 'pointerup' ? 0 : 1 },
    offsetX: { value: x },
    offsetY: { value: y },
  })
  return event
}

beforeAll(() => {
  if (typeof HTMLElement.prototype.setPointerCapture !== 'function') {
    HTMLElement.prototype.setPointerCapture = function (): void {}
    HTMLElement.prototype.hasPointerCapture = function (): boolean { return false }
    HTMLElement.prototype.releasePointerCapture = function (): void {}
  }
})

describe('block creation V2 through Editor commands and player bridge', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let playerBridge: ReturnType<typeof createScenePlayerBridge> | undefined
  let decorBridge: ReturnType<typeof createDecorEditorBridge> | undefined
  let actions: EditorActionsFacade | undefined
  let playerFacade: EditorPlayerCommandFacade | undefined
  let originalResizeObserver: typeof ResizeObserver | undefined

  afterEach(() => {
    decorBridge?.destroy()
    playerBridge?.destroy()
    coordination?.destroy()
    actions?.destroy()
    playerFacade?.destroy()
    actor?.stop()
    if (originalResizeObserver !== undefined) globalThis.ResizeObserver = originalResizeObserver
    document.body.replaceChildren()
    actor = undefined
    coordination = undefined
    playerBridge = undefined
    decorBridge = undefined
    actions = undefined
    playerFacade = undefined
    originalResizeObserver = undefined
  })

  it.each([
    { mode: 'transform' as const, startX: 80, startY: 60, endX: 240, endY: 180 },
    { mode: 'fine-grid' as const, startX: 40, startY: 30, endX: 120, endY: 90 },
  ])('creates and selects a block in $mode mode, with decor palette and undo/redo', async ({ mode, startX, startY, endX, endY }) => {
    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver

    actor = createActor(controllerMachine)
    actor.start()
    const scene = createEmptyEditorScene('Bloc de test')
    const grid = ROOT_PLACEMENT_GRID[mode as RootPlacementMode]
    actor.send({ type: 'SCENE_LOADED', scene: { ...scene, rootCapsule: { ...scene.rootCapsule!, grid } } })
    actions = new EditorActionsFacade(actor)
    playerFacade = new EditorPlayerCommandFacade()
    coordination = new EditorCoordinationBridge(actor, playerFacade)

    const sceneRoot = document.createElement('div')
    Object.defineProperties(sceneRoot, {
      clientWidth: { configurable: true, value: 800 },
      clientHeight: { configurable: true, value: 450 },
    })
    const decorPanel = document.createElement('div')
    document.body.append(sceneRoot, decorPanel)
    playerBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
    decorBridge = createDecorEditorBridge(decorPanel, actor, coordination)
    await waitTurns()

    actions.beginBlockCreation(mode)
    const surface = sceneRoot.querySelector<HTMLElement>('[data-selection-frame-creation="v2"]')!
    surface.dispatchEvent(pointerEvent('pointerdown', startX, startY))
    surface.dispatchEvent(pointerEvent('pointermove', endX, endY))
    surface.dispatchEvent(pointerEvent('pointerup', endX, endY))
    await waitTurns()

    const createdScene = actor.getSnapshot().context.scene!
    const item = createdScene.items[0]!
    const decor = createdScene.decors[item.initialDecorId]!
    expect(item).toMatchObject({ type: 'bloc', parentId: null, contentId: null })
    expect(actor.getSnapshot().context.selection.itemIds).toEqual([item.id])
    expect(decorPanel.querySelector('[data-decor-property-path="style.background-color"]')).not.toBeNull()
    expect(decorPanel.querySelector('[data-decor-property-path="style.font-size"]')).toBeNull()

    if (mode === 'transform') {
      expect(createdScene.zones).toEqual({})
      expect(decor.offset).toEqual({
        translate: { x: 10, y: 7.5 },
        width: 20,
        height: 15,
      })
    }
    if (mode === 'fine-grid') {
      expect(decor.zoneId).toBeDefined()
      expect(createdScene.zones[decor.zoneId!]).toMatchObject({
        capsuleId: null,
        surfaces: {
          landscape: { row: 7, col: 9, rowSpan: 12, colSpan: 16 },
          portrait: { row: 7, col: 9, rowSpan: 12, colSpan: 16 },
        },
      })
    }

    actions.undo()
    expect(actor.getSnapshot().context.scene?.items).toHaveLength(0)
    expect(actor.getSnapshot().context.scene?.zones).toEqual({})
    actions.redo()
    expect(actor.getSnapshot().context.scene?.items).toHaveLength(1)
    expect(actor.getSnapshot().context.scene?.zones).toEqual(mode === 'transform' ? {} : createdScene.zones)
  })
})

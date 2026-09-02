/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
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
})

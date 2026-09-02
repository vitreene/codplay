/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { createSequenceEditorBridge } from '../src/app/bridges/sequence-editor-bridge'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import { controllerMachine } from '../src/app/controller/controller-machine'
import type { EditorScene } from '../src/app/commands/types'

function scene(): EditorScene {
  return {
    id: 'sequence-bridge-v2',
    meta: { title: 'Sequence bridge V2', durationMs: 1000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'item-1', type: 'text', parentId: null, order: 'a', visible: true, contentId: null,
      initialDecorId: 'decor-initial',
      keyframes: [
        { id: 'kf-a', timeMs: 0, decorId: 'decor-a' },
        { id: 'kf-b', timeMs: 1000, decorId: 'decor-b' },
      ],
    }],
    contents: {},
    decors: {
      'decor-initial': { id: 'decor-initial', style: { color: 'black' } },
      'decor-a': { id: 'decor-a', style: { color: 'black' }, offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 } },
      'decor-b': { id: 'decor-b', style: { color: 'white' }, offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 } },
    },
    zones: {},
    markerTracks: {},
  }
}

describe('sequence-editor bridge V2 — capture de preview temporaire', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let bridge: { destroy(): void } | undefined

  afterEach(() => {
    bridge?.destroy()
    coordination?.destroy()
    actor?.stop()
    document.body.replaceChildren()
    bridge = undefined
    coordination = undefined
    actor = undefined
  })

  it('remplit le décor frais du keyframe et le sélectionne même si le temps preview est 12,5 ms avant le pas', () => {
    actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: scene() })
    coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    const container = document.createElement('div')
    document.body.append(container)
    const originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
    bridge = createSequenceEditorBridge(container, actor, coordination)
    globalThis.ResizeObserver = originalResizeObserver

    coordination.decorPreview.set({
      itemId: 'item-1',
      timeMs: 487.5,
      patch: {
        style: { color: 'red' },
        offset: { translate: { x: 32, y: 18 }, width: 24, height: 22 },
      },
    })

    const row = container.querySelector<HTMLElement>('.seq-row[data-track-id="item-1"]')
    if (!row) throw new Error('sequence row missing')
    Object.defineProperty(row, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 1000, bottom: 28, width: 1000, height: 28 }),
    })
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 45, clientY: 14, detail: 2 }))

    const committed = actor.getSnapshot().context.scene
    const created = committed?.items[0]?.keyframes.find((keyframe) => keyframe.id !== 'kf-a' && keyframe.id !== 'kf-b')
    expect(created).toBeDefined()
    expect(created?.timeMs).toBe(500)
    expect(created?.decorId).toMatch(/^decor-/)
    expect(committed?.decors[created!.decorId]).toMatchObject({
      style: { color: 'red' },
      offset: { translate: { x: 32, y: 18 }, width: 24, height: 22 },
    })
    expect(actor.getSnapshot().context.selection).toEqual({ itemIds: ['item-1'], keyframeId: created?.id })
    expect(coordination.decorPreview.getForKeyframe('item-1', created!.timeMs)).toBeNull()
  })
})

// @vitest-environment jsdom

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import type { EditorScene } from '../../src/sequence-editor/types'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

function sceneWithRootSingleKeyframe(): EditorScene {
  return {
    id: 'root-virtual-bound',
    meta: {
      title: 'Root virtual bound',
      durationMs: 5000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    items: [{
      id: 'item-1',
      type: 'text',
      label: 'Item',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'decor-1',
      keyframes: [{ id: 'kf-1', timeMs: 1000, decorId: 'decor-1' }],
    }],
    contents: {},
    decors: { 'decor-1': { id: 'decor-1' } },
    zones: {},
    markerTracks: {},
  }
}

function sceneWithRootNoKeyframes(): EditorScene {
  const scene = sceneWithRootSingleKeyframe()
  return {
    ...scene,
    id: 'root-virtual-bounds-empty',
    items: [{ ...scene.items[0]!, keyframes: [] }],
  }
}

/** Creates the minimal pointer event shape consumed by the sequence-editor drag relay. */
function pointerEvent(type: string, clientX: number): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  Object.defineProperty(event, 'buttons', { value: type === 'pointerup' ? 0 : 1 })
  return event as PointerEvent
}

describe('sequence-editor — bornes virtuelles de la capsule racine', () => {
  let controller: SequenceEditorController | undefined
  let handle: { destroy(): void } | undefined

  afterEach(() => {
    handle?.destroy()
    controller?.destroy()
    handle = undefined
    controller = undefined
    document.body.replaceChildren()
  })

  it('affiche la sortie virtuelle et ne l’écrit qu’après une action explicite', () => {
    controller = new SequenceEditorController(sceneWithRootSingleKeyframe())
    const batches: Array<Array<{ name: string; args: Record<string, unknown> }>> = []
    controller.onCommand((commands) => batches.push(commands as Array<{ name: string; args: Record<string, unknown> }>))

    const container = document.createElement('div')
    document.body.append(container)
    handle = mountSequenceEditor(container, controller)

    let virtual = container.querySelector<SVGGElement>('[data-kf-id="vkf-item-1-outro"]')
    expect(virtual).not.toBeNull()
    expect(virtual?.classList.contains('seq-kf--virtual')).toBe(true)
    expect(batches).toHaveLength(0)

    controller.seek(3000)
    controller.notifyResize(640, 480)
    expect(batches).toHaveLength(0)

    virtual = container.querySelector<SVGGElement>('[data-kf-id="vkf-item-1-outro"]')
    expect(virtual).not.toBeNull()
    virtual!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }))
    expect(batches).toHaveLength(2)
    expect(batches[0]?.[0]).toMatchObject({
      name: 'createNamedKeyframe',
      args: { itemId: 'item-1', timeMs: 5000, decorId: 'decor-1' },
    })
    expect(batches[1]?.[0]).toMatchObject({
      name: 'renameKeyframe',
      args: { itemId: 'item-1', name: 'outro' },
    })
  })

  it('matérialise l’intro virtuelle en héritant le décor initial', () => {
    controller = new SequenceEditorController(sceneWithRootNoKeyframes())
    const batches: Array<Array<{ name: string; args: Record<string, unknown> }>> = []
    controller.onCommand((commands) => batches.push(commands as Array<{ name: string; args: Record<string, unknown> }>))

    const container = document.createElement('div')
    document.body.append(container)
    handle = mountSequenceEditor(container, controller)

    const virtual = container.querySelector<SVGGElement>('[data-kf-id="vkf-item-1-intro"]')
    expect(virtual).not.toBeNull()
    virtual!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, detail: 2 }))

    expect(batches[0]?.[0]).toMatchObject({
      name: 'createNamedKeyframe',
      args: { itemId: 'item-1', timeMs: 0, decorId: 'decor-1' },
    })
    expect(batches[1]?.[0]).toMatchObject({ name: 'renameKeyframe', args: { itemId: 'item-1', name: 'intro' } })
  })

  it('déplace une borne virtuelle par glisser-déposer et respecte Échap', () => {
    controller = new SequenceEditorController(sceneWithRootSingleKeyframe())
    const batches: Array<Array<{ name: string; args: Record<string, unknown> }>> = []
    controller.onCommand((commands) => batches.push(commands as Array<{ name: string; args: Record<string, unknown> }>))

    const container = document.createElement('div')
    document.body.append(container)
    handle = mountSequenceEditor(container, controller)

    const virtual = container.querySelector<SVGGElement>('[data-kf-id="vkf-item-1-outro"]')
    expect(virtual).not.toBeNull()
    virtual!.dispatchEvent(pointerEvent('pointerdown', 406))
    window.dispatchEvent(pointerEvent('pointermove', 206))
    window.dispatchEvent(pointerEvent('pointerup', 206))

    expect(batches[0]?.[0]).toMatchObject({
      name: 'createNamedKeyframe',
      args: { itemId: 'item-1', timeMs: 2500, decorId: 'decor-1' },
    })
    expect(batches[1]?.[0]).toMatchObject({ name: 'renameKeyframe', args: { itemId: 'item-1', name: 'outro' } })

    batches.length = 0
    const freshVirtual = container.querySelector<SVGGElement>('[data-kf-id="vkf-item-1-outro"]')
    expect(freshVirtual).not.toBeNull()
    freshVirtual!.dispatchEvent(pointerEvent('pointerdown', 406))
    window.dispatchEvent(pointerEvent('pointermove', 206))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    window.dispatchEvent(pointerEvent('pointerup', 206))
    expect(batches).toHaveLength(0)
  })
})

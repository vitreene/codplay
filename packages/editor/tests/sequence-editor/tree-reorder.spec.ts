/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { EditorScene, Item } from '../../src/app/commands/types'
import type { Command } from '../../src/app/controller/types'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import { descendantIds } from '../../src/sequence-editor/utils'
import { resolveTrackDrop } from '../../src/sequence-editor/tree-reorder'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

let controller: SequenceEditorController | undefined
let unmount: (() => void) | undefined

function item(id: string, order: string, parentId: string | null = null, type: Item['type'] = 'text'): Item {
  return {
    id,
    type,
    label: id,
    parentId,
    order,
    visible: true,
    contentId: null,
    initialDecorId: `decor-${id}`,
    keyframes: [],
    ...(type === 'capsule' ? { capsule: { kind: 'rangee' as const, distribution: { mode: 'sequential' as const } } } : {}),
  }
}

function scene(items: Item[]): EditorScene {
  return {
    id: 'scene',
    meta: { title: 'Scene', durationMs: 1000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items,
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
  }
}

describe('resolveTrackDrop', () => {
  const items = [
    item('back', 'a'),
    item('capsule-a', 'b', null, 'capsule'),
    item('nested', 'a', 'capsule-a'),
    item('capsule-b', 'c', null, 'capsule'),
    item('front', 'd'),
  ]

  it('moves an item before the first root sibling using adjacent order anchors', () => {
    expect(resolveTrackDrop(scene(items), 'back', 'front', 'before')).toEqual({
      trackId: 'back',
      parentId: null,
      afterItemId: 'front',
    })
  })

  it('moves an item between capsules at their shared hierarchy level', () => {
    expect(resolveTrackDrop(scene(items), 'nested', 'capsule-b', 'after')).toEqual({
      trackId: 'nested',
      parentId: null,
      afterItemId: 'capsule-a',
      beforeItemId: 'capsule-b',
    })
  })

  it('moves onto a capsule to make the item its child', () => {
    expect(resolveTrackDrop(scene(items), 'front', 'capsule-a', 'inside')).toEqual({
      trackId: 'front',
      parentId: 'capsule-a',
    })
  })

  it('rejects a no-op and a move that would create a hierarchy cycle', () => {
    const current = scene(items)
    expect(resolveTrackDrop(current, 'capsule-a', 'capsule-a', 'after')).toBeNull()
    expect(resolveTrackDrop(current, 'capsule-a', 'nested', 'inside')).toBeNull()
    expect(descendantIds(current.items, 'capsule-a')).toEqual(['nested'])
  })
})

describe('sequence-editor item list', () => {
  afterEach(() => {
    unmount?.()
    unmount = undefined
    controller?.destroy()
    controller = undefined
    document.body.replaceChildren()
  })

  it('shows front items first and routes drag reordering through attachItem', () => {
    const currentScene = scene([item('back', 'a'), item('middle', 'b'), item('front', 'c')])
    const container = document.createElement('div')
    document.body.append(container)
    controller = new SequenceEditorController(currentScene)
    const batches: Command[][] = []
    const unsubscribe = controller.onCommand((commands) => batches.push(commands))
    const handle = mountSequenceEditor(container, controller)
    unmount = () => {
      unsubscribe()
      handle.destroy()
    }

    expect([...container.querySelectorAll<HTMLElement>('.seq-label-row[data-track-id]')]
      .map((row) => row.dataset.trackId)).toEqual(['front', 'middle', 'back'])

    const source = container.querySelector<HTMLElement>('[data-track-id="back"]')!
    const target = container.querySelector<HTMLElement>('[data-track-id="front"]')!
    const dataTransfer = { setData: () => undefined, effectAllowed: '', dropEffect: '' }
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer })
    source.dispatchEvent(dragStart)
    const dragOver = new Event('dragover', { bubbles: true, cancelable: true })
    Object.defineProperties(dragOver, {
      clientY: { value: 0 },
      dataTransfer: { value: dataTransfer },
    })
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, bottom: 28, left: 0, right: 300, width: 300, height: 28, x: 0, y: 0, toJSON: () => ({}) }),
    })
    target.dispatchEvent(dragOver)
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperties(drop, {
      clientY: { value: 0 },
      dataTransfer: { value: dataTransfer },
    })
    target.dispatchEvent(drop)

    expect(batches).toEqual([[
      { name: 'attachItem', args: { itemId: 'back', parentId: null, afterItemId: 'front' } },
    ]])
  })

  it('accepts a drop in the leading blank area before the first track', () => {
    const currentScene = scene([item('back', 'a'), item('middle', 'b'), item('front', 'c')])
    const container = document.createElement('div')
    document.body.append(container)
    controller = new SequenceEditorController(currentScene)
    const batches: Command[][] = []
    const unsubscribe = controller.onCommand((commands) => batches.push(commands))
    const handle = mountSequenceEditor(container, controller)
    unmount = () => {
      unsubscribe()
      handle.destroy()
    }

    const firstRow = container.querySelector<HTMLElement>('[data-track-id="front"]')!
    const source = container.querySelector<HTMLElement>('[data-track-id="back"]')!
    const leadingSpacer = container.querySelector<HTMLElement>('.seq-labels')!.firstElementChild!
    const dataTransfer = { setData: () => undefined, effectAllowed: '', dropEffect: '' }
    Object.defineProperty(firstRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 100, bottom: 128, left: 0, right: 300, width: 300, height: 28, x: 0, y: 100, toJSON: () => ({}) }),
    })
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer })
    source.dispatchEvent(dragStart)

    const dragOver = new Event('dragover', { bubbles: true, cancelable: true })
    Object.defineProperties(dragOver, { clientY: { value: 90 }, dataTransfer: { value: dataTransfer } })
    leadingSpacer.dispatchEvent(dragOver)
    expect(dragOver.defaultPrevented).toBe(true)
    expect(firstRow.classList.contains('seq-label-row--drop-before')).toBe(true)

    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperties(drop, { clientY: { value: 90 }, dataTransfer: { value: dataTransfer } })
    leadingSpacer.dispatchEvent(drop)

    expect(batches).toEqual([[
      { name: 'attachItem', args: { itemId: 'back', parentId: null, afterItemId: 'front' } },
    ]])
  })

  it('routes a center drop on a capsule to attach the item as its child', () => {
    const currentScene = scene([item('capsule', 'a', null, 'capsule'), item('loose', 'b')])
    const container = document.createElement('div')
    document.body.append(container)
    controller = new SequenceEditorController(currentScene)
    const batches: Command[][] = []
    const unsubscribe = controller.onCommand((commands) => batches.push(commands))
    const handle = mountSequenceEditor(container, controller)
    unmount = () => {
      unsubscribe()
      handle.destroy()
    }

    const source = container.querySelector<HTMLElement>('[data-track-id="loose"]')!
    const target = container.querySelector<HTMLElement>('[data-track-id="capsule"]')!
    Object.defineProperty(target, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ top: 0, bottom: 28, left: 0, right: 300, width: 300, height: 28, x: 0, y: 0, toJSON: () => ({}) }),
    })
    const dataTransfer = { setData: () => undefined, effectAllowed: '', dropEffect: '' }
    const dragStart = new Event('dragstart', { bubbles: true, cancelable: true })
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer })
    source.dispatchEvent(dragStart)
    const dragOver = new Event('dragover', { bubbles: true, cancelable: true })
    Object.defineProperties(dragOver, {
      clientY: { value: 14 },
      dataTransfer: { value: dataTransfer },
    })
    target.dispatchEvent(dragOver)
    expect(target.classList.contains('seq-label-row--drop-inside')).toBe(true)
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperties(drop, {
      clientY: { value: 14 },
      dataTransfer: { value: dataTransfer },
    })
    target.dispatchEvent(drop)

    expect(batches).toEqual([[
      { name: 'attachItem', args: { itemId: 'loose', parentId: 'capsule' } },
    ]])
  })

  it('exposes a per-item delete action through TRACK.REMOVE', () => {
    const currentScene = scene([item('container', 'a', null, 'capsule'), item('child', 'a', 'container')])
    const container = document.createElement('div')
    document.body.append(container)
    controller = new SequenceEditorController(currentScene)
    const batches: Command[][] = []
    const unsubscribe = controller.onCommand((commands) => batches.push(commands))
    const handle = mountSequenceEditor(container, controller)
    unmount = () => {
      unsubscribe()
      handle.destroy()
    }

    const deleteButton = container.querySelector<HTMLButtonElement>('[data-track-id="container"] .seq-label-row__remove')!
    expect(deleteButton.title).toBe('Supprimer l’élément et ses enfants')
    deleteButton.click()

    expect(batches).toEqual([[{ name: 'deleteItem', args: { itemId: 'container' } }]])
  })
})

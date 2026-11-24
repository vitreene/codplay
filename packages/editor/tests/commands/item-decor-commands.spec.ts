import { describe, expect, it } from 'vitest'
import { setItemDecor } from '../../src/app/commands/item-decor/item-decor-commands'
import { decorReferences } from '../../src/app/commands/item-decor/decor-sharing'
import type { EditorScene, Item } from '../../src/app/commands/types'

/** Builds one item whose intro (0 ms) and second keyframe (2 500 ms) both share the initial decor. */
function sharedInitialScene(): EditorScene {
  const item: Item = {
    id: 'item',
    type: 'bloc',
    parentId: null,
    order: 'a',
    visible: true,
    contentId: null,
    initialDecorId: 'initial',
    keyframes: [
      { id: 'intro', timeMs: 0, decorId: 'initial', channel: 'pose' },
      { id: 'second', timeMs: 2500, decorId: 'initial', channel: 'pose' },
    ],
  }
  return {
    id: 'scene',
    meta: { title: 'Decor sharing', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [item],
    contents: {},
    decors: { initial: { id: 'initial', offset: { translate: { x: 10, y: 20 }, width: 30, height: 15 } } },
    zones: {},
    markerTracks: {},
  }
}

describe('setItemDecor — single copy-on-write rule', () => {
  it('gives a non-intro keyframe its own decor instead of writing into the shared initial decor', () => {
    const next = setItemDecor(sharedInitialScene(), {
      itemId: 'item', keyframeId: 'second', patch: { offset: { translate: { x: 50, y: 60 } } }, forkDecorId: 'fork',
    })
    const item = next.items[0]!
    // Moving the item at the second keyframe leaves the intro and the initial state where they were.
    expect(next.decors.initial).toEqual(sharedInitialScene().decors.initial)
    expect(item.initialDecorId).toBe('initial')
    expect(item.keyframes.map((keyframe) => keyframe.decorId)).toEqual(['initial', 'fork'])
    // The fork carries only the sparse edit; the cascade still supplies width and height.
    expect(next.decors.fork).toEqual({ id: 'fork', offset: { translate: { x: 50, y: 60 } } })
  })

  it('writes an intro edit into the initial decor and first gives the other sharers a copy', () => {
    const next = setItemDecor(sharedInitialScene(), {
      itemId: 'item', keyframeId: 'intro', patch: { offset: { rotate: 30 } }, forkDecorId: 'fork',
    })
    const item = next.items[0]!
    expect(item.initialDecorId).toBe('initial')
    expect(item.keyframes.map((keyframe) => keyframe.decorId)).toEqual(['initial', 'fork'])
    expect(next.decors.initial?.offset).toEqual({ translate: { x: 10, y: 20 }, width: 30, height: 15, rotate: 30 })
    // The second keyframe keeps the previous state, unaffected by the intro's rotation.
    expect(next.decors.fork).toEqual({ ...sharedInitialScene().decors.initial, id: 'fork' })
  })

  it('treats an edit of the initial state like an intro edit', () => {
    const next = setItemDecor(sharedInitialScene(), {
      itemId: 'item', keyframeId: null, patch: { style: { color: 'red' } }, forkDecorId: 'fork',
    })
    expect(next.items[0]!.keyframes.map((keyframe) => keyframe.decorId)).toEqual(['initial', 'fork'])
    expect(next.decors.initial?.style).toEqual({ color: 'red' })
    expect(next.decors.fork?.style).toBeUndefined()
  })

  it('merges an unshared edit into the existing decor without erasing nested siblings', () => {
    const scene = sharedInitialScene()
    scene.items[0]!.keyframes[1] = { id: 'second', timeMs: 2500, decorId: 'own', channel: 'pose' }
    scene.decors.own = { id: 'own', offset: { translate: { x: 1, y: 2 }, width: 3 } }
    const next = setItemDecor(scene, {
      itemId: 'item', keyframeId: 'second', patch: { offset: { rotate: 45 } }, forkDecorId: 'unused',
    })
    expect(next.decors.own).toEqual({ id: 'own', offset: { translate: { x: 1, y: 2 }, width: 3, rotate: 45 } })
    expect(next.decors.unused).toBeUndefined()
  })

  it('copies a decor shared with the implicit root before an intro edit', () => {
    const scene = { ...sharedInitialScene(), rootDecorId: 'initial' }
    const next = setItemDecor(scene, {
      itemId: 'item', keyframeId: 'intro', patch: { style: { color: 'blue' } }, forkDecorId: 'fork',
    })
    expect(next.rootDecorId).toBe('fork')
    expect(decorReferences(next, 'initial').map((reference) => reference.kind)).toEqual(['initial', 'keyframe'])
  })
})

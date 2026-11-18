import { describe, expect, it } from 'vitest'
import { runCommand } from '../../src/app/commands/facade'
import type { EditorScene } from '../../src/app/commands/types'

/** Owns a three-pose item whose initial decor is also referenced by another item. */
function rotationScene(): EditorScene {
  const item = {
    id: 'item', type: 'bloc' as const, parentId: null, order: 'a', visible: true,
    contentId: null, initialDecorId: 'initial',
    keyframes: [
      { id: 'first', timeMs: 0, decorId: 'initial' },
      { id: 'middle', timeMs: 1000, decorId: 'middle' },
      { id: 'last', timeMs: 2000, decorId: 'last' },
    ],
  }
  return {
    id: 'rotation-mode',
    meta: { title: 'Rotation', durationMs: 2000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [item, { ...item, id: 'other', order: 'b', keyframes: [] }],
    decors: {
      initial: { id: 'initial', offset: { translate: { x: 10, y: 10 }, width: 10, height: 10, rotate: 17 } },
      middle: { id: 'middle', offset: { translate: { x: 30, y: 10 }, rotate: 25 }, path: 'M 0 0 A 0.5 0.5 0 0 1 1 0' },
      last: { id: 'last', offset: { translate: { x: 30, y: 30 }, rotate: 33 } },
    },
    contents: {}, zones: {}, markerTracks: {},
  }
}

describe('item rotation policy commands', () => {
  it('resets the whole pose chain and forks shared decors without altering paths or other items', () => {
    const before = rotationScene()
    const after = runCommand(before, { name: 'setItemRotationMode', args: { itemId: 'item', mode: 'tangent' } })
    const item = after.items[0]!
    expect(item.rotationMode).toBe('tangent')
    expect(item.initialDecorId).not.toBe('initial')
    expect(item.keyframes[0]!.decorId).toBe(item.initialDecorId)
    expect(after.items[1]).toBe(before.items[1])
    expect(after.decors.initial).toEqual(before.decors.initial)
    expect(before.decors.middle!.offset!.rotate).toBe(25)
    expect(after.decors.middle!.path).toBe(before.decors.middle!.path)
    expect(item.keyframes.map((keyframe) => after.decors[keyframe.decorId]!.offset!.rotate))
      .toEqual([undefined, undefined, undefined])
    expect(after.decors[item.initialDecorId]!.offset!.translate).toEqual({ x: 10, y: 10 })
    const manual = runCommand(after, { name: 'setItemRotationMode', args: { itemId: 'item', mode: 'manual' } })
    expect(manual.items[0]!.rotationMode).toBe('manual')
    expect(manual.decors).toBe(after.decors)
  })

  it('does not create a document change for an unchanged mode or a missing item', () => {
    const scene = rotationScene()
    expect(runCommand(scene, { name: 'setItemRotationMode', args: { itemId: 'item', mode: 'manual' } })).toBe(scene)
    expect(runCommand(scene, { name: 'setItemRotationMode', args: { itemId: 'missing', mode: 'tangent' } })).toBe(scene)
  })
})

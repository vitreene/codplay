import { parseColor } from 'ace'
import { describe, expect, it } from 'vitest'
import { resolveKeyframeDecorStyle, resolveKeyframePoseStyle } from '../../src/builder-v2/decor-resolution'
import { resolveEffectiveKeyframePatch } from '../../src/app/bridges/decor-edit/decor-patches'
import type { EditorScene } from '../../src/app/commands/types'

/**
 * Pose KFs at 0, 1 000 and 2 000 ms; a decoration KF at 500 ms; a second decoration KF at
 * 1 000 ms, after the pose KF of the same instant in the document order.
 */
function cascadeScene(): EditorScene {
  return {
    id: 'decor-cascade',
    meta: { title: 'Cascade', durationMs: 3_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    decors: {
      initial: { id: 'initial', style: { color: 'red', 'border-width': '1cqw' }, offset: { translate: { x: 10, y: 10 }, width: 10, height: 10 } },
      tint: { id: 'tint', style: { color: 'green' } },
      move: { id: 'move', style: { 'border-width': '3cqw' }, offset: { translate: { x: 50, y: 20 } } },
      sameTime: { id: 'sameTime', style: { color: 'blue' } },
      last: { id: 'last', offset: { translate: { x: 80, y: 40 } } },
    },
    contents: {},
    items: [{
      id: 'item',
      type: 'bloc',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'initial',
      keyframes: [
        { id: 'kf-0', timeMs: 0, decorId: 'initial', channel: 'pose' },
        { id: 'kf-tint', timeMs: 500, decorId: 'tint', channel: 'decor' },
        { id: 'kf-move', timeMs: 1_000, decorId: 'move', channel: 'pose' },
        { id: 'kf-same-time', timeMs: 1_000, decorId: 'sameTime', channel: 'decor' },
        { id: 'kf-last', timeMs: 2_000, decorId: 'last', channel: 'pose' },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

describe('the palette reads the cascade the Builder compiles', () => {
  it.each(['kf-0', 'kf-tint', 'kf-move', 'kf-same-time', 'kf-last'])('agrees at %s', (keyframeId) => {
    const scene = cascadeScene()
    const item = scene.items[0]!
    const keyframe = item.keyframes.find((candidate) => candidate.id === keyframeId)!
    const palette = resolveEffectiveKeyframePatch(scene, item, keyframeId, undefined)
    const decoration = resolveKeyframeDecorStyle(scene, item, keyframe)
    const pose = resolveKeyframePoseStyle(scene, item, keyframe)

    expect(parseColor(palette.style!.color!)).toEqual(decoration.color)
    expect(palette.style!['border-width']).toBe(decoration['border-width'])
    expect(palette.offset?.translate).toEqual({ x: pose.x, y: pose.y })
  })

  it('lets a decoration KF see the pose KF of the same instant that precedes it', () => {
    const scene = cascadeScene()
    const palette = resolveEffectiveKeyframePatch(scene, scene.items[0]!, 'kf-same-time', undefined)
    expect(palette.style).toMatchObject({ color: 'blue', 'border-width': '3cqw' })
    expect(palette.offset?.translate).toEqual({ x: 50, y: 20 })
  })
})

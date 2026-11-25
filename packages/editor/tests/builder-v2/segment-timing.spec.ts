import { parseEase } from 'ace'
import { describe, expect, it } from 'vitest'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import { resolveSegmentProgress, resolveSegmentTiming } from '../../src/builder-v2/keyframe-transition'
import type { EditorScene, Item, Keyframe } from '../../src/app/commands/types'

const SHORT_TRANSITION = { kind: 'interpolated', durationMs: 400, easing: 'linear' } as const

/** One item moving from 0 to 1 000 ms; the target decor may carry a path, the target KF a transition. */
function segmentScene(options: { path?: string; rotationMode?: Item['rotationMode']; target?: Partial<Keyframe> } = {}): EditorScene {
  return {
    id: 'segment-timing',
    meta: { title: 'Segment timing', durationMs: 2_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    rootDecorId: 'root',
    decors: {
      root: { id: 'root' },
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 10, height: 10 } },
      target: {
        id: 'target',
        offset: { translate: { x: 70, y: 40 }, width: 10, height: 10 },
        ...(options.path === undefined ? {} : { path: options.path }),
      },
    },
    contents: {},
    items: [{
      id: 'item',
      type: 'bloc',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'first',
      ...(options.rotationMode === undefined ? {} : { rotationMode: options.rotationMode }),
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'target-kf', timeMs: 1_000, decorId: 'target', ...options.target },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

/** Resolves the timing of the scene's only segment. */
function timingOf(scene: EditorScene) {
  const item = scene.items[0]!
  return resolveSegmentTiming(scene, item, item.keyframes[0]!, item.keyframes[1]!)
}

describe('segment timing shared by the Builder and the editing bridges', () => {
  it('runs a straight segment without transition over the whole interval', () => {
    const timing = timingOf(segmentScene())
    expect(timing).toEqual({ startAtMs: 0, durationMs: 1_000, ease: 'inOut' })
    expect(resolveSegmentProgress(timing, 250)).toBeCloseTo(parseEase('inOut')(0.25), 10)
  })

  it('runs a straight segment along its transition window', () => {
    const after = timingOf(segmentScene({ target: { transitionIn: SHORT_TRANSITION } }))
    expect(after).toEqual({ startAtMs: 0, durationMs: 400, ease: 'linear' })
    expect(resolveSegmentProgress(after, 200)).toBeCloseTo(0.5, 10)
    expect(resolveSegmentProgress(after, 700)).toBe(1)

    const before = timingOf(segmentScene({ target: { transitionIn: { ...SHORT_TRANSITION, direction: 'before' } } }))
    expect(before).toEqual({ startAtMs: 600, durationMs: 400, ease: 'linear' })
    expect(resolveSegmentProgress(before, 300)).toBe(0)
    expect(resolveSegmentProgress(before, 800)).toBeCloseTo(0.5, 10)
  })

  it('runs a path segment, explicit or implied by tangent orientation, over the whole interval', () => {
    const explicit = timingOf(segmentScene({ path: 'M 0 0 A 0.7 0.7 0 0 1 1 0', target: { transitionIn: SHORT_TRANSITION } }))
    expect(explicit).toEqual({ startAtMs: 0, durationMs: 1_000, ease: 'linear' })
    const tangent = timingOf(segmentScene({ rotationMode: 'tangent', target: { transitionIn: SHORT_TRANSITION } }))
    expect(tangent).toEqual({ startAtMs: 0, durationMs: 1_000, ease: 'linear' })
  })

  it('reports a finished segment when it has no duration', () => {
    expect(resolveSegmentProgress({ startAtMs: 500, durationMs: 0, ease: 'linear' }, 0)).toBe(1)
  })

  it('compiles the path move with the same clock', () => {
    const scene = segmentScene({ path: 'M 0 0 A 0.7 0.7 0 0 1 1 0', target: { transitionIn: SHORT_TRANSITION } })
    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const story = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!
    const perso = story.persos.find((candidate) => candidate.id === 'item')!
    const action = perso.actions['item-kf-target-kf'] as { move: { transition: { duration: number; ease: string } } }
    const timing = timingOf(scene)
    expect(story.eventimes).toContainEqual({ name: 'item-kf-target-kf', startAt: timing.startAtMs + result.preRollMs })
    expect(action.move.transition).toMatchObject({ duration: timing.durationMs, ease: timing.ease })
  })
})

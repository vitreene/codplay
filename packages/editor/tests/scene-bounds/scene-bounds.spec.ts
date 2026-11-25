import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import { sequenceEditorMachine } from '../../src/sequence-editor/machine'
import type { EditorScene, Item } from '../../src/app/commands/types'

/** Text item under `parentId` with the given pose keyframes. */
function textItem(id: string, parentId: string | null, order: string, keyframes: Item['keyframes'] = []): Item {
  return { id, type: 'text', parentId, order, visible: true, contentId: 'content', initialDecorId: 'decor', keyframes }
}

/** Root text items plus a carousel locked at 1000–4000 ms whose two children have no keyframe. */
function sceneWithNestedCarousel(capsuleOrder: EditorScene['meta']['capsuleOrder'] = 'forward'): EditorScene {
  return {
    id: 'scene-bounds',
    meta: { title: 'Bounds', durationMs: 6000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder },
    rootDecorId: 'decor',
    decors: { decor: { id: 'decor', style: {} } },
    contents: { content: { id: 'content', type: 'text', text: 'x' } },
    items: [
      {
        id: 'cap', type: 'capsule', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'decor',
        keyframes: [{ id: 'cap-in', timeMs: 1000, decorId: 'decor' }, { id: 'cap-out', timeMs: 4000, decorId: 'decor' }],
        capsule: { kind: 'carousel' },
      },
      textItem('free-a', 'cap', 'a'),
      textItem('free-b', 'cap', 'b'),
      textItem('root-free', null, 'b'),
    ],
    zones: {},
    markerTracks: {},
  }
}

/** Returns the Builder's appearance eventimes (runtime ms) and the timeline's virtual bounds (author ms). */
function project(scene: EditorScene) {
  const result = buildSceneDocV2(scene)
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  const eventimes = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.eventimes
  const actor = createActor(sequenceEditorMachine, { input: { scene, viewWidthPx: 800 } }).start()
  const virtual = actor.getSnapshot().context.virtualKeyframes
  actor.stop()
  const eventAt = (itemId: string, action: 'intro' | 'outro') => {
    const event = eventimes.find((candidate) => candidate.name.includes(`_child_${itemId}_${action}_`))
    return event === undefined ? undefined : event.startAt - result.preRollMs
  }
  const virtualAt = (itemId: string, name: 'intro' | 'outro') => virtual.find((bound) => bound.trackId === itemId && bound.name === name)?.timeMs
  return { preRollMs: result.preRollMs, eventAt, virtualAt }
}

describe('scene bounds — timeline and Builder read one resolution', () => {
  it('places the children of a nested capsule inside its presence window, in both projections', () => {
    const { preRollMs, eventAt, virtualAt } = project(sceneWithNestedCarousel())
    expect(preRollMs).toBe(300)
    // free-a: enters fused with the capsule fade (700): a `cut`, so no default fade event is
    // synthesized. It exits with its own fade at 2500.
    expect(virtualAt('free-a', 'intro')).toBe(700)
    expect(eventAt('free-a', 'intro')).toBeUndefined()
    expect(virtualAt('free-a', 'outro')).toBe(2500)
    expect(eventAt('free-a', 'outro')).toBe(2500)
    // free-b: its fade starts at 2500 and ends at its intro instant 2800; its exit is fused at 4300.
    expect(virtualAt('free-b', 'intro')).toBe(2800)
    expect(eventAt('free-b', 'intro')).toBe(2500)
    expect(virtualAt('free-b', 'outro')).toBe(4300)
    expect(eventAt('free-b', 'outro')).toBeUndefined()
  })

  it('keeps the root default transitions on root edges and plays them in the pre-roll', () => {
    const { eventAt, virtualAt } = project(sceneWithNestedCarousel())
    expect(eventAt('root-free', 'intro')).toBe(-300)
    expect(virtualAt('root-free', 'intro')).toBe(0)
    expect(virtualAt('root-free', 'outro')).toBe(6000)
  })

  it('reads the distribution order from the scene', () => {
    const { virtualAt } = project(sceneWithNestedCarousel('backward'))
    expect(virtualAt('free-b', 'intro')).toBe(700)
    expect(virtualAt('free-a', 'outro')).toBe(4300)
  })
})

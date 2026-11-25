import { describe, expect, it } from 'vitest'
import { runCommand } from '../../src/app/commands/facade'
import type { EditorScene, Item, Keyframe } from '../../src/app/commands/types'
import { resolveSceneBounds } from '../../src/scene-bounds/scene-bounds'

/** Carousel locked at 1000–4000 ms (window [700, 4300]) whose first child has a linked intro. */
function sceneWithLinkedIntro(linked: Keyframe): EditorScene {
  const text = (id: string, order: string, keyframes: Item['keyframes'] = []): Item => ({
    id, type: 'text', parentId: 'cap', order, visible: true, contentId: 'content', initialDecorId: 'decor', keyframes,
  })
  return {
    id: 'linked-bounds',
    meta: { title: 'Linked', durationMs: 6000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    rootDecorId: 'decor',
    decors: { decor: { id: 'decor', style: {} }, own: { id: 'own', style: { color: '#ff0000' } } },
    contents: { content: { id: 'content', type: 'text', text: 'x' } },
    items: [
      {
        id: 'cap', type: 'capsule', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'decor',
        keyframes: [{ id: 'cap-in', timeMs: 1000, decorId: 'decor', channel: 'pose' }, { id: 'cap-out', timeMs: 4000, decorId: 'decor', channel: 'pose' }],
        capsule: { kind: 'carousel', distribution: { mode: 'sequential' } },
      },
      text('a', 'a', [linked]),
      text('b', 'b'),
    ],
    zones: {},
    markerTracks: {},
  }
}

const LINKED_INTRO: Keyframe = { id: 'a-in', timeMs: 0, decorId: 'own', channel: 'pose', autoBound: 'intro' }

describe('linked bounds — own decor and transition, computed instant', () => {
  it('resolves a linked intro as an unlocked bound placed by the capsule', () => {
    const bounds = resolveSceneBounds(sceneWithLinkedIntro(LINKED_INTRO))
    expect(bounds.nodes.get('a')?.intro).toEqual({ timeMs: 700, origin: 'linked', transition: { source: 'fused', ref: 'cut', durationMs: 0 } })
    expect(bounds.nodes.get('b')?.intro.timeMs).toBe(2800)
  })

  it('keeps the explicit transition of a linked bound', () => {
    const bounds = resolveSceneBounds(sceneWithLinkedIntro({ ...LINKED_INTRO, transitionIn: { kind: 'named', name: 'zoom', durationMs: 300 } }))
    expect(bounds.nodes.get('a')?.intro).toEqual({ timeMs: 1000, origin: 'linked', transition: { source: 'explicit', ref: 'zoom', durationMs: 300 } })
  })

  it('rewrites the linked instant in the same command that moves its capsule', () => {
    const moved = runCommand(sceneWithLinkedIntro(LINKED_INTRO), { name: 'moveKeyframe', args: { itemId: 'cap', keyframeId: 'cap-in', timeMs: 1500 } })
    const intro = moved.items.find((item) => item.id === 'a')!.keyframes[0]!
    expect(intro).toEqual({ ...LINKED_INTRO, timeMs: 1200 })
  })

  it('locks a linked bound moved by the author', () => {
    const moved = runCommand(sceneWithLinkedIntro(LINKED_INTRO), { name: 'moveKeyframe', args: { itemId: 'a', keyframeId: 'a-in', timeMs: 900 } })
    const intro = moved.items.find((item) => item.id === 'a')!.keyframes[0]!
    expect(intro).toEqual({ id: 'a-in', timeMs: 900, decorId: 'own', channel: 'pose' })
    expect(resolveSceneBounds(moved).nodes.get('a')?.intro.origin).toBe('locked')
  })

  it('locks a linked bound in place on lockKeyframeBound', () => {
    const locked = runCommand(sceneWithLinkedIntro({ ...LINKED_INTRO, timeMs: 700 }), { name: 'lockKeyframeBound', args: { itemId: 'a', keyframeId: 'a-in' } })
    expect(locked.items.find((item) => item.id === 'a')!.keyframes[0]).toEqual({ id: 'a-in', timeMs: 700, decorId: 'own', channel: 'pose' })
  })
})

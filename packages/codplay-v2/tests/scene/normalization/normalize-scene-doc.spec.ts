import { describe, expect, it } from 'vitest'

import { normalizeSceneDoc } from '../../../src/scene/normalization'
import type { SceneDoc } from '../../../src/scene/types'

describe('normalizeSceneDoc', () => {
  it('completes empty author fields without mutating the source', () => {
    const scene: SceneDoc = {
      id: 'scene-a',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'title', type: 'tag' }],
        },
      },
    }

    const normalized = normalizeSceneDoc(scene)

    expect(normalized.tracks).toEqual({})
    expect(normalized.listen).toEqual([])
    expect(normalized.stories.main.tracks).toEqual({})
    expect(normalized.stories.main.listen).toEqual([])
    expect(normalized.stories.main.persos[0].initial).toEqual({})
    expect(normalized.stories.main.persos[0].actions).toEqual({ title: null })
    expect(scene.stories.main.persos[0].actions).toBeUndefined()
  })

  it('preserves absent story placement and clones nested author values', () => {
    const scene: SceneDoc = {
      id: 'scene-a',
      stories: {
        main: {
          id: 'main',
          initial: { move: { parentId: '@root' } },
          persos: [{ id: 'title', type: 'tag', initial: { style: { opacity: 1 } } }],
        },
      },
    }

    const normalized = normalizeSceneDoc(scene)
    const initial = normalized.stories.main.persos[0].initial

    expect(normalized.stories.main.initial).toEqual({ move: { parentId: '@root' } })
    expect(initial).not.toBe(scene.stories.main.persos[0].initial)
  })

  it('reserves the internal self-reference even when the author provided a value there', () => {
    const scene: SceneDoc = {
      id: 'scene-a',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'title', type: 'tag', actions: { title: { arbitrary: true } } }],
        },
      },
    }

    const normalized = normalizeSceneDoc(scene)

    expect(normalized.stories.main.persos[0]?.actions).toEqual({ title: null })
    expect(scene.stories.main.persos[0]?.actions).toEqual({ title: { arbitrary: true } })
  })
})

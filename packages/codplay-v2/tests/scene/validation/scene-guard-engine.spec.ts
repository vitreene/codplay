import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { normalizeSceneDoc } from '../../../src/scene/normalization'
import { SceneGuardEngine } from '../../../src/scene/validation'
import type { SceneDoc } from '../../../src/scene/types'

describe('SceneGuardEngine', () => {
  it('accepts the canonical shape produced by normalization', () => {
    const scene: SceneDoc = {
      id: 'scene-a',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'title', type: 'tag' }],
        },
      },
    }
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })

    new SceneGuardEngine().validate(normalizeSceneDoc(scene), diagnostics)

    expect(diagnostics.report().errors).toEqual([])
  })

  it('reports canonical identity and self-action violations with configured paths', () => {
    const scene = normalizeSceneDoc({
      id: 'scene-a',
      stories: {
        main: {
          id: 'wrong-key',
          persos: [{ id: 'title', type: '' }],
        },
      },
    })
    const invalidScene = {
      ...scene,
      stories: {
        ...scene.stories,
        main: {
          ...scene.stories.main,
          persos: [{
            ...scene.stories.main.persos[0],
            actions: { title: { style: {} } },
          }],
        },
      },
    }
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })

    new SceneGuardEngine().validate(invalidScene, diagnostics)

    expect(diagnostics.report().errors.map((entry) => entry.code)).toEqual([
      'AUTHOR_STORY_ID_INVALID',
      'AUTHOR_PERSO_TYPE_INVALID',
      'AUTHOR_PERSO_SELF_ACTION_INVALID',
    ])
    expect(diagnostics.report().errors[1].details).toMatchObject({
      context: { path: 'stories.main.persos.title.type' },
    })
  })
})

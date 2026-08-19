import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../src/diagnostics'
import { normalizeSceneDoc } from '../../src/scene/normalization'
import { SceneGuardEngine } from '../../src/scene/validation'
import { demoSceneFixtures } from '../fixtures/demo-scene-fixtures'

describe('V1 demo scene corpus', () => {
  it('normalizes and structurally accepts representative S1-S4 forms', () => {
    for (const fixture of demoSceneFixtures) {
      const diagnostics = new DiagnosticCollector({ output: vi.fn() })

      new SceneGuardEngine().validate(normalizeSceneDoc(fixture.scene), diagnostics)

      expect(diagnostics.report().errors, fixture.id).toEqual([])
    }
  })

  it('keeps the demo corpus representative of root, nested, transition, and resource cases', () => {
    expect(demoSceneFixtures.map(({ id }) => id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(demoSceneFixtures[0]?.scene.stories['s1-canary-story']?.persos[0]?.initial?.move).toBe('@root')
    expect(demoSceneFixtures[1]?.scene.stories['s2-reference-story']?.persos[1]?.initial?.move).toEqual({ target: 'reference-list' })
    expect(demoSceneFixtures[2]?.scene.stories['s3-robustesse-story']?.persos[2]?.actions?.['sequence:robustesse:promote']).toMatchObject({
      move: { target: 'robust-overlay', flipMode: 'overlay-world', transition: { duration: 400 } },
    })
    expect(demoSceneFixtures[3]?.scene.stories['s4-media-story']?.persos[0]?.initial?.src).toBe('/assets/quiz.mp4')
  })
})

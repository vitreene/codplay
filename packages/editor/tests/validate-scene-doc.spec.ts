import { describe, expect, it } from 'vitest'
import { validateSceneDoc } from '@codplay/scene-factory'
import { buildSceneDoc } from '../src/builder/build-scene'
import type { EditorScene } from '../src/sequence-editor/types'
import type { SceneDef } from 'codplay/builder/types'

/**
 * A real `SceneDef`, produced by the actual Builder (`buildSceneDoc`) rather than hand-typed —
 * every mutation test below starts from this and breaks exactly one thing, so each fixture
 * stays anchored to the shape the Builder really emits (root capsule id, `move` shapes,
 * action names) instead of a shape this test file merely assumes.
 */
function validSceneFixture(): EditorScene {
  return {
    id: 'validate-demo-scene',
    title: 'validate demo',
    durationMs: 3000,
    durationSource: 'arbitrary',
    decors: {},
    rootDecorId: null,
    tracks: [
      {
        id: 'item-1',
        kind: 'element',
        label: 'Texte',
        visible: true,
        contentType: 'text',
        keyframes: [
          { id: 'kf-intro', timeMs: 0, decorId: null, transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
          { id: 'kf-outro', timeMs: 3000, decorId: null, transitionOut: { kind: 'named', name: 'fade', durationMs: 400 } },
        ],
      },
    ],
    cues: [],
    markerTracks: [],
  }
}

describe('validateSceneDoc — a real Builder-produced SceneDef passes with no diagnostics', () => {
  it('reports ok:true, no diagnostics', () => {
    const { sceneDoc } = buildSceneDoc(validSceneFixture())
    expect(validateSceneDoc(sceneDoc)).toEqual({ ok: true, diagnostics: [] })
  })
})

describe('validateSceneDoc — move.parentId referential integrity', () => {
  it('flags a perso whose move.parentId matches no real perso id in the scene', () => {
    const { sceneDoc } = buildSceneDoc(validSceneFixture())
    const story = sceneDoc.stories['story-main']!
    const item = story.persos.find((p) => p.id === 'item-1')!
    ;(item.initial as Record<string, unknown>).move = { parentId: 'story-main__typo-root', flip: false }

    const report = validateSceneDoc(sceneDoc)
    expect(report.ok).toBe(false)
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'ED2_MOVE_PARENT_NOT_FOUND', context: { storyId: 'story-main', persoId: 'item-1' } }),
    )
  })

  it('never flags "@root" or "@off" — Codplay\'s own reserved tokens, not perso-id references', () => {
    const { sceneDoc } = buildSceneDoc(validSceneFixture())
    const story = sceneDoc.stories['story-main']!
    const item = story.persos.find((p) => p.id === 'item-1')!
    ;(item.initial as Record<string, unknown>).move = '@off'

    expect(validateSceneDoc(sceneDoc)).toEqual({ ok: true, diagnostics: [] })
  })
})

describe('validateSceneDoc — unique action names per story', () => {
  it('flags two persos of the same story declaring the same action key', () => {
    const { sceneDoc } = buildSceneDoc(validSceneFixture())
    const story = sceneDoc.stories['story-main']!
    const root = story.persos.find((p) => p.id === 'story-main__root')!
    const item = story.persos.find((p) => p.id === 'item-1')!
    root.actions['item-1-intro'] = item.actions['item-1-intro']

    const report = validateSceneDoc(sceneDoc)
    expect(report.ok).toBe(false)
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'ED2_DUPLICATE_ACTION_NAME', context: { storyId: 'story-main', actionName: 'item-1-intro' } }),
    )
  })
})

describe('validateSceneDoc — root capsule invariants', () => {
  it('flags a story with no perso resolving to @root when the story itself does', () => {
    const { sceneDoc } = buildSceneDoc(validSceneFixture())
    const story = sceneDoc.stories['story-main']!
    const root = story.persos.find((p) => p.id === 'story-main__root')!
    ;(root.initial as Record<string, unknown>).move = { parentId: 'item-1', flip: false }

    const report = validateSceneDoc(sceneDoc)
    expect(report.ok).toBe(false)
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'ED2_ROOT_CAPSULE_MISSING', context: { storyId: 'story-main' } }),
    )
  })

  it('flags a story with two persos both resolving to @root', () => {
    const { sceneDoc } = buildSceneDoc(validSceneFixture())
    const story = sceneDoc.stories['story-main']!
    const item = story.persos.find((p) => p.id === 'item-1')!
    ;(item.initial as Record<string, unknown>).move = '@root'

    const report = validateSceneDoc(sceneDoc)
    expect(report.ok).toBe(false)
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'ED2_ROOT_CAPSULE_DUPLICATED', context: { storyId: 'story-main' } }),
    )
  })

  it('does not check a story whose own move does not resolve to @root at all', () => {
    const sceneDoc: SceneDef = {
      id: 'scene-no-root-story',
      stories: {
        's1': {
          id: 's1',
          initial: { move: '@off' },
          persos: [{ id: 'p1', type: 'text', initial: { move: '@off' }, actions: {} }],
          straps: undefined,
          listen: [],
        },
      },
      initial: undefined,
      straps: undefined,
      listen: [],
      tracks: {},
    }

    expect(validateSceneDoc(sceneDoc)).toEqual({ ok: true, diagnostics: [] })
  })
})

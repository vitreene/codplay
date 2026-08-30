import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { buildSceneDocV2, EDITOR_V2_ROOT_PERSO_ID, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import type { EditorScene } from '../../src/app/commands/types'

function fixtureScene(): EditorScene {
  return {
    id: 'ed2-v2-minimal',
    meta: {
      title: 'ed2 V2 minimal',
      durationMs: 3000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    rootDecorId: 'root-decor',
    decors: {
      'root-decor': { id: 'root-decor', style: { background: '#1a1a2e' } },
      'text-decor-a': { id: 'text-decor-a', style: { color: '#ffffff', fontSize: '2rem' } },
      'text-decor-b': { id: 'text-decor-b', style: { color: '#00ff00', fontSize: '2rem' } },
    },
    contents: {
      'text-content': { id: 'text-content', type: 'text', text: 'Bonjour ed2 V2' },
    },
    items: [{
      id: 'item-1',
      type: 'text',
      parentId: null,
      order: 'mmm',
      visible: true,
      contentId: 'text-content',
      initialDecorId: 'text-decor-a',
      keyframes: [
        { id: 'kf-a', timeMs: 0, decorId: 'text-decor-a', transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
        { id: 'kf-b', timeMs: 1000, decorId: 'text-decor-b' },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

describe('buildSceneDocV2 — first native editor increment', () => {
  it('produces V2 list/tag persos with target placement and no V1 shape', () => {
    const result = buildSceneDocV2(fixtureScene())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const story = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!
    const root = story.persos.find((perso) => perso.id === EDITOR_V2_ROOT_PERSO_ID)!
    const item = story.persos.find((perso) => perso.id === 'item-1')!

    expect(root.type).toBe('list')
    expect(root.initial).toMatchObject({ move: '@root', tag: 'div', style: { background: '#1a1a2e' } })
    expect(item.type).toBe('tag')
    expect(item.initial).toMatchObject({
      move: { target: EDITOR_V2_ROOT_PERSO_ID },
      tag: 'div',
      content: 'Bonjour ed2 V2',
      style: { color: '#ffffff', fontSize: '2rem', opacity: 0 },
    })
    expect(item.initial).not.toHaveProperty(['move', 'parentId'])
  })

  it('emits named fade actions and an interpolated decor diff as pure eventime triggers', () => {
    const result = buildSceneDocV2(fixtureScene())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const story = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!
    const item = story.persos.find((perso) => perso.id === 'item-1')!
    expect(item.actions['item-1-intro']).toEqual({ style: { opacity: { from: 0, to: 1, duration: 400 } } })
    expect(item.actions['item-1-kf-kf-b']).toEqual({
      style: { color: { from: '#ffffff', to: '#00ff00', duration: 1000, ease: 'easeInOut' } },
    })
    expect(story.eventimes).toEqual([
      { name: 'item-1-intro', startAt: 0 },
      { name: 'item-1-kf-kf-b', startAt: 400 },
    ])
    expect(result.preRollMs).toBe(400)
    expect(result.durationMs).toBe(3000)
  })

  it('is accepted by the real CodPlay V2 compiler without importing V1', () => {
    const result = buildSceneDocV2(fixtureScene())
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const codplay = new CodPlay()
    const compiled = codplay.build({ scene: result.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.compiledScene.scene.stories[EDITOR_V2_STORY_ID]?.persos.map((perso) => perso.type)).toEqual(['list', 'tag'])
    codplay.destroy()
  })

  it('returns a blocking diagnostic instead of emitting a partial V2 scene for offsets', () => {
    const scene = fixtureScene()
    scene.decors['text-decor-a']!.offset = { width: 12.5 }
    const result = buildSceneDocV2(scene)
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'EDITOR_V2_OFFSET_REQUIRES_CQW', level: 'error' }] })
    if (result.ok) return
    expect(result).not.toHaveProperty('sceneDoc')
  })
})

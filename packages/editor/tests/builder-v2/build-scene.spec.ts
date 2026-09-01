import { describe, expect, it } from 'vitest'
import { parseColor } from 'ace'
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

describe('buildSceneDocV2 — current native editor increment', () => {
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
      style: { color: parseColor('#ffffff'), fontSize: '2rem', opacity: 0 },
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
      style: { color: { from: parseColor('#ffffff'), to: parseColor('#00ff00'), duration: 1000, ease: 'inOut' } },
    })
    expect(story.eventimes).toEqual([
      { name: 'item-1-intro', startAt: 0 },
      { name: 'item-1-kf-kf-b', startAt: 400 },
    ])
    expect(result.preRollMs).toBe(400)
    expect(result.durationMs).toBe(3000)
  })

  it('ignores discrete CSS keyword changes without maintaining a property whitelist', () => {
    const scene = fixtureScene()
    scene.decors['text-decor-a']!.style!.objectFit = 'contain'
    scene.decors['text-decor-b']!.style!.objectFit = 'cover'

    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-1')!
    expect(item.actions['item-1-kf-kf-b']?.style).not.toHaveProperty('objectFit')
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

  it('builds a nested capsule with V2 parent targets and capsule-automation CSS', () => {
    const scene = fixtureScene()
    scene.items = [
      {
        id: 'capsule-a',
        type: 'capsule',
        parentId: null,
        order: 'mmm',
        visible: true,
        contentId: null,
        initialDecorId: 'root-decor',
        capsule: {
          kind: 'grille',
          grid: { rows: 1, cols: 1 },
          distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
        },
        keyframes: [],
      },
      {
        id: 'capsule-b',
        type: 'capsule',
        parentId: 'capsule-a',
        order: 'mmm',
        visible: true,
        contentId: null,
        initialDecorId: 'root-decor',
        capsule: {
          kind: 'liste',
          distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
        },
        keyframes: [],
      },
      {
        id: 'item-nested',
        type: 'text',
        parentId: 'capsule-b',
        order: 'mmm',
        visible: true,
        contentId: 'text-content',
        initialDecorId: 'text-decor-a',
        keyframes: [],
      },
    ]

    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const story = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!
    const root = story.persos.find((perso) => perso.id === EDITOR_V2_ROOT_PERSO_ID)!
    const capsule = story.persos.find((perso) => perso.id === 'capsule-a')!
    const nestedCapsule = story.persos.find((perso) => perso.id === 'capsule-b')!
    const item = story.persos.find((perso) => perso.id === 'item-nested')!

    expect(root.type).toBe('list')
    expect(root.initial).toMatchObject({ move: '@root' })
    expect((root.initial as { className?: string }).className).toContain('ac-scene-root')
    expect(capsule.type).toBe('list')
    expect(capsule.initial).toMatchObject({ move: { target: EDITOR_V2_ROOT_PERSO_ID }, tag: 'div' })
    expect((capsule.initial as { className?: string }).className).toContain('ac-grid-grille-1x1-manual')
    expect(nestedCapsule.type).toBe('list')
    expect(nestedCapsule.initial).toMatchObject({ move: { target: 'capsule-a' }, tag: 'div' })
    expect((nestedCapsule.initial as { className?: string }).className).toContain('ac-grid-liste-1x1-list')
    expect(item.type).toBe('tag')
    expect(item.initial).toMatchObject({ move: { target: 'capsule-b' }, content: 'Bonjour ed2 V2' })
    expect(result.styleSheet).toContain('.ac-grid-grille-1x1-manual{display:grid;')
    expect(result.styleSheet).toContain('.ac-grid-liste-1x1-list{display:grid;')
    expect(result.rootGrid).toEqual({ rows: 9, cols: 16 })

    const codplay = new CodPlay()
    const compiled = codplay.build({ scene: result.sceneDoc })
    expect(compiled.ok).toBe(true)
    codplay.destroy()
  })

  it('emits unitless structured offsets without qualifying CSS styles', () => {
    const scene = fixtureScene()
    scene.decors['text-decor-a']!.offset = {
      x: 3,
      y: 4,
      translate: { x: 12.5, y: -8 },
      width: 12.5,
      height: 25,
      rotate: 15,
      scale: { x: 1.2, y: 0.9 },
    }
    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-1')!
    expect(item.initial).toMatchObject({
      style: {
        x: 12.5,
        y: -8,
        width: 12.5,
        height: 25,
        rotate: 15,
        scaleX: 1.2,
        scaleY: 0.9,
      },
    })
  })

  it('does not emit an interpolation action when structured offsets are unchanged', () => {
    const scene = fixtureScene()
    const offset = { x: 12.5, y: -8, width: 12.5, height: 25 }
    scene.decors['text-decor-a']!.offset = offset
    scene.decors['text-decor-b']!.offset = { ...offset }

    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-1')!
    expect(item.actions['item-1-kf-kf-b']).toEqual({
      style: {
        color: { from: parseColor('#ffffff'), to: parseColor('#00ff00'), duration: 1000, ease: 'inOut' },
      },
    })
  })

  it('emits one combined action for color and position/size interpolation', () => {
    const scene = fixtureScene()
    scene.decors['text-decor-a']!.offset = {
      translate: { x: 10, y: 5 },
      width: 20,
      height: 12,
    }
    scene.decors['text-decor-b']!.offset = {
      translate: { x: 30, y: 5 },
      width: 30,
      height: 12,
    }

    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-1')!
    expect(item.actions['item-1-kf-kf-b']).toEqual({
      style: {
        color: { from: parseColor('#ffffff'), to: parseColor('#00ff00'), duration: 1000, ease: 'inOut' },
        x: { from: 10, to: 30, duration: 1000, ease: 'inOut' },
        width: { from: 20, to: 30, duration: 1000, ease: 'inOut' },
      },
    })
    expect(item.actions['item-1-kf-kf-b']?.style).not.toHaveProperty('y')
    expect(item.actions['item-1-kf-kf-b']?.style).not.toHaveProperty('height')
  })

  it('normalizes standalone CSS colors without reinterpreting open CSS values', () => {
    const scene = fixtureScene()
    scene.decors['text-decor-a']!.style = {
      'background-color': '#ff0000',
      'line-height': '1.2',
      'object-fit': 'contain',
      '--editor-fill': 'calc(10px + var(--gap))',
    }
    scene.decors['text-decor-b']!.style = {
      'background-color': '#00ff00',
      'line-height': '1.4',
      'object-fit': 'cover',
      '--editor-fill': 'calc(20px + var(--gap))',
    }

    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-1')!
    expect(item.initial).toMatchObject({ style: { 'background-color': parseColor('#ff0000'), 'line-height': '1.2' } })
    expect(item.actions['item-1-kf-kf-b']).toMatchObject({
      style: {
        'background-color': { from: parseColor('#ff0000'), to: parseColor('#00ff00') },
      },
    })
    expect(item.actions['item-1-kf-kf-b']?.style).not.toHaveProperty('object-fit')
    expect(item.actions['item-1-kf-kf-b']?.style).toMatchObject({
      'line-height': { from: '1.2', to: '1.4' },
      '--editor-fill': { from: 'calc(10px + var(--gap))', to: 'calc(20px + var(--gap))' },
    })
  })

  it('maps bloc to an empty tag and image to the V2 img component without inventing content', () => {
    const scene = fixtureScene()
    scene.items[0] = {
      ...scene.items[0]!,
      id: 'item-image',
      type: 'image',
      contentId: 'image-content',
      keyframes: [],
    }
    scene.contents['image-content'] = { id: 'image-content', type: 'image', source: '/assets/photo.jpg' }
    let result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const image = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-image')!
    expect(image.type).toBe('img')
    expect(image.initial).toMatchObject({ src: '/assets/photo.jpg' })
    expect(image.initial).not.toHaveProperty('content')

    scene.items[0] = {
      ...scene.items[0]!,
      id: 'item-bloc',
      type: 'bloc',
      contentId: null,
    }
    result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const bloc = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-bloc')!
    expect(bloc.type).toBe('tag')
    expect(bloc.initial).toMatchObject({ tag: 'div' })
    expect(bloc.initial).not.toHaveProperty('content')
  })

  it('maps video/media to the V2 media component and exposes the source to CodPlay resources', () => {
    const scene = fixtureScene()
    scene.items[0] = {
      ...scene.items[0]!,
      id: 'item-video',
      type: 'video',
      contentId: 'video-content',
      keyframes: [],
    }
    scene.contents['video-content'] = { id: 'video-content', type: 'video', source: '/assets/clip.mp4' }
    scene.masterItemId = 'item-video'
    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const video = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item-video')!
    expect(video.type).toBe('media')
    expect(video.initial).toMatchObject({ tag: 'video', src: '/assets/clip.mp4', master: true })

    const codplay = new CodPlay()
    const compiled = codplay.build({ scene: result.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    expect(compiled.compiledScene.resources.entries).toContainEqual(expect.objectContaining({ url: '/assets/clip.mp4', type: 'video' }))
    codplay.destroy()
  })

  it('rejects media without an authored source instead of emitting an undefined V2 src', () => {
    const scene = fixtureScene()
    scene.items[0] = {
      ...scene.items[0]!,
      type: 'media',
      contentId: 'media-content',
      keyframes: [],
    }
    scene.contents['media-content'] = { id: 'media-content', type: 'media' }
    const result = buildSceneDocV2(scene)
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'EDITOR_V2_MEDIA_SOURCE_MISSING', level: 'error' }] })
  })
})

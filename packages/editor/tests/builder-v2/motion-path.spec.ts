/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import type { EditorScene } from '../../src/app/commands/types'

/** Builds a minimal same-parent segment with a path carried by the target decor. */
function pathScene(): EditorScene {
  return {
    id: 'editor-v2-motion-path',
    meta: {
      title: 'Motion path',
      durationMs: 2_000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    rootDecorId: 'root',
    decors: {
      root: { id: 'root' },
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 10, height: 10 } },
      target: {
        id: 'target',
        offset: { translate: { x: 70, y: 40 }, width: 10, height: 10 },
        path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
      },
    },
    contents: { content: { id: 'content', type: 'text', text: 'motion' } },
    items: [{
      id: 'item',
      type: 'text',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: 'content',
      initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'target-kf', timeMs: 1_000, decorId: 'target' },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

describe('editor V2 motion path adapter', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('maps an optional target-decor path to CodPlay V2 move without changing parentage', () => {
    const result = buildSceneDocV2(pathScene())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
    const moveAction = perso.actions['item-kf-target-kf'] as Record<string, unknown>
    expect(moveAction.move).toEqual({
      target: `${EDITOR_V2_STORY_ID}__root`,
      transition: {
        duration: 1_000,
        ease: 'inOut',
        path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
      },
    })
    expect(moveAction.style).toEqual(expect.objectContaining({ x: expect.any(Object), y: expect.any(Object) }))
    expect(perso.type).toBe('list')
    expect(perso.initial?.move).toEqual({ target: `${EDITOR_V2_STORY_ID}__root` })
    const visual = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => (
      candidate.initial?.attr?.['data-editor-visual-for'] === 'item'
    ))!
    expect(visual.type).toBe('tag')
    expect(visual.initial?.move).toEqual({ target: 'item' })
  })

  it('keeps a border decor keyframe from overriding an overlapping pose path', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const scene = pathScene()
    scene.decors.first!.style = { 'border-width': '0cqw', 'border-style': 'solid' }
    scene.decors.border = { id: 'border', style: { 'border-width': '6cqw', 'border-style': 'solid' } }
    scene.decors.middle = {
      id: 'middle',
      offset: { translate: { x: 45, y: 30 }, width: 10, height: 10, rotate: 20 },
      path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
      orientToPath: true,
    }
    scene.decors.target!.offset = { translate: { x: 70, y: 40 }, width: 10, height: 10, rotate: 30 }
    scene.items[0]!.keyframes = [
      { id: 'first-kf', timeMs: 0, decorId: 'first', channel: 'pose' },
      { id: 'border-kf', timeMs: 600, decorId: 'border', channel: 'decor' },
      { id: 'middle-kf', timeMs: 1_000, decorId: 'middle', channel: 'pose' },
      { id: 'target-kf', timeMs: 2_000, decorId: 'target', channel: 'pose' },
    ]

    const built = buildSceneDocV2(scene)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const perso = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
    const visual = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => (
      candidate.initial?.attr?.['data-editor-visual-for'] === 'item'
    ))!
    const borderAction = visual.actions!['item-decor-kf-border-kf'] as Record<string, unknown>
    expect(borderAction.style).toMatchObject({ 'border-width': expect.any(Object) })
    expect(borderAction.style).not.toHaveProperty('x')
    expect(borderAction.style).not.toHaveProperty('y')
    expect(perso.actions['item-kf-middle-kf']).toHaveProperty('move')
    expect(perso.actions['item-kf-middle-kf']).toHaveProperty('style.x')

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-motion-path-border-interruption',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })
    await instance.telco.seek(999 + built.preRollMs)
    const beforeMiddle = instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')
    await instance.telco.seek(1_000 + built.preRollMs)
    const atMiddle = instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')

    expect(beforeMiddle).toMatchObject({ activeSegmentId: expect.any(String), progress: expect.any(Number) })
    expect(beforeMiddle!.progress).toBeGreaterThan(0.99)
    expect(atMiddle).toMatchObject({ activeSegmentId: expect.any(String), progress: 0 })
  })

  it('compiles target path orientation with the source and target rotation offsets', () => {
    const scene = pathScene()
    scene.decors.first!.offset = { ...scene.decors.first!.offset, rotate: 12 }
    scene.decors.target!.offset = { ...scene.decors.target!.offset, rotate: 28 }
    scene.decors.target!.orientToPath = true

    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
    const moveAction = perso.actions['item-kf-target-kf'] as Record<string, unknown>

    expect((moveAction.move as Record<string, unknown>).transition).toEqual({
      duration: 1_000,
      ease: 'inOut',
      path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
      orientToPath: true,
      rotateOffset: { from: 12, to: 28 },
    })
    expect((moveAction.style as Record<string, unknown> | undefined)?.rotate).toEqual({ from: 12, to: 28, duration: 1000, ease: 'inOut' })
    expect((perso.initial?.style as Record<string, unknown> | undefined)?.rotate).toBe(12)
  })

  it('passes the prepared path through the CodPlay V2 player at seek time', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const built = buildSceneDocV2(pathScene())
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-motion-path',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500 + built.preRollMs)
    const item = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(item).not.toBeNull()
    const readMotionFrame = () => instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')
    const motionAtMidpoint = readMotionFrame()
    expect(motionAtMidpoint).toMatchObject({
      activeSegmentId: expect.any(String),
      progress: 0.5,
      representation: 'local',
    })
    await instance.telco.seek(250 + built.preRollMs)
    await instance.telco.seek(500 + built.preRollMs)
    // The same absolute seek must reproduce the exact ACE presentation after a detour through
    // another instant; no live DOM pose is allowed to become a new path endpoint.
    expect(readMotionFrame()).toEqual(motionAtMidpoint)
    const state = instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state as Record<string, unknown> | undefined
    expect((state?.move as Record<string, unknown> | undefined)?.transition).toEqual(expect.objectContaining({
      duration: 1_000,
      path: expect.objectContaining({ kind: 'segments' }),
    }))
  })

  it('keeps the path tangent pose at and after the target keyframe in the real player', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const scene = pathScene()
    scene.meta.durationMs = 2_000
    scene.decors.first!.offset = { ...scene.decors.first!.offset, rotate: 0 }
    scene.decors.target!.offset = { ...scene.decors.target!.offset, rotate: 0 }
    scene.decors.target!.path = 'M 0 0 L 0 1'
    scene.decors.target!.orientToPath = true
    const built = buildSceneDocV2(scene)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-motion-path-orientation-endpoint',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })
    const readFrame = () => instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')

    await instance.telco.seek(1_000 + built.preRollMs)
    const atEnd = readFrame()
    expect(atEnd?.representation).toBe('local')
    expect(atEnd?.activeSegmentId).toBeDefined()

    await instance.telco.seek(1_200 + built.preRollMs)
    const afterEnd = readFrame()
    expect(afterEnd?.representation).toBe('local')
    expect(afterEnd?.pose.matrix).toEqual(atEnd?.pose.matrix)
  })

  it('keeps the prepared path active when Play starts from the initial seek boundary', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const built = buildSceneDocV2(pathScene())
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-motion-path-play',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(built.preRollMs)
    const sourceFrame = instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')
    expect(sourceFrame?.activeSegmentId).toBeDefined()
    expect(sourceFrame?.progress).toBe(0)

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(0)
    codplay.engine.advance(500)

    const midpointFrame = instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')
    expect(midpointFrame).toMatchObject({
      activeSegmentId: sourceFrame?.activeSegmentId,
      progress: 0.5,
      representation: 'local',
    })
  })

  it('rejects an invalid authored path before a partial V2 scene escapes the builder', () => {
    const scene = pathScene()
    scene.decors.target!.path = 'M 0 0 C 0.5 0.5 0.8 0.5 1 0'
    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'EDITOR_V2_MOTION_PATH_INVALID', context: expect.objectContaining({ keyframeId: 'target-kf' }) }),
    ]))
  })

  it('keeps the path segment-local instead of inheriting it into the following keyframe', () => {
    const scene = pathScene()
    scene.decors.final = { id: 'final', offset: { translate: { x: 80, y: 45 }, width: 10, height: 10 } }
    scene.items[0]!.keyframes.push({ id: 'final-kf', timeMs: 1_500, decorId: 'final' })
    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((candidate) => candidate.id === 'item')!
    expect(perso.actions['item-kf-target-kf']).toHaveProperty('move')
    expect(perso.actions['item-kf-final-kf']).not.toHaveProperty('move')
  })
})

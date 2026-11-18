/** @vitest-environment jsdom */

import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import type { EditorScene } from '../../src/app/commands/types'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from '../../src/item-presentation/item-motion-reference'

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
        orientToPath: false,
      },
    })
    expect(moveAction.style).toEqual(expect.objectContaining({ x: expect.any(Object), y: expect.any(Object) }))
    expect(perso.type).toBe('tag')
    expect(perso.initial?.move).toEqual({ target: `${EDITOR_V2_STORY_ID}__root` })
    expect(result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos).toHaveLength(2)
  })

  it('keeps a border decor keyframe from overriding an overlapping pose path', async () => {
    codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
    const scene = pathScene()
    scene.decors.first!.style = { 'border-width': '0cqw', 'border-style': 'solid' }
    scene.decors.border = { id: 'border', style: { 'border-width': '6cqw', 'border-style': 'solid' } }
    scene.items[0]!.rotationMode = 'tangent'
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
    const borderAction = perso.actions!['item-decor-kf-border-kf'] as Record<string, unknown>
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
    const readMotionFrame = () => instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')
    /** Resolves the presented visual centre from ACE's affine pose. */
    const centerOf = (pose: NonNullable<ReturnType<typeof readMotionFrame>>['pose']) => ({
      x: pose.origin.x + (pose.matrix.a * pose.localWidth + pose.matrix.c * pose.localHeight) / 2,
      y: pose.origin.y + (pose.matrix.b * pose.localWidth + pose.matrix.d * pose.localHeight) / 2,
    })

    await instance.telco.seek(built.preRollMs)
    const sourceFrame = readMotionFrame()
    expect(sourceFrame).toBeDefined()
    if (sourceFrame === undefined) return
    const sourceCenter = centerOf(sourceFrame.pose)
    await instance.telco.seek(500 + built.preRollMs)
    const middleFrame = readMotionFrame()
    expect(middleFrame).toBeDefined()
    if (middleFrame === undefined) return
    const middleCenter = centerOf(middleFrame.pose)
    await instance.telco.seek(1_000 + built.preRollMs)
    const targetFrame = readMotionFrame()
    expect(targetFrame).toBeDefined()
    if (targetFrame === undefined) return
    const targetCenter = centerOf(targetFrame.pose)
    const chordCenter = {
      x: (sourceCenter.x + targetCenter.x) / 2,
      y: (sourceCenter.y + targetCenter.y) / 2,
    }

    expect(Math.hypot(middleCenter.x - chordCenter.x, middleCenter.y - chordCenter.y)).toBeGreaterThan(1)

    await instance.telco.seek(999 + built.preRollMs)
    const beforeMiddle = instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')
    await instance.telco.seek(1_000 + built.preRollMs)
    const atMiddle = instance.presentation.get()?.items.find((entry) => entry.itemId === 'story-main:item')

    expect(beforeMiddle).toMatchObject({ activeSegmentId: expect.any(String), progress: expect.any(Number) })
    expect(beforeMiddle!.progress).toBeGreaterThan(0.99)
    expect(atMiddle).toMatchObject({ activeSegmentId: expect.any(String), progress: 0 })
  })

  it('compiles tangent orientation with one fixed initial rotation for every endpoint', () => {
    const scene = pathScene()
    scene.decors.first!.offset = { ...scene.decors.first!.offset, rotate: 12 }
    scene.decors.target!.offset = { ...scene.decors.target!.offset, rotate: 28 }
    scene.items[0]!.rotationMode = 'tangent'

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
      rotateOffset: { from: 12, to: 12 },
    })
    expect((moveAction.style as Record<string, unknown> | undefined)?.rotate).toBeUndefined()
    expect((perso.initial?.style as Record<string, unknown> | undefined)?.rotate).toBe(12)
  })

  it('uses the same initial angle on curves and implicit straight segments, independently for each item', () => {
    const scene = pathScene()
    scene.items[0]!.rotationMode = 'tangent'
    scene.decors.first!.offset!.rotate = 17
    scene.decors.target!.offset!.rotate = -80
    scene.decors.final = { id: 'final', offset: { translate: { x: 70, y: 60 }, rotate: 120 } }
    scene.items[0]!.keyframes.push({ id: 'final-kf', timeMs: 1500, decorId: 'final' })
    scene.items.push({ ...scene.items[0]!, id: 'manual-item', order: 'b', rotationMode: 'manual' })
    const result = buildSceneDocV2(scene)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const persos = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos
    const tangent = persos.find((perso) => perso.id === 'item')!
    const manual = persos.find((perso) => perso.id === 'manual-item')!
    expect(tangent.actions['item-kf-target-kf']).toHaveProperty('move.transition.rotateOffset', { from: 17, to: 17 })
    expect(tangent.actions['item-kf-final-kf']).toHaveProperty('move.transition', {
      duration: 500, ease: 'inOut', path: 'M 0 0 L 1 0', orientToPath: true,
      rotateOffset: { from: 17, to: 17 },
    })
    expect(tangent.actions['item-kf-final-kf']).not.toHaveProperty('style.rotate')
    expect(manual.actions['manual-item-kf-target-kf']).toHaveProperty('move.transition.orientToPath', false)
    expect(manual.actions['manual-item-kf-final-kf']).toHaveProperty('style.rotate', {
      from: -80, to: 120, duration: 500, ease: 'inOut',
    })
    expect(scene.decors.final).not.toHaveProperty('path')
    expect(scene.decors.target!.offset!.rotate).toBe(-80)
  })

  it('passes the prepared path through the CodPlay V2 player at seek time', async () => {
    codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
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
    codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
    const scene = pathScene()
    scene.meta.durationMs = 2_000
    scene.decors.first!.offset = { ...scene.decors.first!.offset, rotate: 0 }
    scene.decors.target!.offset = { ...scene.decors.target!.offset, rotate: 0 }
    scene.decors.target!.path = 'M 0 0 L 0 1'
    scene.items[0]!.rotationMode = 'tangent'
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
    codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
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
    scene.items[0]!.rotationMode = 'tangent'
    scene.decors.target!.path = 'M 0 0 C 0.5 0.5 0.8 0.5 1 0'
    const result = buildSceneDocV2(scene, new Map(), { rootWidthPx: 800, pixelRatio: 1 })
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
    expect(perso.actions['item-kf-final-kf']).toHaveProperty('move', { target: `${EDITOR_V2_STORY_ID}__root` })
    expect(perso.actions['item-kf-final-kf']).not.toHaveProperty('move.transition')
  })

  it('publishes the style-owned straight segment after a manual curve instead of its previous endpoint', async () => {
    codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
    const scene = pathScene()
    scene.decors.final = { id: 'final', offset: { translate: { x: 80, y: 45 }, rotate: 35, scale: { x: 1.4, y: 0.7 } } }
    scene.decors.target!.offset!.rotate = -15
    scene.decors.target!.offset!.scale = { x: 1, y: 1 }
    scene.items[0]!.keyframes.push({ id: 'final-kf', timeMs: 1500, decorId: 'final' })
    const built = buildSceneDocV2(scene)
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const root = document.createElement('div')
    document.body.append(root)
    const instance = codplay.instances.create({ instanceId: 'manual-curve-to-straight', ...compiled, root })
    for (const timeMs of [1250, 1500, 1100, 1250]) {
      await instance.telco.seek(timeMs + built.preRollMs)
      const item = instance.presentation.get()?.items.find(entry => entry.itemId === 'story-main:item')
      expect(item?.activeSegmentId).toContain('item-kf-final-kf')
      expect(item?.representation).toBe('source')
      if (timeMs === 1100) expect(item?.progress).toBeLessThan(0.5)
      if (timeMs !== 1100) expect(item?.progress).toBeCloseTo((timeMs - 1000) / 500)
    }
    const style = instance.snapshot.get()!.states.find(entry => entry.target.persoId === 'item')!.state.style
    expect(style).toMatchObject({ rotate: 10, scaleX: 1.2, scaleY: 0.85 })
  })

  it('compiles a rotation-independent capture reference for an unscaled manual path', () => {
    const scene = pathScene()
    scene.decors.first!.offset!.rotate = 0
    scene.decors.target!.offset!.rotate = 35
    const built = buildSceneDocV2(scene, new Map(), { rootWidthPx: 800, pixelRatio: 1 })
    expect(built.ok).toBe(true)
    if (!built.ok) return
    const item = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item')!
    expect(item.initial?.style).toHaveProperty(ITEM_MOTION_ROTATION_BASELINE, 0)
    expect(item.initial?.style).toHaveProperty(ITEM_MOTION_REFERENCE_ANGLE, 0)
    expect(item.actions['item-kf-target-kf']?.style).toMatchObject({
      rotate: { from: 0, to: 35, duration: 1_000, ease: 'inOut' },
      [ITEM_MOTION_REFERENCE_ANGLE]: 0,
    })
    expect(item.actions['item-kf-target-kf']?.style).not.toHaveProperty('scaleX')
    expect(item.actions['item-kf-target-kf']?.style).not.toHaveProperty('scaleY')
  })

  it.each(['manual', 'tangent'] as const)(
    'interpolates authored scale from its identity independently of rotation in %s mode',
    (rotationMode) => {
      const scene = pathScene()
      scene.items[0]!.rotationMode = rotationMode
      scene.decors.first!.offset!.rotate = 0
      scene.decors.target!.offset = {
        ...scene.decors.target!.offset,
        rotate: 90,
        scale: { x: 0.8, y: 0.7 },
      }
      const built = buildSceneDocV2(scene, new Map(), { rootWidthPx: 800, pixelRatio: 1 })
      expect(built.ok).toBe(true)
      if (!built.ok) return

      const item = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item')!
      const initialReferenceAngle = rotationMode === 'tangent' ? -19.052609951309023 : 0
      expect(item.actions['item-kf-target-kf']?.style).toMatchObject({
        scaleX: { from: 1, to: 0.8, duration: 1_000, ease: 'inOut' },
        scaleY: { from: 1, to: 0.7, duration: 1_000, ease: 'inOut' },
        [ITEM_MOTION_REFERENCE_ANGLE]: initialReferenceAngle,
      })
      expect(item.initial?.style).toHaveProperty(ITEM_MOTION_ROTATION_BASELINE, 0)
      expect(item.initial?.style).toHaveProperty(ITEM_MOTION_REFERENCE_ANGLE, initialReferenceAngle)
    },
  )
})

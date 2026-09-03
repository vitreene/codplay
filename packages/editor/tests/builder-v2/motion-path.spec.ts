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
      flipMode: 'local',
      transition: {
        duration: 1_000,
        ease: 'inOut',
        path: 'M 0 0 A 0.7 0.7 0 0 1 1 0',
        traversal: 'arc-length',
        pathAnchor: 'center',
      },
    })
    expect(moveAction).toHaveProperty('style')
    expect(perso.initial?.move).toEqual({ target: `${EDITOR_V2_STORY_ID}__root` })
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
    expect(item!.style.transform).toContain('translate(')
    const transformAtMidpoint = item!.style.transform
    await instance.telco.seek(250 + built.preRollMs)
    await instance.telco.seek(500 + built.preRollMs)
    // The same absolute seek must reproduce the exact ACE presentation after a detour through
    // another instant; no live DOM pose is allowed to become a new path endpoint.
    expect(item!.style.transform).toBe(transformAtMidpoint)
    const state = instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state as Record<string, unknown> | undefined
    expect((state?.move as Record<string, unknown> | undefined)?.transition).toEqual(expect.objectContaining({
      duration: 1_000,
      path: expect.objectContaining({ kind: 'segments' }),
      pathAnchor: 'center',
    }))
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

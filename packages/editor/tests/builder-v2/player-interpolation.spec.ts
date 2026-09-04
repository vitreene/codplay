/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import { parseColor } from 'ace'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import type { EditorScene } from '../../src/app/commands/types'

/** Builds the smallest editor scene whose second keyframe changes color and geometry together. */
function interpolationScene(): EditorScene {
  return {
    id: 'editor-v2-player-interpolation',
    meta: {
      title: 'Editor V2 player interpolation',
      durationMs: 1_000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    rootDecorId: 'root',
    decors: {
      root: { id: 'root' },
      first: {
        id: 'first',
        offset: { translate: { x: 10, y: 5 }, width: 20, height: 12, rotate: 0 },
        style: { 'background-color': '#ff0000' },
      },
      second: {
        id: 'second',
        offset: { translate: { x: 30, y: 25 }, width: 40, height: 22, rotate: 15 },
        style: { 'background-color': '#0000ff' },
      },
    },
    contents: { content: { id: 'content', type: 'text', text: 'interpolation' } },
    items: [{
      id: 'item',
      type: 'text',
      parentId: null,
      order: 'mmm',
      visible: true,
      contentId: 'content',
      initialDecorId: 'first',
      keyframes: [
        { id: 'first-kf', timeMs: 0, decorId: 'first' },
        { id: 'second-kf', timeMs: 1_000, decorId: 'second' },
      ],
    }],
    zones: {},
    markerTracks: {},
  }
}

/** Builds a scene whose first/last keyframes are the item's visibility boundaries. */
function visibilityBoundaryScene(firstTimeMs: number, lastTimeMs: number): EditorScene {
  const scene = interpolationScene()
  return {
    ...scene,
    id: `editor-v2-visibility-${firstTimeMs}-${lastTimeMs}`,
    meta: { ...scene.meta, durationMs: 6_000 },
    items: scene.items.map((item) => ({
      ...item,
      keyframes: [
        { ...item.keyframes[0]!, id: 'boundary-first', timeMs: firstTimeMs },
        { ...item.keyframes[1]!, id: 'boundary-last', timeMs: lastTimeMs },
      ],
    })),
  }
}

describe('editor V2 player interpolation', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('keeps color and geometry in one logical snapshot and presents both in HTML', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const built = buildSceneDocV2(interpolationScene())
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-player-interpolation',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500 + built.preRollMs)
    const snapshot = instance.snapshot.get()
    const state = snapshot?.states.find((entry) => entry.target.persoId === 'item')?.state
    const style = state?.style as Record<string, unknown> | undefined
    expect(style?.x).toMatchObject({ kind: 'length', value: 20 })
    expect(style?.y).toMatchObject({ kind: 'length', value: 15 })
    expect(style?.width).toMatchObject({ kind: 'length', value: 30 })
    expect(style?.height).toMatchObject({ kind: 'length', value: 17 })
    expect(style?.rotate).toBe(7.5)
    expect(style?.['background-color']).toEqual(expect.objectContaining({ kind: 'color' }))

    const item = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(item).not.toBeNull()
    expect(item?.style.transform).toBe('translate(160px, 120px) rotate(7.5deg)')
    expect(item?.style.width).toBe('240px')
    expect(item?.style.height).toBe('136px')
    expect(item?.style.backgroundColor).toBe(`rgb(${parseColor('#800080').coords.map((value) => Math.round(value * 255)).join(', ')})`)
  })

  it('keeps the content-box anchor fixed while border-width itself interpolates', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const source = interpolationScene()
    source.decors.first!.offset = { translate: { x: 20, y: 15 }, width: 30, height: 20 }
    source.decors.first!.style = { 'border-width': '0.6cqw', 'border-style': 'solid' }
    source.decors.second!.offset = { translate: { x: 20, y: 15 }, width: 30, height: 20 }
    source.decors.second!.style = { 'border-width': '5cqw', 'border-style': 'solid' }
    const built = buildSceneDocV2(source)
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const itemDoc = built.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'item')!
    expect(itemDoc.initial).toMatchObject({ style: { x: 19.4, y: 14.4 } })
    expect(itemDoc.actions['item-kf-second-kf']).toMatchObject({
      style: {
        x: { from: 19.4, to: 15 },
        y: { from: 14.4, to: 10 },
        'border-width': { from: '0.6cqw', to: '5cqw' },
      },
    })

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-player-border-anchor',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500 + built.preRollMs)
    const snapshotStyle = instance.snapshot.get()?.states
      .find((entry) => entry.target.persoId === 'item')?.state.style as Record<string, unknown> | undefined
    expect(snapshotStyle?.x).toMatchObject({ kind: 'length', value: 17.2 })
    expect(snapshotStyle?.y).toMatchObject({ kind: 'length', value: 12.2 })
    expect(Number.parseFloat(String(snapshotStyle?.['border-width']))).toBeCloseTo(2.8)

    const item = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')!
    expect(item.style.transform).toBe('translate(137.6px, 97.6px)')
    expect(item.style.borderWidth).toBe('2.8000000000000003cqw')
    // 137.6px layout origin + 22.4px border inset = 160px = 20cqw.
    const layoutX = item.style.transform.match(/^translate\(([-\d.]+)px/)?.[1]
    expect(layoutX).toBeDefined()
    expect(Number.parseFloat(layoutX!) + (2.8 / 100) * 800).toBeCloseTo(160)
  })

  it('interpole aussi l’origine de rotation structurée dans la même action', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const source = interpolationScene()
    source.decors.first!.offset!.rotationOrigin = { fx: 0.25, fy: 0.25 }
    source.decors.second!.offset!.rotationOrigin = { fx: 0.75, fy: 0.75 }
    const built = buildSceneDocV2(source)
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-player-origin-interpolation',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500 + built.preRollMs)
    const snapshot = instance.snapshot.get()
    const state = snapshot?.states.find((entry) => entry.target.persoId === 'item')?.state
    const style = state?.style as Record<string, unknown> | undefined
    expect(style?.['transform-origin']).toBe('50% 50%')

    const item = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
    expect(item?.style.transformOrigin).toBe('50% 50%')
  })

  it('materializes a destination-only style property without failing instance creation', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const source = interpolationScene()
    source.decors.second!.style = { color: '#ff0000' }
    const built = buildSceneDocV2(source)
    expect(built.ok).toBe(true)
    if (!built.ok) return

    const root = document.createElement('div')
    Object.defineProperty(root, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 800, height: 450, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const compiled = codplay.build({ scene: built.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const instance = codplay.instances.create({
      instanceId: 'editor-v2-player-destination-only-style',
      compiledScene: compiled.compiledScene,
      functions: compiled.functions,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
    })

    await instance.telco.seek(500 + built.preRollMs)
    const before = instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state.style as Record<string, unknown> | undefined
    expect(before).not.toHaveProperty('color')

    await instance.telco.seek(1_000 + built.preRollMs)
    const atDestination = instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state.style as Record<string, unknown> | undefined
    expect(atDestination?.color).toEqual(expect.objectContaining({ kind: 'color' }))
  })

  it('attache la visibilité au premier/dernier kf et déplace la transition d’entrée avec le premier kf', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })

    const buildRuntime = (scene: EditorScene, instanceId: string) => {
      const built = buildSceneDocV2(scene)
      expect(built.ok).toBe(true)
      if (!built.ok) throw new Error(built.diagnostics.map((diagnostic) => diagnostic.message).join('; '))

      const root = document.createElement('div')
      Object.defineProperty(root, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ width: 800, height: 450, x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 450 }),
      })
      document.body.append(root)
      const compiled = codplay!.build({ scene: built.sceneDoc })
      expect(compiled.ok).toBe(true)
      if (!compiled.ok) throw new Error(compiled.diagnostics.map((diagnostic) => diagnostic.message).join('; '))
      const instance = codplay!.instances.create({
        instanceId,
        compiledScene: compiled.compiledScene,
        functions: compiled.functions,
        root,
        mountTargets: [{ id: `${instanceId}-host`, kind: 'root', storyId: EDITOR_V2_STORY_ID }],
      })
      return { built, instance }
    }

    const initial = buildRuntime(visibilityBoundaryScene(1_000, 4_000), 'editor-v2-boundary-initial')
    expect(initial.built.preRollMs).toBe(300)
    await initial.instance.telco.seek(950)
    const beforeInitialState = initial.instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state
    expect((beforeInitialState?.style as Record<string, unknown> | undefined)?.opacity).toBe(0)
    await initial.instance.telco.seek(1_300)
    const initialState = initial.instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state
    expect((initialState?.style as Record<string, unknown> | undefined)?.opacity).toBe(1)
    await initial.instance.telco.seek(4_600)
    const afterInitialBoundaryState = initial.instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state
    expect((afterInitialBoundaryState?.style as Record<string, unknown> | undefined)?.opacity).toBe(0)

    const moved = buildRuntime(visibilityBoundaryScene(2_000, 4_500), 'editor-v2-boundary-moved')
    expect(moved.built.preRollMs).toBe(300)
    await moved.instance.telco.seek(1_300)
    const movedState = moved.instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state
    expect((movedState?.style as Record<string, unknown> | undefined)?.opacity).toBe(0)
    await moved.instance.telco.seek(4_600)
    const beforeMovedBoundaryState = moved.instance.snapshot.get()?.states.find((entry) => entry.target.persoId === 'item')?.state
    expect((beforeMovedBoundaryState?.style as Record<string, unknown> | undefined)?.opacity).toBe(1)
  })
})

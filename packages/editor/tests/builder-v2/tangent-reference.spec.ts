/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import type { EditorScene } from '../../src/app/commands/types'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'
import { ITEM_MOTION_REFERENCE_ANGLE, ITEM_MOTION_ROTATION_BASELINE } from '../../src/item-presentation/item-motion-reference'
import { resolveTemporaryPatch } from '../../src/app/bridges/decor-editor-bridge'

/** Owns a vertical then horizontal route with independent authored scale endpoints. */
function referenceScene(): EditorScene {
  return {
    id: 'tangent-reference',
    meta: { title: 'Reference', durationMs: 2000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [{
      id: 'item', type: 'text', parentId: null, order: 'a', visible: true,
      contentId: 'text', initialDecorId: 'first', rotationMode: 'tangent',
      keyframes: [
        { id: 'a', timeMs: 0, decorId: 'first', channel: 'pose' },
        { id: 'b', timeMs: 800, decorId: 'middle', channel: 'pose' },
        { id: 'c', timeMs: 1600, decorId: 'last', channel: 'pose' },
      ],
    }],
    contents: { text: { id: 'text', type: 'text', text: 'Reference' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 11, y: 7 }, width: 12, height: 8, rotate: 19, scale: { x: 1.2, y: 0.8 } } },
      middle: { id: 'middle', offset: { translate: { x: 11, y: 31 } } },
      last: { id: 'last', offset: { translate: { x: 50, y: 31 }, scale: { x: 2, y: 0.5 } } },
    },
    zones: {}, markerTracks: {},
  }
}

describe('Editor tangent capture reference', () => {
  let owner: CodPlay | undefined
  afterEach(() => { owner?.destroy(); document.body.replaceChildren() })

  it('prepares the initial and incoming headings without changing the document, offset or scale tweens', () => {
    const scene = referenceScene()
    const before = structuredClone(scene)
    const result = buildSceneDocV2(scene, new Map(), { rootWidthPx: 800, pixelRatio: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find(perso => perso.id === 'item')!
    expect(item.initial.style).toMatchObject({
      [ITEM_MOTION_REFERENCE_ANGLE]: 109,
      [ITEM_MOTION_ROTATION_BASELINE]: 19,
    })
    expect(item.actions['item-kf-b']).toHaveProperty(`style.${ITEM_MOTION_REFERENCE_ANGLE}`, 109)
    expect(item.actions['item-kf-b']).toHaveProperty('move.transition.rotateOffset', { from: 19, to: 19 })
    expect(item.actions['item-kf-c']).toHaveProperty(`style.${ITEM_MOTION_REFERENCE_ANGLE}`, 109)
    expect(item.actions['item-kf-c']).not.toHaveProperty('style.rotate')
    expect(item.actions['item-kf-c']).toHaveProperty('move.transition.rotateOffset', { from: 109, to: 19 })
    expect(item.actions['item-kf-c']).toHaveProperty('style.scaleX', { from: 1.2, to: 2, duration: 800, ease: 'inOut' })
    expect(scene).toEqual(before)

    scene.items[0]!.rotationMode = 'manual'
    const manual = buildSceneDocV2(scene, new Map(), { rootWidthPx: 800, pixelRatio: 1 })
    expect(JSON.stringify(manual)).toContain(ITEM_MOTION_REFERENCE_ANGLE)
  })

  it('carries the incoming heading through a sharp authored corner with move offsets', async () => {
    owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
    const scene = referenceScene()
    scene.decors.first!.offset = { translate: { x: 40, y: 20 }, width: 12, height: 8, rotate: 19 }
    scene.decors.middle!.offset = { translate: { x: 51, y: 48 }, width: 12, height: 8 }
    scene.decors.middle!.path = 'M 0 0 L 1 0'
    scene.decors.last!.offset = { translate: { x: 29.5, y: 26.9 }, width: 12, height: 8 }
    scene.decors.last!.path = 'M 0 0 L 1 0'
    const authoredScene = structuredClone(scene)
    const result = buildSceneDocV2(scene, new Map(), { rootWidthPx: 800, pixelRatio: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const item = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find(perso => perso.id === 'item')!
    expect(item.actions['item-kf-b']).toHaveProperty('move.transition.path', 'M 0 0 L 1 0')
    const incomingAngle = Math.atan2(48 - 20, 51 - 40) * 180 / Math.PI
    const outgoingAngle = Math.atan2(26.9 - 48, 29.5 - 51) * 180 / Math.PI
    const shortestCorrection = ((incomingAngle - outgoingAngle + 180) % 360 + 360) % 360 - 180
    expect(Math.abs(shortestCorrection)).toBeGreaterThan(150)
    expect(Math.abs(shortestCorrection)).toBeLessThan(180)
    const joinMove = item.actions['item-kf-c'] as { move: { transition: { rotateOffset: { from: number; to: number } } } }
    expect(joinMove.move.transition.rotateOffset.from).toBeCloseTo(19 + shortestCorrection, 8)
    expect(joinMove.move.transition.rotateOffset.to).toBe(19)
    const incomingAtJoin = ((incomingAngle + 19 + 180) % 360 + 360) % 360 - 180
    const outgoingAtJoin = ((outgoingAngle + joinMove.move.transition.rotateOffset.from + 180) % 360 + 360) % 360 - 180
    expect(outgoingAtJoin).toBeCloseTo(incomingAtJoin, 8)
    expect(item.actions['item-kf-c']).toHaveProperty('move.transition.path', 'M 0 0 L 1 0')
    expect(scene).toEqual(authoredScene)

    const compiled = owner.build({ scene: result.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const root = document.createElement('div')
    root.style.width = '800px'
    Object.defineProperty(root, 'getBoundingClientRect', {
      value: () => ({ width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }),
    })
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: 'tangent-corner-continuity', ...compiled, root })
    const readFrame = () => instance.presentation.get()?.items.find(entry => entry.itemId === 'story-main:item')
    await instance.telco.seek(799 + result.preRollMs)
    const incoming = readFrame()
    await instance.telco.seek(800 + result.preRollMs)
    const atJoin = readFrame()
    expect(incoming).toMatchObject({
      activeSegmentId: expect.stringContaining('item-kf-b'),
      progress: expect.any(Number),
    })
    expect(incoming!.progress).toBeGreaterThan(0.99)
    expect(atJoin).toMatchObject({
      activeSegmentId: expect.stringContaining('item-kf-c'),
      progress: 0,
    })

    await instance.telco.seek(1200 + result.preRollMs)
    expect(readFrame()).toMatchObject({
      activeSegmentId: expect.stringContaining('item-kf-c'),
      progress: 0.5,
    })
    await instance.telco.seek(1600 + result.preRollMs)
    expect(readFrame()).toMatchObject({ activeSegmentId: expect.any(String) })
  })

  it('keeps the authored logical rotation in snapshots and KF captures, and releases the reference during preview', async () => {
    owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
    const result = buildSceneDocV2(referenceScene(), new Map(), { rootWidthPx: 800, pixelRatio: 1 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const compiled = owner.build({ scene: result.sceneDoc })
    expect(compiled.ok).toBe(true)
    if (!compiled.ok) return
    const root = document.createElement('div')
    root.style.width = '800px'
    Object.defineProperty(root, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, left: 0, top: 0, right: 800, bottom: 450 }) })
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: 'reference', ...compiled, root })
    await instance.telco.seek(result.preRollMs)
    const node = root.querySelector('[data-editor-visual-for="item"]')!
    const authorRule = node.closest<HTMLElement>('[data-item-id]')!.querySelector<HTMLStyleElement>('style')!
    expect(authorRule.textContent).toContain('rotate(109deg)')
    await instance.telco.seek(1 + result.preRollMs)
    expect(authorRule.textContent).toContain('rotate(109deg)')
    await instance.telco.seek(1200 + result.preRollMs)
    const snapshot = instance.snapshot.get()!
    const style = snapshot.states.find(entry => entry.target.persoId === 'item')!.state.style
    expect(style).toMatchObject({ rotate: 19, scaleX: 1.6, scaleY: 0.65, [ITEM_MOTION_REFERENCE_ANGLE]: 109 })
    expect(JSON.stringify(resolveTemporaryPatch(snapshot, 'item'))).not.toContain(ITEM_MOTION_REFERENCE_ANGLE)
    expect(authorRule.textContent).toContain('rotate(109deg)')
    expect(node.getAttribute('style')).not.toContain(ITEM_MOTION_REFERENCE_ANGLE)

    instance.snapshot.set([{ target: { storyId: EDITOR_V2_STORY_ID, persoId: 'item' }, timeMs: 1200 + result.preRollMs,
      state: { style: { rotate: 37 } } }])
    expect(authorRule.textContent).toContain('rotate(109deg)')
    expect(instance.snapshot.get()!.states.find(entry => entry.target.persoId === 'item')!.state.style)
      .toMatchObject({ rotate: 37, [ITEM_MOTION_REFERENCE_ANGLE]: 109, [ITEM_MOTION_ROTATION_BASELINE]: 19 })
    instance.snapshot.clear()
    expect(authorRule.textContent).toContain('rotate(109deg)')
    expect(instance.snapshot.get()!.states.find(entry => entry.target.persoId === 'item')!.state.style).toMatchObject({ rotate: 19 })
  })
})

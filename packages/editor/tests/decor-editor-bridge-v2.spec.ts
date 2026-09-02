import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import type { CodPlaySnapshot } from 'codplay'
import {
  applyFrameDelta,
  resolveKeyframeAlignment,
  resolveKeyframeInsertionPatch,
  resolveTemporaryPatch,
} from '../src/app/bridges/decor-editor-bridge'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import { controllerMachine } from '../src/app/controller/controller-machine'
import type { EditorScene, Item } from '../src/app/commands/types'
import type { SelectionFrameValue } from '../src/decor-editor/types'

function snapshotFor(style: Record<string, unknown>): CodPlaySnapshot {
  return {
    states: [{ target: { storyId: 'story-main', persoId: 'item-1' }, state: { style } }],
  } as CodPlaySnapshot
}

const item: Item = {
  id: 'item-1',
  type: 'text',
  parentId: null,
  order: 'a',
  visible: true,
  contentId: null,
  initialDecorId: 'decor-0',
  keyframes: [
    { id: 'kf-a', timeMs: 0, decorId: 'decor-a' },
    { id: 'kf-b', timeMs: 1000, decorId: 'decor-b' },
  ],
}

function sceneWithDecors(): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Scene', durationMs: 1000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [item],
    contents: {},
    decors: {
      'decor-0': { id: 'decor-0', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { color: 'blue' } },
      'decor-a': { id: 'decor-a', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { color: 'blue' } },
      'decor-b': { id: 'decor-b', offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 }, style: { color: 'red' } },
    },
    zones: {},
    markerTracks: {},
  }
}

/** Applies the Selection Frame's center-origin rotate/scale transform to one local corner. */
function framePoint(value: SelectionFrameValue, localX: number, localY: number): { x: number; y: number } {
  const angle = ((value.rotate ?? 0) * Math.PI) / 180
  const scaleX = value.scaleX ?? 1
  const scaleY = value.scaleY ?? 1
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const originX = (value.rotationOrigin?.fx ?? 0.5) * value.width
  const originY = (value.rotationOrigin?.fy ?? 0.5) * value.height
  const transformedX = (localX - originX) * scaleX
  const transformedY = (localY - originY) * scaleY
  return {
    x: value.x + originX + cosine * transformedX - sine * transformedY,
    y: value.y + originY + sine * transformedX + cosine * transformedY,
  }
}

/** Asserts that two transformed frame points coincide within floating-point precision. */
function expectSamePoint(actual: { x: number; y: number }, expected: { x: number; y: number }): void {
  expect(actual.x).toBeCloseTo(expected.x, 8)
  expect(actual.y).toBeCloseTo(expected.y, 8)
}

describe('decor-editor bridge V2', () => {
  it('résout la position temporelle sans dépendre d’un node player', () => {
    expect(resolveKeyframeAlignment(item, 500)).toEqual({ kind: 'between', prevKeyframeId: 'kf-a', nextKeyframeId: 'kf-b' })
    expect(resolveKeyframeAlignment(item, 1000)).toEqual({ kind: 'exact', keyframeId: 'kf-b' })
  })

  it('garde le côté opposé fixe pendant un resize latéral sous rotation', () => {
    const base: SelectionFrameValue = { x: 100, y: 80, width: 200, height: 100, rotate: 30 }
    const radians = (30 * Math.PI) / 180
    const candidate = applyFrameDelta(base, {
      kind: 'resize',
      handle: 'e',
      dx: 40 * Math.cos(radians),
      dy: 40 * Math.sin(radians),
    })

    expect(candidate.width).toBeCloseTo(240)
    expect(candidate.height).toBe(base.height)
    expectSamePoint(framePoint(candidate, 0, 0), framePoint(base, 0, 0))
    expectSamePoint(framePoint(candidate, 0, base.height), framePoint(base, 0, base.height))
  })

  it('garde le coin opposé fixe pour un resize d’angle tourné et mis à l’échelle', () => {
    const base: SelectionFrameValue = { x: 140, y: 70, width: 180, height: 120, rotate: -22, scaleX: 1.5, scaleY: 0.75 }
    const radians = (-22 * Math.PI) / 180
    const localWidthDelta = 30
    const localHeightDelta = 20
    const dx = Math.cos(radians) * base.scaleX! * localWidthDelta
      - Math.sin(radians) * base.scaleY! * localHeightDelta
    const dy = Math.sin(radians) * base.scaleX! * localWidthDelta
      + Math.cos(radians) * base.scaleY! * localHeightDelta
    const candidate = applyFrameDelta(base, { kind: 'resize', handle: 'se', dx, dy })

    expect(candidate.width).toBeCloseTo(base.width + localWidthDelta)
    expect(candidate.height).toBeCloseTo(base.height + localHeightDelta)
    expectSamePoint(framePoint(candidate, 0, 0), framePoint(base, 0, 0))
  })

  it('compense la translation quand le pivot est déplacé sous rotation et échelle', () => {
    const base: SelectionFrameValue = {
      x: 100,
      y: 80,
      width: 200,
      height: 100,
      rotate: 37,
      scaleX: 1.25,
      scaleY: 0.8,
    }
    const candidate = applyFrameDelta(base, { kind: 'pivot', fx: 0, fy: 1 })

    expect(candidate.rotationOrigin).toEqual({ fx: 0, fy: 1 })
    for (const point of [[0, 0], [200, 0], [200, 100], [0, 100]] as const) {
      expectSamePoint(framePoint(candidate, point[0], point[1]), framePoint(base, point[0], point[1]))
    }
  })

  it('ajoute une rotation au pivot courant', () => {
    const base: SelectionFrameValue = { x: 20, y: 30, width: 80, height: 40, rotate: 12, rotationOrigin: { fx: 0, fy: 1 } }
    expect(applyFrameDelta(base, { kind: 'rotate', dr: -7 })).toMatchObject({ rotate: 5, rotationOrigin: { fx: 0, fy: 1 } })
  })

  it('garde l’axe visuel fixe lors d’une rotation après son déplacement', () => {
    const base: SelectionFrameValue = { x: 100, y: 80, width: 200, height: 100, rotate: 20 }
    const moved = applyFrameDelta(base, { kind: 'pivot', fx: 0.1, fy: 0.8 })
    const rotated = applyFrameDelta(moved, { kind: 'rotate', dr: 35 })
    const pivot = { x: moved.rotationOrigin!.fx * moved.width, y: moved.rotationOrigin!.fy * moved.height }
    expectSamePoint(framePoint(rotated, pivot.x, pivot.y), framePoint(moved, pivot.x, pivot.y))
  })

  it('lit le style temporaire depuis le snapshot logique', () => {
    const patch = resolveTemporaryPatch(snapshotFor({
      color: { kind: 'color', space: 'srgb', coords: [1, 0, 0], alpha: 1 },
      opacity: 0.5,
    }), 'item-1', [
      { path: 'style.color', kind: 'color', label: 'Texte' },
      { path: 'style.opacity', kind: 'number', label: 'Opacité' },
    ])
    expect(patch).toEqual({ style: { color: 'rgba(255, 0, 0, 1)', opacity: '0.5' } })
  })

  it('ignore une autre cible dans le snapshot', () => {
    expect(resolveTemporaryPatch(snapshotFor({ color: 'red' }), 'other-item', [
      { path: 'style.color', kind: 'color', label: 'Texte' },
    ])).toEqual({})
  })

  it('capture le candidat de preview même lorsque snapshot.get() ne le restitue pas', () => {
    const candidate = {
      style: { color: 'oklch(0.8 0.2 30)' },
      offset: { translate: { x: 32, y: 18 }, width: 24, height: 22 },
    }
    const patch = resolveKeyframeInsertionPatch(
      sceneWithDecors(), item, 500, undefined, null, candidate,
    )
    expect(patch).toEqual(candidate)
  })

  it('capture les propriétés interpolées du snapshot même sans preview utilisateur', () => {
    const patch = resolveKeyframeInsertionPatch(
      sceneWithDecors(),
      item,
      500,
      undefined,
      snapshotFor({
        color: { kind: 'color', space: 'srgb', coords: [0.5, 0.25, 0.75], alpha: 1 },
        opacity: 0.5,
        x: { kind: 'length', unit: 'cqw', value: 30 },
        y: { kind: 'length', unit: 'cqw', value: 30 },
        width: { kind: 'length', unit: 'cqw', value: 20 },
        height: { kind: 'length', unit: 'cqw', value: 20 },
        'transform-origin': '25% 75%',
      }),
      undefined,
    )
    expect(patch).toEqual({
      style: { color: 'rgba(128, 64, 191, 1)', opacity: '0.5' },
      offset: { translate: { x: 30, y: 30 }, width: 20, height: 20, rotationOrigin: { fx: 0.25, fy: 0.75 } },
    })
  })

  it('fusionne l’intervention utilisateur avec les propriétés interpolées absentes du candidat', () => {
    const patch = resolveKeyframeInsertionPatch(
      sceneWithDecors(),
      item,
      500,
      undefined,
      snapshotFor({
        color: 'purple',
        opacity: 0.5,
        x: { kind: 'length', unit: 'cqw', value: 30 },
        y: { kind: 'length', unit: 'cqw', value: 30 },
        width: { kind: 'length', unit: 'cqw', value: 20 },
        height: { kind: 'length', unit: 'cqw', value: 20 },
      }),
      { style: { color: 'orange' }, offset: { translate: { x: 42, y: 18 } } },
    )
    expect(patch).toEqual({
      style: { color: 'orange', opacity: '0.5' },
      offset: { translate: { x: 42, y: 18 }, width: 20, height: 20 },
    })
  })

  it('conserve un candidat temporaire par temps et accepte le pas arrondi de la timeline', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    const coordination = new EditorCoordinationBridge(actor, new EditorPlayerCommandFacade())
    const candidate = { itemId: 'item-1', timeMs: 2487.5, patch: { style: { color: 'red' } } }
    coordination.decorPreview.set(candidate)

    expect(coordination.decorPreview.getAt('item-1', 2487.5)).toBe(candidate)
    expect(coordination.decorPreview.getForKeyframe('item-1', 2500)).toBe(candidate)
    expect(coordination.decorPreview.getForKeyframe('item-1', 2600)).toBeNull()

    coordination.decorPreview.clear('item-1', candidate.timeMs)
    expect(coordination.decorPreview.getAt('item-1', candidate.timeMs)).toBeNull()
    coordination.destroy()
    actor.stop()
  })
})

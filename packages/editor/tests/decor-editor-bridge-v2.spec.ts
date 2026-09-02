import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import type { CodPlaySnapshot } from 'codplay'
import {
  resolveKeyframeAlignment,
  resolveKeyframeInsertionPatch,
  resolveTemporaryPatch,
} from '../src/app/bridges/decor-editor-bridge'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { DEFAULT_PALETTE } from '../src/decor-editor/default-palette'
import type { EditorScene, Item } from '../src/app/commands/types'

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

describe('decor-editor bridge V2', () => {
  it('résout la position temporelle sans dépendre d’un node player', () => {
    expect(resolveKeyframeAlignment(item, 500)).toEqual({ kind: 'between', prevKeyframeId: 'kf-a', nextKeyframeId: 'kf-b' })
    expect(resolveKeyframeAlignment(item, 1000)).toEqual({ kind: 'exact', keyframeId: 'kf-b' })
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
      sceneWithDecors(), item, 500, undefined, null, DEFAULT_PALETTE, 'text', candidate,
    )
    expect(patch).toEqual(candidate)
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

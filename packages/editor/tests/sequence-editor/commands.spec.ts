// Bibliothèque de commandes locales au sequence-editor — même patron de test que
// `tests/commands/base-commands.spec.ts` : entrée → sortie, sans DOM, sans état.

import { describe, expect, it } from 'vitest'
import * as commands from '../../src/sequence-editor/commands'
import type { EditorScene, Item } from '../../src/sequence-editor/types'

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    type: 'text',
    parentId: null,
    order: 'a',
    visible: true,
    contentId: null,
    initialDecorId: 'd0',
    keyframes: [],
    ...overrides,
  }
}

function scene(items: Item[] = []): EditorScene {
  return {
    id: 'scene-1',
    meta: { title: 'Scene', durationMs: 10000, durationSource: 'arbitrary', timeUnit: 's', capsuleOrder: 'forward' },
    items,
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
  }
}

describe('createNamedKeyframe', () => {
  it('creates a keyframe with a fresh decor when none is given', () => {
    const s = commands.createNamedKeyframe(scene([item('t1')]), { itemId: 't1', keyframeId: 'kf-1', timeMs: 1000 })
    const kf = s.items[0]!.keyframes[0]!
    expect(kf.id).toBe('kf-1')
    expect(kf.timeMs).toBe(1000)
    expect(kf.decorId).toBeTruthy()
    expect(s.decors[kf.decorId]).toBeDefined()
  })

  it('reuses an existing decorId when given', () => {
    const s0 = scene([item('t1')])
    s0.decors['d-existing'] = { id: 'd-existing' }
    const s = commands.createNamedKeyframe(s0, { itemId: 't1', keyframeId: 'kf-1', timeMs: 1000, decorId: 'd-existing' })
    expect(s.items[0]!.keyframes[0]!.decorId).toBe('d-existing')
    expect(Object.keys(s.decors)).toEqual(['d-existing'])
  })

  it('sets name and keeps keyframes sorted by time', () => {
    const s0 = scene([item('t1', { keyframes: [{ id: 'kf-0', timeMs: 500, decorId: 'd0' }] })])
    const s = commands.createNamedKeyframe(s0, { itemId: 't1', keyframeId: 'kf-1', timeMs: 100, name: 'intro' })
    expect(s.items[0]!.keyframes.map((k) => k.id)).toEqual(['kf-1', 'kf-0'])
    expect(s.items[0]!.keyframes[0]!.name).toBe('intro')
  })
})

describe('deleteKeyframe', () => {
  it('removes the keyframe and prunes its orphan decor', () => {
    const s0 = scene([item('t1', { keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'd1' }] })])
    s0.decors['d1'] = { id: 'd1' }
    const s = commands.deleteKeyframe(s0, { itemId: 't1', keyframeId: 'kf-1' })
    expect(s.items[0]!.keyframes).toHaveLength(0)
    expect(s.decors['d1']).toBeUndefined()
  })

  it('keeps a decor still referenced by another keyframe', () => {
    const s0 = scene([
      item('t1', {
        keyframes: [
          { id: 'kf-1', timeMs: 0, decorId: 'd1' },
          { id: 'kf-2', timeMs: 100, decorId: 'd1' },
        ],
      }),
    ])
    s0.decors['d1'] = { id: 'd1' }
    const s = commands.deleteKeyframe(s0, { itemId: 't1', keyframeId: 'kf-1' })
    expect(s.decors['d1']).toBeDefined()
  })
})

describe('moveKeyframe', () => {
  it('moves and re-sorts', () => {
    const s0 = scene([
      item('t1', {
        keyframes: [
          { id: 'kf-1', timeMs: 100, decorId: 'd1' },
          { id: 'kf-2', timeMs: 200, decorId: 'd2' },
        ],
      }),
    ])
    const s = commands.moveKeyframe(s0, { itemId: 't1', keyframeId: 'kf-1', timeMs: 300 })
    expect(s.items[0]!.keyframes.map((k) => k.id)).toEqual(['kf-2', 'kf-1'])
  })
})

describe('renameKeyframe / assignKeyframeDecor / transitions / markers on a keyframe', () => {
  const base = () => scene([item('t1', { keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'd1' }] })])

  it('renameKeyframe sets or clears name', () => {
    let s = commands.renameKeyframe(base(), { itemId: 't1', keyframeId: 'kf-1', name: 'intro' })
    expect(s.items[0]!.keyframes[0]!.name).toBe('intro')
    s = commands.renameKeyframe(s, { itemId: 't1', keyframeId: 'kf-1', name: null })
    expect(s.items[0]!.keyframes[0]!.name).toBeUndefined()
  })

  it('assignKeyframeDecor sets decorId', () => {
    const s = commands.assignKeyframeDecor(base(), { itemId: 't1', keyframeId: 'kf-1', decorId: 'd9' })
    expect(s.items[0]!.keyframes[0]!.decorId).toBe('d9')
  })

  it('setKeyframeTransitionIn/Out set or clear', () => {
    let s = commands.setKeyframeTransitionIn(base(), { itemId: 't1', keyframeId: 'kf-1', transition: { kind: 'named', name: 'fade', durationMs: 300 } })
    expect(s.items[0]!.keyframes[0]!.transitionIn).toEqual({ kind: 'named', name: 'fade', durationMs: 300 })
    s = commands.setKeyframeTransitionOut(s, { itemId: 't1', keyframeId: 'kf-1', transition: null })
    expect(s.items[0]!.keyframes[0]!.transitionOut).toBeUndefined()
  })

  it('attachMarkerToKeyframe / detachMarkerFromKeyframe', () => {
    let s = commands.attachMarkerToKeyframe(base(), { itemId: 't1', keyframeId: 'kf-1', markerId: 'm1' })
    expect(s.items[0]!.keyframes[0]!.markerId).toBe('m1')
    s = commands.detachMarkerFromKeyframe(s, { itemId: 't1', keyframeId: 'kf-1' })
    expect(s.items[0]!.keyframes[0]!.markerId).toBeUndefined()
  })
})

describe('clearItemKeyframes / clearCapsuleKeyframes', () => {
  it('clearItemKeyframes empties one item and prunes orphan decors', () => {
    const s0 = scene([item('t1', { keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'd1' }] })])
    s0.decors['d1'] = { id: 'd1' }
    const s = commands.clearItemKeyframes(s0, { itemId: 't1' })
    expect(s.items[0]!.keyframes).toHaveLength(0)
    expect(s.decors['d1']).toBeUndefined()
  })

  it('clearCapsuleKeyframes clears the capsule and its descendants (parentId-derived)', () => {
    const capsule = item('cap', { type: 'capsule', keyframes: [{ id: 'kf-cap', timeMs: 0, decorId: 'd0' }] })
    const child = item('child', { parentId: 'cap', keyframes: [{ id: 'kf-c', timeMs: 0, decorId: 'd1' }] })
    const s = commands.clearCapsuleKeyframes(scene([capsule, child]), { itemId: 'cap' })
    expect(s.items.find((i) => i.id === 'cap')!.keyframes).toHaveLength(0)
    expect(s.items.find((i) => i.id === 'child')!.keyframes).toHaveLength(0)
  })
})

describe('toggleItemVisibility', () => {
  it('flips visible', () => {
    const s = commands.toggleItemVisibility(scene([item('t1', { visible: true })]), { itemId: 't1' })
    expect(s.items[0]!.visible).toBe(false)
  })
})

describe('marker tracks / markers', () => {
  it('addMarkerTrack creates a visible empty track', () => {
    const s = commands.addMarkerTrack(scene(), { markerTrackId: 'mt1', label: 'Repères' })
    expect(s.markerTracks['mt1']).toMatchObject({ label: 'Repères', visible: true, markers: [] })
  })

  it('removeMarkerTrack removes the track and detaches its markers from keyframes', () => {
    const s0 = scene([item('t1', { keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'd1', markerId: 'm1' }] })])
    s0.markerTracks['mt1'] = { id: 'mt1', label: 'x', visible: true, markers: [{ id: 'm1', timeMs: 0, label: 'M1' }] }
    const s = commands.removeMarkerTrack(s0, { markerTrackId: 'mt1' })
    expect(s.markerTracks['mt1']).toBeUndefined()
    expect(s.items[0]!.keyframes[0]!.markerId).toBeUndefined()
  })

  it('renameMarkerTrack / toggleMarkerTrackVisibility', () => {
    const s0 = scene()
    s0.markerTracks['mt1'] = { id: 'mt1', label: 'x', visible: true, markers: [] }
    let s = commands.renameMarkerTrack(s0, { markerTrackId: 'mt1', label: 'y' })
    expect(s.markerTracks['mt1']!.label).toBe('y')
    s = commands.toggleMarkerTrackVisibility(s, { markerTrackId: 'mt1' })
    expect(s.markerTracks['mt1']!.visible).toBe(false)
  })

  it('addMarker / moveMarker (propagates to attached keyframes) / removeMarker (detaches)', () => {
    const s0 = scene([item('t1', { keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'd1', markerId: 'm1' }] })])
    s0.markerTracks['mt1'] = { id: 'mt1', label: 'x', visible: true, markers: [{ id: 'm1', timeMs: 0, label: 'M1' }] }

    let s = commands.moveMarker(s0, { markerId: 'm1', timeMs: 500 })
    expect(s.markerTracks['mt1']!.markers[0]!.timeMs).toBe(500)
    expect(s.items[0]!.keyframes[0]!.timeMs).toBe(500)

    s = commands.removeMarker(s, { markerId: 'm1' })
    expect(s.markerTracks['mt1']!.markers).toHaveLength(0)
    expect(s.items[0]!.keyframes[0]!.markerId).toBeUndefined()
    expect(s.items[0]!.keyframes[0]!.timeMs).toBe(500)
  })
})

describe('setMasterWaveform', () => {
  it('writes onto the master item Content', () => {
    const s0 = scene([item('media-1', { type: 'media', contentId: 'content-1' })])
    s0.contents['content-1'] = { id: 'content-1', type: 'media' }
    s0.masterItemId = 'media-1'
    const wf = { version: 1 as const, sampleRate: 100, durationSec: 1, points: 1, min: [0], max: [0] }
    const s = commands.setMasterWaveform(s0, { waveform: wf })
    expect(s.contents['content-1']!.waveform).toEqual(wf)
  })

  it('is a no-op without masterItemId', () => {
    const s0 = scene()
    const wf = { version: 1 as const, sampleRate: 100, durationSec: 1, points: 1, min: [0], max: [0] }
    const s = commands.setMasterWaveform(s0, { waveform: wf })
    expect(s.contents).toEqual({})
  })
})

describe('setSceneDuration', () => {
  it('updates durationMs and optionally durationSource', () => {
    const s = commands.setSceneDuration(scene(), { durationMs: 5000, source: 'audio-primary' })
    expect(s.meta.durationMs).toBe(5000)
    expect(s.meta.durationSource).toBe('audio-primary')
  })
})

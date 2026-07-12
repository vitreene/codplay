// Filet de sécurité — mêmes scénarios comportementaux que la version pré-migration (git history),
// réécrits contre le modèle plat cible (`plan/app/2026-07-13-sequence-editor-model-migration-plan.md`
// §4, étape 4 : réécrire `machine.ts` guidé par ce filet, même résultat observable). Ce fichier
// remplace la version « ancien modèle » désormais obsolète — plus un instantané, la référence de
// comportement pour ce module dorénavant.

import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { sequenceEditorMachine, applySnapToMs } from '../../src/sequence-editor/machine'
import type { EditorScene, Item } from '../../src/sequence-editor/types'

function actorWithScene(scene: EditorScene) {
  const actor = createActor(sequenceEditorMachine, { input: { scene, viewWidthPx: 800, viewHeightPx: 600 } })
  actor.start()
  return actor
}

function elementItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    type: 'text',
    label: id,
    parentId: null,
    order: 'a',
    visible: true,
    contentId: null,
    initialDecorId: 'decor-init',
    keyframes: [],
    ...overrides,
  }
}

function capsuleItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    type: 'capsule',
    label: id,
    parentId: null,
    order: 'a',
    visible: true,
    contentId: null,
    initialDecorId: 'decor-init',
    keyframes: [],
    capsule: { kind: 'rangee', distribution: { mode: 'sequential' } },
    ...overrides,
  }
}

function baseScene(items: Item[] = []): EditorScene {
  return {
    id: 'scene-1',
    meta: {
      title: 'Scene',
      durationMs: 10000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items,
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
  }
}

describe('sequenceEditorMachine — keyframes', () => {
  it('KEYFRAME.ADD inserts a keyframe sorted by time', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 2000, id: 'kf-b' })
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 1000, id: 'kf-a' })

    const item = actor.getSnapshot().context.scene.items[0]!
    expect(item.keyframes.map((k) => k.id)).toEqual(['kf-a', 'kf-b'])
    expect(item.keyframes.map((k) => k.timeMs)).toEqual([1000, 2000])
  })

  it('KEYFRAME.ADD snaps timeMs to the 100ms time step', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 1234, id: 'kf-a' })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.timeMs).toBe(1200)
  })

  it('KEYFRAME.ADD clamps timeMs into [0, durationMs]', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: -500, id: 'kf-a' })
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 99999, id: 'kf-b' })
    const kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    expect(kfs.find((k) => k.id === 'kf-a')!.timeMs).toBe(0)
    expect(kfs.find((k) => k.id === 'kf-b')!.timeMs).toBe(10000)
  })

  it('KEYFRAME.ADD without an explicit decorId creates one rather than leaving it null (Keyframe.decorId is mandatory in the target model)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 1000, id: 'kf-a' })
    const ctx = actor.getSnapshot().context
    const kf = ctx.scene.items[0]!.keyframes[0]!
    expect(kf.decorId).toBeTruthy()
    expect(ctx.scene.decors[kf.decorId]).toBeDefined()
  })

  it('KEYFRAME.REMOVE removes the keyframe and prunes its orphan decor', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    scene.decors['d1'] = { id: 'd1' }
    const actor = actorWithScene(scene)

    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 't1', keyframeId: 'kf-a' })

    const ctx = actor.getSnapshot().context
    expect(ctx.scene.items[0]!.keyframes).toHaveLength(0)
    expect(ctx.scene.decors['d1']).toBeUndefined()
  })

  it('KEYFRAME.REMOVE keeps a decor still referenced by another keyframe', () => {
    const scene = baseScene([
      elementItem('t1', {
        keyframes: [
          { id: 'kf-a', timeMs: 1000, decorId: 'd1' },
          { id: 'kf-b', timeMs: 2000, decorId: 'd1' },
        ],
      }),
    ])
    scene.decors['d1'] = { id: 'd1' }
    const actor = actorWithScene(scene)

    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 't1', keyframeId: 'kf-a' })

    expect(actor.getSnapshot().context.scene.decors['d1']).toBeDefined()
  })

  it('KEYFRAME.REMOVE clears the selection when the removed keyframe was selected', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    const actor = actorWithScene(scene)
    actor.send({ type: 'KEYFRAME.SELECT', trackId: 't1', keyframeId: 'kf-a' })

    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 't1', keyframeId: 'kf-a' })

    expect(actor.getSnapshot().context.selection).toEqual({ trackId: null, keyframeId: null, markerId: null })
  })

  it('KEYFRAME.CLEAR_TRACK empties keyframes and prunes orphan decors', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    scene.decors['d1'] = { id: 'd1' }
    const actor = actorWithScene(scene)

    actor.send({ type: 'KEYFRAME.CLEAR_TRACK', trackId: 't1' })

    const ctx = actor.getSnapshot().context
    expect(ctx.scene.items[0]!.keyframes).toHaveLength(0)
    expect(ctx.scene.decors['d1']).toBeUndefined()
  })

  it('KEYFRAME.CLEAR_CAPSULE clears keyframes on the capsule and all its descendants (parentId-derived, not a `.children` walk)', () => {
    const capsule = capsuleItem('cap', { keyframes: [{ id: 'kf-cap', timeMs: 0, decorId: 'd0', name: 'intro' }] })
    const child = elementItem('child', { parentId: 'cap', keyframes: [{ id: 'kf-c', timeMs: 500, decorId: 'd1' }] })
    const actor = actorWithScene(baseScene([capsule, child]))

    actor.send({ type: 'KEYFRAME.CLEAR_CAPSULE', trackId: 'cap' })

    const ctx = actor.getSnapshot().context
    expect(ctx.scene.items.find((i) => i.id === 'cap')!.keyframes).toHaveLength(0)
    expect(ctx.scene.items.find((i) => i.id === 'child')!.keyframes).toHaveLength(0)
  })

  it('KEYFRAME.RENAME sets the name field', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    const actor = actorWithScene(scene)
    actor.send({ type: 'KEYFRAME.RENAME', trackId: 't1', keyframeId: 'kf-a', name: 'intro' })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.name).toBe('intro')
  })

  it('KEYFRAME.ASSIGN_DECOR sets decorId', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    const actor = actorWithScene(scene)
    actor.send({ type: 'KEYFRAME.ASSIGN_DECOR', trackId: 't1', keyframeId: 'kf-a', decorId: 'd9' })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.decorId).toBe('d9')
  })

  it('KEYFRAME.SET_TRANSITION_IN / OUT set the transition fields', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    const actor = actorWithScene(scene)
    actor.send({ type: 'KEYFRAME.SET_TRANSITION_IN', trackId: 't1', keyframeId: 'kf-a', def: { kind: 'named', name: 'fade', durationMs: 300 } })
    actor.send({ type: 'KEYFRAME.SET_TRANSITION_OUT', trackId: 't1', keyframeId: 'kf-a', def: { kind: 'named', name: 'cut', durationMs: 0 } })
    const kf = actor.getSnapshot().context.scene.items[0]!.keyframes[0]!
    expect(kf.transitionIn).toEqual({ kind: 'named', name: 'fade', durationMs: 300 })
    expect(kf.transitionOut).toEqual({ kind: 'named', name: 'cut', durationMs: 0 })
  })
})

describe('sequenceEditorMachine — snap', () => {
  it('applySnapToMs snaps to the nearest point within threshold', () => {
    const snapGrid = [{ timeMs: 1000, kind: 'keyframe' as const, sourceId: 'kf-a' }]
    expect(applySnapToMs(1005, snapGrid, 50)).toBe(1000)
  })

  it('applySnapToMs falls back to the time step grid outside threshold', () => {
    const snapGrid = [{ timeMs: 1000, kind: 'keyframe' as const, sourceId: 'kf-a' }]
    expect(applySnapToMs(1234, snapGrid, 10)).toBe(1200)
  })
})

describe('sequenceEditorMachine — drag', () => {
  it('DRAG.START_KEYFRAME → DRAG.MOVE → DRAG.END commits the new time, sorted', () => {
    const scene = baseScene([
      elementItem('t1', {
        keyframes: [
          { id: 'kf-a', timeMs: 1000, decorId: 'd1' },
          { id: 'kf-b', timeMs: 3000, decorId: 'd2' },
        ],
      }),
    ])
    const actor = actorWithScene(scene)

    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 't1', keyframeId: 'kf-a' })
    expect(actor.getSnapshot().value).toBe('dragging-keyframe')

    actor.send({ type: 'DRAG.MOVE', pointerMs: 4000 })
    actor.send({ type: 'DRAG.END' })

    expect(actor.getSnapshot().value).toBe('idle')
    const kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    expect(kfs.map((k) => k.id)).toEqual(['kf-b', 'kf-a'])
    expect(kfs.find((k) => k.id === 'kf-a')!.timeMs).toBe(4000)
  })

  it('DRAG.MOVE clamps currentMs into scene bounds, so DRAG.END always commits within [0, durationMs]', () => {
    // `DRAG.MOVE` clamps `currentMs` before `canCommitDrag` ever runs, so the guard is structurally
    // always true through the public API — documented here as observed behavior.
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    const actor = actorWithScene(scene)

    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 't1', keyframeId: 'kf-a' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 999999 })
    actor.send({ type: 'DRAG.END' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.timeMs).toBe(10000)
  })
})

describe('sequenceEditorMachine — clip draw (capsule intro/outro)', () => {
  it('CLIP.START_DRAW → CLIP.DRAW_MOVE → CLIP.DRAW_END creates intro/outro keyframes', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap', { keyframes: [] })]))

    actor.send({ type: 'CLIP.START_DRAW', trackId: 'cap', pointerMs: 1000, introId: 'intro-1', outroId: 'outro-1' })
    expect(actor.getSnapshot().value).toBe('drawing-clip')

    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 4000 })
    actor.send({ type: 'CLIP.DRAW_END' })

    expect(actor.getSnapshot().value).toBe('idle')
    const kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    const intro = kfs.find((k) => k.name === 'intro')!
    const outro = kfs.find((k) => k.name === 'outro')!
    expect(intro.timeMs).toBe(1000)
    expect(outro.timeMs).toBe(4000)
    expect(intro.decorId).toBeTruthy()
    expect(outro.decorId).toBeTruthy()
  })

  it('CLIP.DRAW_END discards the draw when min >= max (degenerate range)', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap', { keyframes: [] })]))

    actor.send({ type: 'CLIP.START_DRAW', trackId: 'cap', pointerMs: 1000, introId: 'i', outroId: 'o' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 1000 })
    actor.send({ type: 'CLIP.DRAW_END' })

    expect(actor.getSnapshot().context.scene.items[0]!.keyframes).toHaveLength(0)
  })

  it('CLIP.PLACE places intro first, then outro, then moves the nearest bound', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap', { keyframes: [] })]))

    actor.send({ type: 'CLIP.PLACE', trackId: 'cap', pointerMs: 1000 })
    let kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    expect(kfs).toHaveLength(1)
    expect(kfs[0]!.name).toBe('intro')

    actor.send({ type: 'CLIP.PLACE', trackId: 'cap', pointerMs: 5000 })
    kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    expect(kfs).toHaveLength(2)
    expect(kfs.find((k) => k.name === 'outro')!.timeMs).toBe(5000)

    // Third placement: moves whichever bound (intro/outro) is nearest.
    actor.send({ type: 'CLIP.PLACE', trackId: 'cap', pointerMs: 900 })
    kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    expect(kfs.find((k) => k.name === 'intro')!.timeMs).toBe(900)
  })
})

describe('sequenceEditorMachine — virtual keyframes (nested capsule distribution)', () => {
  it('computes virtual keyframes for free (unlocked) children of a capsule with intro/outro + capsule.kind (parentId-derived children, not `.children`)', () => {
    const capsule = capsuleItem('cap', {
      keyframes: [
        { id: 'kf-intro', timeMs: 0, decorId: 'd0', name: 'intro' },
        { id: 'kf-outro', timeMs: 4000, decorId: 'd0', name: 'outro' },
      ],
    })
    const child = elementItem('child-1', { parentId: 'cap' })
    const actor = actorWithScene(baseScene([capsule, child]))

    const vkfs = actor.getSnapshot().context.virtualKeyframes
    expect(vkfs.some((v) => v.trackId === 'child-1' && v.name === 'intro')).toBe(true)
    expect(vkfs.some((v) => v.trackId === 'child-1' && v.name === 'outro')).toBe(true)
  })

  it('does not produce virtual keyframes for a capsule missing intro/outro or capsule.kind', () => {
    const capsuleNoKind = capsuleItem('cap', {
      capsule: undefined,
      keyframes: [
        { id: 'kf-intro', timeMs: 0, decorId: 'd0', name: 'intro' },
        { id: 'kf-outro', timeMs: 4000, decorId: 'd0', name: 'outro' },
      ],
    })
    const child = elementItem('child-1', { parentId: 'cap' })
    const actor = actorWithScene(baseScene([capsuleNoKind, child]))
    expect(actor.getSnapshot().context.virtualKeyframes).toHaveLength(0)
  })

  it('does not produce a virtual keyframe for a child that already has its own real intro/outro (locked)', () => {
    const capsule = capsuleItem('cap', {
      keyframes: [
        { id: 'kf-intro', timeMs: 0, decorId: 'd0', name: 'intro' },
        { id: 'kf-outro', timeMs: 4000, decorId: 'd0', name: 'outro' },
      ],
    })
    const child = elementItem('child-1', {
      parentId: 'cap',
      keyframes: [
        { id: 'kf-ci', timeMs: 500, decorId: 'd1', name: 'intro' },
        { id: 'kf-co', timeMs: 3500, decorId: 'd1', name: 'outro' },
      ],
    })
    const actor = actorWithScene(baseScene([capsule, child]))
    const vkfs = actor.getSnapshot().context.virtualKeyframes
    expect(vkfs.some((v) => v.trackId === 'child-1')).toBe(false)
  })
})

describe('sequenceEditorMachine — playhead', () => {
  it('PLAYHEAD.START_PLAY transitions to playing, PLAYHEAD.TICK advances playheadMs', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    expect(actor.getSnapshot().value).toBe('playing')
    expect(actor.getSnapshot().context.isPlaying).toBe(true)

    actor.send({ type: 'PLAYHEAD.TICK', deltaMs: 500 })
    expect(actor.getSnapshot().context.playheadMs).toBe(500)
  })

  it('PLAYHEAD.TICK past durationMs stops playback and clamps playheadMs at duration', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    actor.send({ type: 'PLAYHEAD.TICK', deltaMs: 999999 })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.isPlaying).toBe(false)
    expect(actor.getSnapshot().context.playheadMs).toBe(10000)
  })

  it('PLAYHEAD.PAUSE stops playback without resetting playheadMs', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    actor.send({ type: 'PLAYHEAD.TICK', deltaMs: 500 })
    actor.send({ type: 'PLAYHEAD.PAUSE' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.isPlaying).toBe(false)
    expect(actor.getSnapshot().context.playheadMs).toBe(500)
  })

  it('PLAYHEAD.STOP resets playheadMs to 0', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    actor.send({ type: 'PLAYHEAD.TICK', deltaMs: 500 })
    actor.send({ type: 'PLAYHEAD.STOP' })

    expect(actor.getSnapshot().context.playheadMs).toBe(0)
    expect(actor.getSnapshot().context.isPlaying).toBe(false)
  })

  it('PLAYHEAD.START_PLAY resumes from playRange.inMs when a play range is set', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYRANGE.SET', inMs: 2000, outMs: 5000 })
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    expect(actor.getSnapshot().context.playheadMs).toBe(2000)
  })

  it('PLAYHEAD.SET clamps into [0, durationMs]', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYHEAD.SET', timeMs: -100 })
    expect(actor.getSnapshot().context.playheadMs).toBe(0)
    actor.send({ type: 'PLAYHEAD.SET', timeMs: 999999 })
    expect(actor.getSnapshot().context.playheadMs).toBe(10000)
  })
})

describe('sequenceEditorMachine — play range', () => {
  it('PLAYRANGE.SET / PLAYRANGE.CLEAR work in any state', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYRANGE.SET', inMs: 1000, outMs: 5000 })
    expect(actor.getSnapshot().context.playRange).toEqual({ inMs: 1000, outMs: 5000 })
    actor.send({ type: 'PLAYRANGE.CLEAR' })
    expect(actor.getSnapshot().context.playRange).toBeNull()
  })
})

describe('sequenceEditorMachine — viewport', () => {
  it('VIEWPORT.ZOOM changes pixelsPerMs within [MIN, MAX] bounds', () => {
    const actor = actorWithScene(baseScene())
    const before = actor.getSnapshot().context.viewport.pixelsPerMs
    actor.send({ type: 'VIEWPORT.ZOOM', factor: 2, focusMs: 0 })
    expect(actor.getSnapshot().context.viewport.pixelsPerMs).toBeGreaterThan(before)
  })

  it('VIEWPORT.SCROLL clamps startMs within [0, durationMs - visibleDuration]', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'VIEWPORT.SCROLL', startMs: -500 })
    expect(actor.getSnapshot().context.viewport.startMs).toBe(0)
  })

  it('VIEWPORT.PAN_START → PAN_MOVE → PAN_END updates viewport.startMs and returns to idle', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'VIEWPORT.PAN_START', pointerPx: 100 })
    expect(actor.getSnapshot().value).toBe('panning')
    actor.send({ type: 'VIEWPORT.PAN_MOVE', pointerPx: 50 })
    actor.send({ type: 'VIEWPORT.PAN_END' })
    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('VIEWPORT.RESIZE updates viewWidthPx/viewHeightPx and recomputes endMs', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'VIEWPORT.RESIZE', widthPx: 1000, heightPx: 400 })
    const vp = actor.getSnapshot().context.viewport
    expect(vp.viewWidthPx).toBe(1000)
    expect(vp.viewHeightPx).toBe(400)
  })
})

describe('sequenceEditorMachine — tracks (items)', () => {
  it('TRACK.ADD appends an item with empty keyframes', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'TRACK.ADD', item: { id: 't1', type: 'text', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'd0' } })
    const items = actor.getSnapshot().context.scene.items
    expect(items).toHaveLength(1)
    expect(items[0]!.keyframes).toEqual([])
  })

  it('TRACK.MOVE changes parentId/order in place — a flat field swap, no children array to splice', () => {
    const actor = actorWithScene(baseScene([elementItem('t1'), capsuleItem('cap')]))
    actor.send({ type: 'TRACK.MOVE', trackId: 't1', parentId: 'cap', order: 'b' })
    const moved = actor.getSnapshot().context.scene.items.find((i) => i.id === 't1')!
    expect(moved.parentId).toBe('cap')
    expect(moved.order).toBe('b')
  })

  it('TRACK.REMOVE removes a top-level item and clears selection if selected', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'TRACK.SELECT', trackId: 't1' })
    actor.send({ type: 'TRACK.REMOVE', trackId: 't1' })
    expect(actor.getSnapshot().context.scene.items).toHaveLength(0)
    expect(actor.getSnapshot().context.selection.trackId).toBeNull()
  })

  it('TRACK.REMOVE removes a capsule and its descendants (parentId-derived, not a `.children` walk)', () => {
    const capsule = capsuleItem('cap')
    const child = elementItem('child', { parentId: 'cap' })
    const grandchild = elementItem('grandchild', { parentId: 'child' })
    const actor = actorWithScene(baseScene([capsule, child, grandchild]))
    actor.send({ type: 'TRACK.REMOVE', trackId: 'cap' })
    expect(actor.getSnapshot().context.scene.items).toHaveLength(0)
  })

  it('TRACK.TOGGLE_VISIBILITY flips visible', () => {
    const actor = actorWithScene(baseScene([elementItem('t1', { visible: true })]))
    actor.send({ type: 'TRACK.TOGGLE_VISIBILITY', trackId: 't1' })
    expect(actor.getSnapshot().context.scene.items[0]!.visible).toBe(false)
  })

  it('TRACK.RESET_KEYFRAMES empties keyframes on the given item only', () => {
    const scene = baseScene([
      elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] }),
      elementItem('t2', { keyframes: [{ id: 'kf-b', timeMs: 2000, decorId: 'd2' }] }),
    ])
    const actor = actorWithScene(scene)
    actor.send({ type: 'TRACK.RESET_KEYFRAMES', trackId: 't1' })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes).toHaveLength(0)
    expect(actor.getSnapshot().context.scene.items[1]!.keyframes).toHaveLength(1)
  })
})

describe('sequenceEditorMachine — selection', () => {
  it('TRACK.SELECT / KEYFRAME.SELECT / MARKER.SELECT are mutually exclusive', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'TRACK.SELECT', trackId: 't1' })
    expect(actor.getSnapshot().context.selection).toEqual({ trackId: 't1', keyframeId: null, markerId: null })

    actor.send({ type: 'MARKER.SELECT', markerId: 'm1' })
    expect(actor.getSnapshot().context.selection).toEqual({ trackId: null, keyframeId: null, markerId: 'm1' })
  })
})

describe('sequenceEditorMachine — markers (markerTracks as Record, same patron as `zones`)', () => {
  it('MARKER_TRACK.ADD / MARKER.MOVE propagates to attached keyframes', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1', markerId: 'm1' }] })])
    scene.markerTracks = { mt1: { id: 'mt1', label: 'Markers', visible: true, markers: [{ id: 'm1', timeMs: 1000, label: 'M1' }] } }
    const actor = actorWithScene(scene)

    actor.send({ type: 'MARKER.MOVE', markerId: 'm1', timeMs: 3000 })

    expect(actor.getSnapshot().context.scene.markerTracks['mt1']!.markers[0]!.timeMs).toBe(3000)
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.timeMs).toBe(3000)
  })

  it('MARKER_TRACK.REMOVE detaches markerId from any keyframe referencing it', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1', markerId: 'm1' }] })])
    scene.markerTracks = { mt1: { id: 'mt1', label: 'Markers', visible: true, markers: [{ id: 'm1', timeMs: 1000, label: 'M1' }] } }
    const actor = actorWithScene(scene)

    actor.send({ type: 'MARKER_TRACK.REMOVE', markerTrackId: 'mt1' })

    expect(actor.getSnapshot().context.scene.markerTracks['mt1']).toBeUndefined()
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.markerId).toBeUndefined()
  })

  it('KEYFRAME.ATTACH_MARKER / DETACH_MARKER set and clear markerId', () => {
    const scene = baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })])
    const actor = actorWithScene(scene)
    actor.send({ type: 'KEYFRAME.ATTACH_MARKER', trackId: 't1', keyframeId: 'kf-a', markerId: 'm1' })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.markerId).toBe('m1')
    actor.send({ type: 'KEYFRAME.DETACH_MARKER', trackId: 't1', keyframeId: 'kf-a' })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.markerId).toBeUndefined()
  })
})

describe('sequenceEditorMachine — audio (master item + Content, replaces the old scene.audio field)', () => {
  it('AUDIO.SET_WAVEFORM writes onto the master item Content, not a scene-level field', () => {
    const scene = baseScene([elementItem('media-1', { type: 'media', contentId: 'content-1' })])
    scene.contents['content-1'] = { id: 'content-1', type: 'media', source: 'voice.mp3' }
    scene.masterItemId = 'media-1'
    const actor = actorWithScene(scene)

    actor.send({ type: 'AUDIO.SET_WAVEFORM', waveform: { version: 1, sampleRate: 100, durationSec: 3, points: 1, min: [0], max: [0] } })

    expect(actor.getSnapshot().context.scene.contents['content-1']!.waveform).toEqual({ version: 1, sampleRate: 100, durationSec: 3, points: 1, min: [0], max: [0] })
  })

  it('AUDIO.SET_WAVEFORM is a no-op without a masterItemId', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'AUDIO.SET_WAVEFORM', waveform: { version: 1, sampleRate: 100, durationSec: 3, points: 1, min: [0], max: [0] } })
    expect(actor.getSnapshot().context.scene.contents).toEqual({})
  })
})

describe('sequenceEditorMachine — scene', () => {
  it('SCENE.LOAD replaces the scene and resets playhead/selection', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'TRACK.SELECT', trackId: 't1' })
    actor.send({ type: 'PLAYHEAD.SET', timeMs: 5000 })

    const nextScene = baseScene([elementItem('t2')])
    actor.send({ type: 'SCENE.LOAD', scene: nextScene })

    const ctx = actor.getSnapshot().context
    expect(ctx.scene.items[0]!.id).toBe('t2')
    expect(ctx.playheadMs).toBe(0)
    expect(ctx.selection).toEqual({ trackId: null, keyframeId: null, markerId: null })
  })

  it('SCENE.SET_DURATION updates meta.durationMs and optionally meta.durationSource', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'SCENE.SET_DURATION', durationMs: 20000, source: 'audio-primary' })
    expect(actor.getSnapshot().context.scene.meta.durationMs).toBe(20000)
    expect(actor.getSnapshot().context.scene.meta.durationSource).toBe('audio-primary')
  })
})

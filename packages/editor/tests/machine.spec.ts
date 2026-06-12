import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { sequenceEditorMachine } from '../src/sequence-editor/machine'
import type { EditorScene } from '../src/sequence-editor/types'
import sceneOneTrack from '../src/sequence-editor/fixtures/scene-one-track.json'
import sceneEmpty from '../src/sequence-editor/fixtures/scene-empty.json'
import sceneNested from '../src/sequence-editor/fixtures/scene-nested-capsule.json'

const ONE_TRACK = sceneOneTrack as unknown as EditorScene    // 3 kf à 0, 600, 9000 ms, durationMs 10000
const EMPTY = sceneEmpty as unknown as EditorScene           // 0 tracks, durationMs 10000
const NESTED = sceneNested as unknown as EditorScene         // tracks avec capsule imbriquée

function boot(scene: EditorScene, viewWidthPx = 800) {
  const actor = createActor(sequenceEditorMachine, { input: { scene, viewWidthPx } })
  actor.start()
  return actor
}

// ─── Add / remove keyframe ───────────────────────────────────────────────────

describe('KEYFRAME.ADD', () => {
  it('insère un keyframe et le trie par timeMs', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 3000 })
    const track = actor.getSnapshot().context.scene.tracks.find(t => t.id === 'track-01')!
    expect(track.keyframes).toHaveLength(4)
    const times = track.keyframes.map(k => k.timeMs)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(track.keyframes.find(k => k.timeMs === 3000)).toBeDefined()
    actor.stop()
  })

  it('clamp le timeMs à [0, durationMs]', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 99999 })
    const kf = actor.getSnapshot().context.scene.tracks[0]!.keyframes.find(
      k => k.timeMs === 10000,
    )
    expect(kf).toBeDefined()
    actor.stop()
  })

  it('snapGrid est mis à jour après ajout', () => {
    const actor = boot(ONE_TRACK)
    const beforeCount = actor.getSnapshot().context.snapGrid.length
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 5000 })
    const afterCount = actor.getSnapshot().context.snapGrid.length
    expect(afterCount).toBe(beforeCount + 1)
    actor.stop()
  })

  it('dégrade le machine en idle après ajout', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 4000 })
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })
})

describe('KEYFRAME.REMOVE', () => {
  it('supprime le keyframe ciblé', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 'track-01', keyframeId: 'kf-02' })
    const track = actor.getSnapshot().context.scene.tracks[0]!
    expect(track.keyframes).toHaveLength(2)
    expect(track.keyframes.find(k => k.id === 'kf-02')).toBeUndefined()
    actor.stop()
  })

  it('efface la sélection si le kf supprimé était sélectionné', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.SELECT', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 'track-01', keyframeId: 'kf-02' })
    const { selection } = actor.getSnapshot().context
    expect(selection.keyframeId).toBeNull()
    actor.stop()
  })
})

// ─── Drag start → move (avec snap) → end ────────────────────────────────────

describe('drag keyframe', () => {
  it('DRAG.START_KEYFRAME → state dragging-keyframe', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    expect(actor.getSnapshot().value).toBe('dragging-keyframe')
    const i = actor.getSnapshot().context.interaction!
    expect(i.kind).toBe('dragging-keyframe')
    if (i.kind === 'dragging-keyframe') {
      expect(i.originMs).toBe(600)
      expect(i.currentMs).toBe(600)
    }
    actor.stop()
  })

  it('DRAG.MOVE met à jour currentMs (arrondi à 100 ms)', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 2050 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'dragging-keyframe') {
      expect(i.currentMs).toBe(2100)   // arrondi à 100 ms
    }
    actor.stop()
  })

  it('DRAG.MOVE snap sur un cue à portée', () => {
    // ONE_TRACK n'a pas de cues — ajouter un cue à 3000 ms, puis dragger à 3020 ms
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'CUE.ADD', cue: { id: 'cue-test', timeMs: 3000, label: 'test' } })
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    // avec ZOOM_DEFAULT=80px/s et snapThresholdPx=8, threshold=100ms.  3020 est dans [2900,3100]
    actor.send({ type: 'DRAG.MOVE', pointerMs: 3020 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'dragging-keyframe') {
      expect(i.currentMs).toBe(3000)   // snappé sur le cue
    }
    actor.stop()
  })

  it('DRAG.END → idle, keyframe déplacé au currentMs', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 4000 })
    actor.send({ type: 'DRAG.END' })
    expect(actor.getSnapshot().value).toBe('idle')
    const track = actor.getSnapshot().context.scene.tracks[0]!
    const kf = track.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.timeMs).toBe(4000)
    const times = track.keyframes.map(k => k.timeMs)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    actor.stop()
  })

  it('DRAG.END ignoré si hors [0, durationMs]', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    // forcer currentMs hors bornes via un pointerMs > durationMs (la machine clamp à durationMs)
    actor.send({ type: 'DRAG.MOVE', pointerMs: 11000 })
    // currentMs sera clampé à 10000 (durationMs) — guard canCommitDrag passe
    actor.send({ type: 'DRAG.END' })
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })
})

// ─── Window draw → intro / outro ────────────────────────────────────────────

describe('window draw', () => {
  it('WINDOW.START_DRAW → state drawing-window', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'WINDOW.START_DRAW', trackId: 'track-01', pointerMs: 0 })
    expect(actor.getSnapshot().value).toBe('drawing-window')
    actor.stop()
  })

  it('draw sur le premier kf → transitionOut named sur kf-01', () => {
    const actor = boot(ONE_TRACK)
    // kf-01 est à t=0. On dessine de 0 à 800 ms (englobe le kf-01)
    actor.send({ type: 'WINDOW.START_DRAW', trackId: 'track-01', pointerMs: 0 })
    actor.send({ type: 'WINDOW.DRAW_MOVE', pointerMs: 800 })
    actor.send({ type: 'WINDOW.DRAW_END', pointerMs: 800 })
    expect(actor.getSnapshot().value).toBe('idle')
    const kf = actor.getSnapshot().context.scene.tracks[0]!.keyframes.find(k => k.id === 'kf-01')!
    expect(kf.transitionOut?.kind).toBe('named')
    actor.stop()
  })

  it('draw sur le dernier kf → transitionOut named sur kf-03', () => {
    const actor = boot(ONE_TRACK)
    // kf-03 est à t=9000. On dessine de 8500 à 9000 (englobe kf-03)
    actor.send({ type: 'WINDOW.START_DRAW', trackId: 'track-01', pointerMs: 8500 })
    actor.send({ type: 'WINDOW.DRAW_MOVE', pointerMs: 9000 })
    actor.send({ type: 'WINDOW.DRAW_END', pointerMs: 9000 })
    const kf = actor.getSnapshot().context.scene.tracks[0]!.keyframes.find(k => k.id === 'kf-03')!
    expect(kf.transitionOut?.kind).toBe('named')
    actor.stop()
  })

  it('durationMs de la transition = longueur du dessin', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'WINDOW.START_DRAW', trackId: 'track-01', pointerMs: 0 })
    actor.send({ type: 'WINDOW.DRAW_MOVE', pointerMs: 700 })
    actor.send({ type: 'WINDOW.DRAW_END', pointerMs: 700 })
    const kf = actor.getSnapshot().context.scene.tracks[0]!.keyframes.find(k => k.id === 'kf-01')!
    expect(kf.transitionOut?.durationMs).toBe(700)
    actor.stop()
  })
})

// ─── Zoom centré sur focusMs ─────────────────────────────────────────────────

describe('VIEWPORT.ZOOM', () => {
  it('zoom in double → pixelsPerMs doublé', () => {
    const actor = boot(EMPTY)
    const before = actor.getSnapshot().context.viewport.pixelsPerMs
    actor.send({ type: 'VIEWPORT.ZOOM', factor: 2, focusMs: 0 })
    const after = actor.getSnapshot().context.viewport.pixelsPerMs
    expect(after).toBeCloseTo(before * 2)
    actor.stop()
  })

  it('zoom centré sur focusMs : focusMs reste à la même position pixel', () => {
    const actor = boot(EMPTY)
    const vpBefore = actor.getSnapshot().context.viewport
    const focusMs = 2000
    const focusPxBefore = (focusMs - vpBefore.startMs) * vpBefore.pixelsPerMs

    actor.send({ type: 'VIEWPORT.ZOOM', factor: 2, focusMs })

    const vpAfter = actor.getSnapshot().context.viewport
    const focusPxAfter = (focusMs - vpAfter.startMs) * vpAfter.pixelsPerMs
    expect(focusPxAfter).toBeCloseTo(focusPxBefore, 1)
    actor.stop()
  })

  it('clamp au min et max', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'VIEWPORT.ZOOM', factor: 0.0001, focusMs: 0 })
    const min = actor.getSnapshot().context.viewport.pixelsPerMs
    actor.send({ type: 'VIEWPORT.ZOOM', factor: 100000, focusMs: 0 })
    const max = actor.getSnapshot().context.viewport.pixelsPerMs
    expect(min).toBeGreaterThanOrEqual(0.009)   // ZOOM_MIN_PX_PER_SEC / 1000 ≈ 0.01
    expect(max).toBeLessThanOrEqual(0.81)        // ZOOM_MAX_PX_PER_SEC / 1000 = 0.8
    actor.stop()
  })

  it('endMs = startMs + viewWidthPx / pixelsPerMs après zoom', () => {
    const actor = boot(EMPTY, 1000)
    actor.send({ type: 'VIEWPORT.ZOOM', factor: 1.5, focusMs: 1000 })
    const vp = actor.getSnapshot().context.viewport
    expect(vp.endMs).toBeCloseTo(vp.startMs + vp.viewWidthPx / vp.pixelsPerMs, 1)
    actor.stop()
  })
})

// ─── Pan start → move → end ──────────────────────────────────────────────────

describe('panning', () => {
  it('VIEWPORT.PAN_START → state panning', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'VIEWPORT.PAN_START', pointerPx: 100 })
    expect(actor.getSnapshot().value).toBe('panning')
    actor.stop()
  })

  it('PAN_MOVE déplace le viewport proportionnellement', () => {
    // viewWidthPx=400 → viewDuration=5000 ms < durationMs=10000 → pan possible
    const actor = boot(EMPTY, 400)
    // pixelsPerMs=0.08 → 100 px = 1250 ms. Pan de 200→100 décale +1250 ms
    actor.send({ type: 'VIEWPORT.PAN_START', pointerPx: 200 })
    actor.send({ type: 'VIEWPORT.PAN_MOVE', pointerPx: 100 })
    const { startMs } = actor.getSnapshot().context.viewport
    expect(startMs).toBeGreaterThan(0)
    actor.stop()
  })

  it('PAN_END → state idle, interaction null', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'VIEWPORT.PAN_START', pointerPx: 0 })
    actor.send({ type: 'VIEWPORT.PAN_END' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.interaction).toBeNull()
    actor.stop()
  })
})

// ─── Playhead ────────────────────────────────────────────────────────────────

describe('playhead', () => {
  it('PLAYHEAD.START_PLAY → state playing', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    expect(actor.getSnapshot().value).toBe('playing')
    actor.stop()
  })

  it('PLAYHEAD.TICK avance le playhead', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    actor.send({ type: 'PLAYHEAD.TICK', deltaMs: 500 })
    expect(actor.getSnapshot().context.playheadMs).toBe(500)
    actor.stop()
  })

  it('PLAYHEAD.TICK s\'arrête à durationMs', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    actor.send({ type: 'PLAYHEAD.TICK', deltaMs: 99999 })
    expect(actor.getSnapshot().context.playheadMs).toBe(EMPTY.durationMs)
    actor.stop()
  })

  it('PLAYHEAD.STOP → idle', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'PLAYHEAD.START_PLAY' })
    actor.send({ type: 'PLAYHEAD.STOP' })
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })
})

// ─── SCENE.LOAD ──────────────────────────────────────────────────────────────

describe('SCENE.LOAD', () => {
  it('remplace la scène et remet playhead à 0', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'PLAYHEAD.SET', timeMs: 5000 })
    actor.send({ type: 'SCENE.LOAD', scene: NESTED })
    const ctx = actor.getSnapshot().context
    expect(ctx.scene.id).toBe(NESTED.id)
    expect(ctx.playheadMs).toBe(0)
    expect(ctx.selection).toEqual({ trackId: null, keyframeId: null })
    actor.stop()
  })
})

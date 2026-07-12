import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { sequenceEditorMachine } from '../src/sequence-editor/machine'
import type { EditorScene } from '../src/sequence-editor/types'
import sceneOneTrack from '../src/sequence-editor/fixtures/scene-one-track.json'
import sceneEmpty from '../src/sequence-editor/fixtures/scene-empty.json'
import sceneNested from '../src/sequence-editor/fixtures/scene-nested-capsule.json'

const ONE_TRACK = sceneOneTrack as unknown as EditorScene    // 3 kf à 0, 600, 9000 ms, durationMs 10000
const EMPTY = sceneEmpty as unknown as EditorScene           // 0 items, durationMs 10000
const NESTED = sceneNested as unknown as EditorScene         // items avec capsule imbriquée (parentId)

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
    const item = actor.getSnapshot().context.scene.items.find(i => i.id === 'track-01')!
    expect(item.keyframes).toHaveLength(4)
    const times = item.keyframes.map(k => k.timeMs)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(item.keyframes.find(k => k.timeMs === 3000)).toBeDefined()
    actor.stop()
  })

  it('clamp le timeMs à [0, durationMs]', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 99999 })
    const kf = actor.getSnapshot().context.scene.items[0]!.keyframes.find(
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
    const item = actor.getSnapshot().context.scene.items[0]!
    expect(item.keyframes).toHaveLength(2)
    expect(item.keyframes.find(k => k.id === 'kf-02')).toBeUndefined()
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

  it('DRAG.MOVE snap sur un marqueur à portée', () => {
    // ONE_TRACK n'a pas de piste de marqueurs — en ajouter une, puis dragger à portée d'un marqueur.
    // Remplace l'ancien `CUE.ADD` (supprimé — les cues vivent désormais dans `Content`, par item
    // média ; un point d'aimantation autoportant sur la scène est un marqueur, `markerTracks`).
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'MARKER_TRACK.ADD', track: { id: 'mt-test', label: 'test', visible: true, markers: [] } })
    actor.send({ type: 'MARKER.ADD', markerTrackId: 'mt-test', marker: { id: 'marker-test', timeMs: 3000, label: 'test' } })
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    // avec ZOOM_DEFAULT=80px/s et snapThresholdPx=8, threshold=100ms.  3020 est dans [2900,3100]
    actor.send({ type: 'DRAG.MOVE', pointerMs: 3020 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'dragging-keyframe') {
      expect(i.currentMs).toBe(3000)   // snappé sur le marqueur
    }
    actor.stop()
  })

  it('DRAG.END → idle, keyframe déplacé au currentMs', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 4000 })
    actor.send({ type: 'DRAG.END' })
    expect(actor.getSnapshot().value).toBe('idle')
    const item = actor.getSnapshot().context.scene.items[0]!
    const kf = item.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.timeMs).toBe(4000)
    const times = item.keyframes.map(k => k.timeMs)
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

// ─── Clip draw → intro / outro ───────────────────────────────────────────────

describe('clip draw', () => {
  it('CLIP.START_DRAW → state drawing-clip', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 0, introId: 'i1', outroId: 'o1' })
    expect(actor.getSnapshot().value).toBe('drawing-clip')
    actor.stop()
  })

  it('CLIP.DRAW_MOVE met à jour currentMs', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 0, introId: 'i1', outroId: 'o1' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 2000 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'drawing-clip') expect(i.currentMs).toBe(2000)
    actor.stop()
  })

  it('CLIP.DRAW_END → idle, crée intro et outro avec les bons ids et timeMs', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 1000, introId: 'new-intro', outroId: 'new-outro' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 3000 })
    actor.send({ type: 'CLIP.DRAW_END' })
    expect(actor.getSnapshot().value).toBe('idle')
    const kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    const intro = kfs.find(k => k.id === 'new-intro')
    const outro = kfs.find(k => k.id === 'new-outro')
    expect(intro?.timeMs).toBe(1000)
    expect(outro?.timeMs).toBe(3000)
    expect(intro?.name).toBe('intro')
    expect(outro?.name).toBe('outro')
    actor.stop()
  })

  it('CLIP.DRAW_END normalise les bornes (start > end)', () => {
    const actor = boot(ONE_TRACK)
    // Dessin en sens inverse : start=4000 → move=2000
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 4000, introId: 'rev-i', outroId: 'rev-o' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 2000 })
    actor.send({ type: 'CLIP.DRAW_END' })
    const kfs = actor.getSnapshot().context.scene.items[0]!.keyframes
    const intro = kfs.find(k => k.id === 'rev-i')
    const outro = kfs.find(k => k.id === 'rev-o')
    expect(intro?.timeMs).toBe(2000)   // min
    expect(outro?.timeMs).toBe(4000)   // max
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
    expect(actor.getSnapshot().context.playheadMs).toBe(EMPTY.meta.durationMs)
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
    expect(ctx.selection).toEqual({ trackId: null, keyframeId: null, markerId: null })
    actor.stop()
  })
})

// ─── Nested capsule (parentId-derived tree, ex-`children`) ───────────────────

describe('scène imbriquée (scene-nested-capsule)', () => {
  it('les enfants de la capsule sont retrouvés par parentId (pas de champ children)', () => {
    const actor = boot(NESTED)
    const capsule = actor.getSnapshot().context.scene.items.find(i => i.id === 'track-capsule-01')!
    const children = actor.getSnapshot().context.scene.items.filter(i => i.parentId === capsule.id)
    expect(children.map(c => c.id).sort()).toEqual(['track-item-01', 'track-item-02'])
    actor.stop()
  })

  it('TRACK.REMOVE sur la capsule retire aussi ses descendants', () => {
    const actor = boot(NESTED)
    actor.send({ type: 'TRACK.REMOVE', trackId: 'track-capsule-01' })
    const ids = actor.getSnapshot().context.scene.items.map(i => i.id)
    expect(ids).not.toContain('track-capsule-01')
    expect(ids).not.toContain('track-item-01')
    expect(ids).not.toContain('track-item-02')
    // les items non descendants (fond, CTA) survivent
    expect(ids).toContain('track-bg')
    expect(ids).toContain('track-cta')
    actor.stop()
  })
})

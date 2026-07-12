import { describe, it, expect, vi } from 'vitest'
import { SequenceEditorController } from '../src/sequence-editor/controller'
import type { EditorScene } from '../src/sequence-editor/types'
import sceneOneTrack from '../src/sequence-editor/fixtures/scene-one-track.json'
import sceneEmpty from '../src/sequence-editor/fixtures/scene-empty.json'
import sceneNested from '../src/sequence-editor/fixtures/scene-nested-capsule.json'
import sceneEddy from '../src/sequence-editor/fixtures/scene-eddy-ref.json'

const ONE_TRACK = sceneOneTrack as unknown as EditorScene
const EMPTY     = sceneEmpty    as unknown as EditorScene
const NESTED    = sceneNested   as unknown as EditorScene
const EDDY      = sceneEddy     as unknown as EditorScene

// ─── Cycle de vie ────────────────────────────────────────────────────────────

describe('cycle de vie', () => {
  it('s\'instancie sans scène (scène vide générée)', () => {
    const ctrl = new SequenceEditorController()
    expect(ctrl.getScene().items).toHaveLength(0)
    ctrl.destroy()
  })

  it('s\'instancie avec une scène', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    expect(ctrl.getScene().id).toBe('scene-one-track')
    ctrl.destroy()
  })

  it('subscribe reçoit un snapshot immédiatement', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const cb = vi.fn()
    const unsub = ctrl.subscribe(cb)
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0]![0].value).toBe('idle')
    unsub()
    ctrl.destroy()
  })

  it('subscribe retourne une fonction de désabonnement', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const cb = vi.fn()
    const unsub = ctrl.subscribe(cb)
    unsub()
    ctrl.play()
    // cb ne doit pas avoir été rappelé après unsub
    expect(cb).toHaveBeenCalledOnce()
    ctrl.destroy()
  })
})

// ─── Sérialisation / roundtrip ───────────────────────────────────────────────

describe('serialize / deserialize', () => {
  it('roundtrip exact : scene-one-track', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    expect(ctrl.serialize()).toEqual(ONE_TRACK)
    ctrl.destroy()
  })

  it('roundtrip exact : scene-nested-capsule', () => {
    const ctrl = new SequenceEditorController(NESTED)
    expect(ctrl.serialize()).toEqual(NESTED)
    ctrl.destroy()
  })

  it('roundtrip exact : scene-eddy-ref', () => {
    const ctrl = new SequenceEditorController(EDDY)
    expect(ctrl.serialize()).toEqual(EDDY)
    ctrl.destroy()
  })

  it('serialize retourne un clone (pas la référence interne)', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const s1 = ctrl.serialize()
    const s2 = ctrl.serialize()
    expect(s1).not.toBe(s2)
    expect(s1).toEqual(s2)
    ctrl.destroy()
  })

  it('deserialize remplace la scène courante', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.deserialize(EDDY)
    expect(ctrl.getScene().id).toBe('scene-eddy-ref')
    ctrl.destroy()
  })

  it('deserialize puis serialize → roundtrip exact', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.deserialize(ONE_TRACK)
    expect(ctrl.serialize()).toEqual(ONE_TRACK)
    ctrl.destroy()
  })
})

// ─── Keyframes ───────────────────────────────────────────────────────────────

describe('addKeyframe', () => {
  it('retourne un id string', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const id = ctrl.addKeyframe('track-01', 5000)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    ctrl.destroy()
  })

  it('le kf avec cet id est bien dans la scène', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const id = ctrl.addKeyframe('track-01', 5000)
    const kf = ctrl.getScene().items[0]!.keyframes.find(k => k.id === id)
    expect(kf).toBeDefined()
    expect(kf!.timeMs).toBe(5000)
    ctrl.destroy()
  })

  it('deux appels successifs génèrent deux ids distincts', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const id1 = ctrl.addKeyframe('track-01', 4000)
    const id2 = ctrl.addKeyframe('track-01', 5000)
    expect(id1).not.toBe(id2)
    ctrl.destroy()
  })
})

describe('removeKeyframe', () => {
  it('supprime le kf ciblé', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.removeKeyframe('track-01', 'kf-02')
    expect(ctrl.getScene().items[0]!.keyframes.find(k => k.id === 'kf-02')).toBeUndefined()
    ctrl.destroy()
  })

  it('retire le décor orphelin du registre', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    // kf-01 référence decor-01, partagé avec personne d'autre
    ctrl.removeKeyframe('track-01', 'kf-01')
    expect(ctrl.getScene().decors['decor-01']).toBeUndefined()
    ctrl.destroy()
  })

  it('conserve le décor s\'il est encore utilisé', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    // kf-02 et kf-03 partagent decor-02 — supprimer kf-02 ne doit pas retirer decor-02
    ctrl.removeKeyframe('track-01', 'kf-02')
    expect(ctrl.getScene().decors['decor-02']).toBeDefined()
    ctrl.destroy()
  })
})

describe('moveKeyframe', () => {
  it('déplace kf-02 à 4000 ms', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.moveKeyframe('track-01', 'kf-02', 4000)
    const kf = ctrl.getScene().items[0]!.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.timeMs).toBe(4000)
    ctrl.destroy()
  })

  it('retourne à idle après le déplacement', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.moveKeyframe('track-01', 'kf-02', 4000)
    expect(ctrl.getSnapshot().value).toBe('idle')
    ctrl.destroy()
  })
})

// ─── Tracks (items) ─────────────────────────────────────────────────────────

describe('addTrack / removeTrack / moveTrack', () => {
  it('addTrack retourne un id et crée l\'item', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const id = ctrl.addTrack({ type: 'text', label: 'Nouveau', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'd0' })
    const item = ctrl.getScene().items.find(i => i.id === id)
    expect(item).toBeDefined()
    expect(item!.keyframes).toHaveLength(0)
    ctrl.destroy()
  })

  it('removeTrack supprime l\'item', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.removeTrack('track-01')
    expect(ctrl.getScene().items.find(i => i.id === 'track-01')).toBeUndefined()
    ctrl.destroy()
  })

  it('toggleVisibility inverse visible', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const before = ctrl.getScene().items[0]!.visible
    ctrl.toggleVisibility('track-01')
    expect(ctrl.getScene().items[0]!.visible).toBe(!before)
    ctrl.destroy()
  })

  it('moveTrack change le parentId (et l\'order si fourni) — remplace l\'ancien afterId/parentId relatif à un tableau children', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.moveTrack('track-cta', 'track-capsule-01', 'z')
    const moved = ctrl.getScene().items.find(i => i.id === 'track-cta')!
    expect(moved.parentId).toBe('track-capsule-01')
    expect(moved.order).toBe('z')
    ctrl.destroy()
  })
})

// ─── Markers ─────────────────────────────────────────────────────────────────

function findMarker(scene: EditorScene, markerId: string) {
  for (const t of Object.values(scene.markerTracks)) {
    const m = t.markers.find(m => m.id === markerId)
    if (m) return m
  }
  return undefined
}

describe('addMarkerTrack / removeMarkerTrack / renameMarkerTrack / toggleMarkerTrackVisibility', () => {
  it('addMarkerTrack crée une piste vide visible', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const id = ctrl.addMarkerTrack('Visèmes')
    const t = ctrl.getScene().markerTracks[id]
    expect(t).toMatchObject({ label: 'Visèmes', visible: true, markers: [] })
    ctrl.destroy()
  })

  it('renameMarkerTrack renomme la piste', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.renameMarkerTrack('mtrack-01', 'Gestes')
    expect(ctrl.getScene().markerTracks['mtrack-01']?.label).toBe('Gestes')
    ctrl.destroy()
  })

  it('toggleMarkerTrackVisibility bascule visible', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.toggleMarkerTrackVisibility('mtrack-01')
    expect(ctrl.getScene().markerTracks['mtrack-01']?.visible).toBe(false)
    ctrl.destroy()
  })

  it('removeMarkerTrack retire la piste et détache les kf accrochés à ses marqueurs', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const tid = ctrl.addMarkerTrack('Gestes')
    const mid = ctrl.addMarker(tid, 600, 'mid')
    ctrl.attachMarker('track-01', 'kf-02', mid)
    ctrl.removeMarkerTrack(tid)
    expect(ctrl.getScene().markerTracks[tid]).toBeUndefined()
    const kf = ctrl.getScene().items[0]!.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.markerId).toBeUndefined()
    expect(kf?.timeMs).toBe(600)
    ctrl.destroy()
  })
})

describe('addMarker / moveMarker / removeMarker', () => {
  it('addMarker crée un marker dans la piste donnée', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const tid = ctrl.addMarkerTrack('Repères')
    const id = ctrl.addMarker(tid, 5000, 'Repère')
    const m = findMarker(ctrl.getScene(), id)
    expect(m?.timeMs).toBe(5000)
    ctrl.destroy()
  })

  it('moveMarker déplace le marker', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.moveMarker('marker-01', 4000)
    expect(findMarker(ctrl.getScene(), 'marker-01')?.timeMs).toBe(4000)
    ctrl.destroy()
  })

  it('moveMarker propage aux kf accrochés', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const tid = ctrl.addMarkerTrack('Repères')
    const mid = ctrl.addMarker(tid, 600, 'mid')
    ctrl.attachMarker('track-01', 'kf-02', mid)
    ctrl.moveMarker(mid, 800)
    const kf = ctrl.getScene().items[0]!.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.timeMs).toBe(800)
    ctrl.destroy()
  })

  it('removeMarker détache les kf (timeMs conservé, markerId retiré)', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const tid = ctrl.addMarkerTrack('Repères')
    const mid = ctrl.addMarker(tid, 600, 'mid')
    ctrl.attachMarker('track-01', 'kf-02', mid)
    ctrl.removeMarker(mid)
    const kf = ctrl.getScene().items[0]!.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.markerId).toBeUndefined()
    expect(kf?.timeMs).toBe(600)
    ctrl.destroy()
  })
})

describe('selectMarker', () => {
  it('sélectionne un marker et efface la sélection track/keyframe', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.selectKeyframe('track-01', 'kf-02')
    ctrl.selectMarker('marker-01')
    const { selection } = ctrl.getSnapshot().context
    expect(selection).toEqual({ trackId: null, keyframeId: null, markerId: 'marker-01' })
    ctrl.destroy()
  })

  it('selectKeyframe efface la sélection de marker', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.selectMarker('marker-01')
    ctrl.selectKeyframe('track-01', 'kf-02')
    expect(ctrl.getSnapshot().context.selection.markerId).toBeNull()
    ctrl.destroy()
  })

  it('removeMarker efface la sélection si le marker supprimé était sélectionné', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.selectMarker('marker-01')
    ctrl.removeMarker('marker-01')
    expect(ctrl.getSnapshot().context.selection.markerId).toBeNull()
    ctrl.destroy()
  })

  it('removeMarkerTrack efface la sélection si le marker sélectionné appartenait à la piste', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.selectMarker('marker-01')
    ctrl.removeMarkerTrack('mtrack-01')
    expect(ctrl.getSnapshot().context.selection.markerId).toBeNull()
    ctrl.destroy()
  })
})

// ─── Audio (item média + masterItemId, remplace l'ancien scene.audio) ────────

describe('audio', () => {
  it('setMasterWaveform écrit sur le Content de l\'item désigné par masterItemId', () => {
    const scene: EditorScene = {
      ...EMPTY,
      items: [{ id: 'media-1', type: 'media', parentId: null, order: 'a', visible: true, contentId: 'content-1', initialDecorId: 'd0', keyframes: [] }],
      contents: { 'content-1': { id: 'content-1', type: 'media', source: '/vo.mp3' } },
      masterItemId: 'media-1',
    }
    const ctrl = new SequenceEditorController(scene)
    const wf = { version: 1 as const, sampleRate: 44100, durationSec: 8, points: 4, min: [-1, -1, -1, -1], max: [1, 1, 1, 1] }
    ctrl.setMasterWaveform(wf)
    expect(ctrl.getScene().contents['content-1']!.waveform?.points).toBe(4)
    ctrl.destroy()
  })

  it('setMasterWaveform est un no-op sans masterItemId', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const wf = { version: 1 as const, sampleRate: 44100, durationSec: 8, points: 4, min: [-1, -1, -1, -1], max: [1, 1, 1, 1] }
    ctrl.setMasterWaveform(wf)
    expect(ctrl.getScene().contents).toEqual({})
    ctrl.destroy()
  })
})

// ─── Coordinate utilities ────────────────────────────────────────────────────

describe('msToPixel / pixelToMs / snapToGrid', () => {
  it('msToPixel(startMs) = 0', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const startMs = ctrl.getViewport().startMs
    expect(ctrl.msToPixel(startMs)).toBeCloseTo(0)
    ctrl.destroy()
  })

  it('pixelToMs(0) = startMs', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    expect(ctrl.pixelToMs(0)).toBeCloseTo(ctrl.getViewport().startMs)
    ctrl.destroy()
  })

  it('roundtrip msToPixel ↔ pixelToMs', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const t = 3500
    expect(ctrl.pixelToMs(ctrl.msToPixel(t))).toBeCloseTo(t)
    ctrl.destroy()
  })

  it('snapToGrid snap sur un marqueur proche (scene-eddy-ref : marqueur à 1000 ms, ex-cue)', () => {
    const ctrl = new SequenceEditorController(EDDY)
    // marker à 1000 ms. pixelsPerMs=0.08, snapThreshold=8px → thresholdMs=100
    // 1050 est dans [900,1100] → snappé à 1000
    expect(ctrl.snapToGrid(1050)).toBe(1000)
    ctrl.destroy()
  })

  it('snapToGrid arrondi à 100 ms si hors seuil', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    // Pas de marqueurs/keyframes : arrondi à 100 ms
    expect(ctrl.snapToGrid(3450)).toBe(3500)
    ctrl.destroy()
  })
})

// ─── Viewport ────────────────────────────────────────────────────────────────

describe('zoom / pan / notifyResize', () => {
  it('zoom(2) double pixelsPerMs', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const before = ctrl.getViewport().pixelsPerMs
    ctrl.zoom(2)
    expect(ctrl.getViewport().pixelsPerMs).toBeCloseTo(before * 2)
    ctrl.destroy()
  })

  it('pan avance dans le temps', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.notifyResize(400, 600)   // viewWidthPx=400 → viewDuration=5000ms < 10000
    const before = ctrl.getViewport().startMs
    ctrl.pan(100)   // 100px = 1250 ms forward
    expect(ctrl.getViewport().startMs).toBeGreaterThan(before)
    ctrl.destroy()
  })

  it('notifyResize met à jour viewWidthPx et endMs', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.notifyResize(1200, 800)
    const vp = ctrl.getViewport()
    expect(vp.viewWidthPx).toBe(1200)
    expect(vp.endMs).toBeCloseTo(vp.startMs + 1200 / vp.pixelsPerMs, 1)
    ctrl.destroy()
  })
})

// ─── Playhead ────────────────────────────────────────────────────────────────

describe('play / stop / seek', () => {
  it('play → snapshot value = playing', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.play()
    expect(ctrl.getSnapshot().value).toBe('playing')
    ctrl.destroy()
  })

  it('stop → snapshot value = idle', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.play()
    ctrl.stop()
    expect(ctrl.getSnapshot().value).toBe('idle')
    ctrl.destroy()
  })

  it('seek met à jour playheadMs', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.seek(4000)
    expect(ctrl.getPlayheadMs()).toBe(4000)
    ctrl.destroy()
  })
})

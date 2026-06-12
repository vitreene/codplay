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
    expect(ctrl.getScene().tracks).toHaveLength(0)
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
    const kf = ctrl.getScene().tracks[0]!.keyframes.find(k => k.id === id)
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
    expect(ctrl.getScene().tracks[0]!.keyframes.find(k => k.id === 'kf-02')).toBeUndefined()
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
    const kf = ctrl.getScene().tracks[0]!.keyframes.find(k => k.id === 'kf-02')
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

// ─── Tracks ──────────────────────────────────────────────────────────────────

describe('addTrack / removeTrack', () => {
  it('addTrack retourne un id et crée le track', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const id = ctrl.addTrack({ kind: 'element', label: 'Nouveau', visible: true })
    const track = ctrl.getScene().tracks.find(t => t.id === id)
    expect(track).toBeDefined()
    expect(track!.keyframes).toHaveLength(0)
    ctrl.destroy()
  })

  it('removeTrack supprime le track', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.removeTrack('track-01')
    expect(ctrl.getScene().tracks.find(t => t.id === 'track-01')).toBeUndefined()
    ctrl.destroy()
  })

  it('toggleVisibility inverse visible', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const before = ctrl.getScene().tracks[0]!.visible
    ctrl.toggleVisibility('track-01')
    expect(ctrl.getScene().tracks[0]!.visible).toBe(!before)
    ctrl.destroy()
  })
})

// ─── Cues / Markers ──────────────────────────────────────────────────────────

describe('addCue / removeCue', () => {
  it('addCue retourne un id et ajoute le cue', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const id = ctrl.addCue({ timeMs: 2000, label: 'Test' })
    const cue = ctrl.getScene().cues.find(c => c.id === id)
    expect(cue?.timeMs).toBe(2000)
    ctrl.destroy()
  })

  it('removeCue retire le cue', () => {
    const ctrl = new SequenceEditorController(EDDY)
    ctrl.removeCue('cue-1000')
    expect(ctrl.getScene().cues.find(c => c.id === 'cue-1000')).toBeUndefined()
    ctrl.destroy()
  })
})

describe('addMarker / moveMarker / removeMarker', () => {
  it('addMarker crée un marker', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const id = ctrl.addMarker(5000, 'Repère')
    const m = ctrl.getScene().markers.find(m => m.id === id)
    expect(m?.timeMs).toBe(5000)
    ctrl.destroy()
  })

  it('moveMarker déplace le marker', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.moveMarker('marker-01', 4000)
    expect(ctrl.getScene().markers.find(m => m.id === 'marker-01')?.timeMs).toBe(4000)
    ctrl.destroy()
  })

  it('moveMarker propage aux kf accrochés', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const mid = ctrl.addMarker(600, 'mid')
    ctrl.attachMarker('track-01', 'kf-02', mid)
    ctrl.moveMarker(mid, 800)
    const kf = ctrl.getScene().tracks[0]!.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.timeMs).toBe(800)
    ctrl.destroy()
  })

  it('removeMarker détache les kf (timeMs conservé, markerId retiré)', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const mid = ctrl.addMarker(600, 'mid')
    ctrl.attachMarker('track-01', 'kf-02', mid)
    ctrl.removeMarker(mid)
    const kf = ctrl.getScene().tracks[0]!.keyframes.find(k => k.id === 'kf-02')
    expect(kf?.markerId).toBeUndefined()
    expect(kf?.timeMs).toBe(600)
    ctrl.destroy()
  })
})

// ─── Décor registry ──────────────────────────────────────────────────────────

describe('registerDecor / getDecorData', () => {
  it('registerDecor puis getDecorData retourne les data', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.registerDecor('d-01', { color: 'red', opacity: 0.5 })
    expect(ctrl.getDecorData('d-01')).toEqual({ color: 'red', opacity: 0.5 })
    ctrl.destroy()
  })

  it('getDecorData sur id inexistant retourne null', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    expect(ctrl.getDecorData('nope')).toBeNull()
    ctrl.destroy()
  })
})

// ─── Audio ───────────────────────────────────────────────────────────────────

describe('audio', () => {
  it('setAudio / clearAudio', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.setAudio({ id: 'a1', label: 'VO', srcUrl: '/vo.mp3', durationMs: 8000 })
    expect(ctrl.getScene().audio?.id).toBe('a1')
    ctrl.clearAudio()
    expect(ctrl.getScene().audio).toBeUndefined()
    ctrl.destroy()
  })

  it('setAudioWaveform injecte la waveform', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.setAudio({ id: 'a1', label: 'VO', srcUrl: '/vo.mp3', durationMs: 8000 })
    const wf = { version: 1 as const, sampleRate: 44100, durationSec: 8, points: 4, min: [-1,-1,-1,-1], max: [1,1,1,1] }
    ctrl.setAudioWaveform(wf)
    expect(ctrl.getScene().audio?.waveform?.points).toBe(4)
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

  it('snapToGrid snap sur un cue proche', () => {
    const ctrl = new SequenceEditorController(EDDY)
    // cue-1000 à 1000 ms. pixelsPerMs=0.08, snapThreshold=8px → thresholdMs=100
    // 1050 est dans [900,1100] → snappé à 1000
    expect(ctrl.snapToGrid(1050)).toBe(1000)
    ctrl.destroy()
  })

  it('snapToGrid arrondi à 100 ms si hors seuil', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    // Pas de cues : arrondi à 100 ms
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

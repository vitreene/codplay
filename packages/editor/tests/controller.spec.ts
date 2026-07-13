// `SequenceEditorController` n'auto-applique plus les mutations de document (§"unicité de la
// source" — `2026-07-13-controller-islands-bridge-plan.md` §3bis) : la plupart des méthodes
// émettent une commande via `onCommand` plutôt que de la refléter dans `getScene()`. Les EFFETS de
// chaque commande (ce qu'elle fait réellement à une scène) sont déjà testés dans
// `tests/sequence-editor/commands.spec.ts` — ce fichier vérifie que la bonne commande, avec les
// bons arguments, est émise pour chaque méthode publique, plus tout ce qui reste purement local
// (viewport, playhead, geste, markerId).

import { describe, it, expect, vi } from 'vitest'
import { SequenceEditorController } from '../src/sequence-editor/controller'
import type { EditorScene } from '../src/sequence-editor/types'
import type { Command } from '../src/app/controller/types'
import sceneOneTrack from '../src/sequence-editor/fixtures/scene-one-track.json'
import sceneEmpty from '../src/sequence-editor/fixtures/scene-empty.json'
import sceneNested from '../src/sequence-editor/fixtures/scene-nested-capsule.json'
import sceneEddy from '../src/sequence-editor/fixtures/scene-eddy-ref.json'

const ONE_TRACK = sceneOneTrack as unknown as EditorScene
const EMPTY     = sceneEmpty    as unknown as EditorScene
const NESTED    = sceneNested   as unknown as EditorScene
const EDDY      = sceneEddy     as unknown as EditorScene

function collectCommands(ctrl: SequenceEditorController): Command[][] {
  const batches: Command[][] = []
  ctrl.onCommand((commands) => batches.push(commands))
  return batches
}

function collectSelectionRequests(ctrl: SequenceEditorController): { itemIds: string[]; keyframeId?: string }[] {
  const requests: { itemIds: string[]; keyframeId?: string }[] = []
  ctrl.onSelectionRequest((itemIds, keyframeId) => requests.push({ itemIds, keyframeId }))
  return requests
}

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
    expect(cb).toHaveBeenCalledOnce()
    ctrl.destroy()
  })
})

// ─── Sérialisation / roundtrip — deserialize() reste réservé au chargement d'un document ──────

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

  it('deserialize remplace la scène courante ET remet playhead/sélection à zéro (chargement d\'un document différent)', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.seek(5000)
    ctrl.deserialize(EDDY)
    expect(ctrl.getScene().id).toBe('scene-eddy-ref')
    expect(ctrl.getPlayheadMs()).toBe(0)
    ctrl.destroy()
  })

  it('deserialize puis serialize → roundtrip exact', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    ctrl.deserialize(ONE_TRACK)
    expect(ctrl.serialize()).toEqual(ONE_TRACK)
    ctrl.destroy()
  })
})

// ─── syncFromCenter — le point d'entrée de resynchronisation post-commit (jamais deserialize) ──

describe('syncFromCenter', () => {
  it('remplace scene + sélection SANS toucher playhead/interaction (contraste avec deserialize)', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.seek(5000)
    ctrl.syncFromCenter(NESTED, { itemIds: ['track-capsule-01'], keyframeId: 'kf-cap-01' })

    expect(ctrl.getScene().id).toBe(NESTED.id)
    expect(ctrl.getPlayheadMs()).toBe(5000) // préservé — c'est tout l'objet de syncFromCenter
    expect(ctrl.getSnapshot().context.selection).toEqual({ trackId: 'track-capsule-01', keyframeId: 'kf-cap-01', markerId: null })
    ctrl.destroy()
  })
})

// ─── Keyframes — émettent, n'appliquent plus rien localement ──────────────────

describe('addKeyframe / removeKeyframe / moveKeyframe émettent la commande correspondante', () => {
  it('addKeyframe émet createNamedKeyframe et retourne l\'id choisi — réutilise le décor adjacent (kf-02 à 600ms, decor-02, le plus proche avant 5000ms)', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const batches = collectCommands(ctrl)
    const id = ctrl.addKeyframe('track-01', 5000)
    expect(typeof id).toBe('string')
    expect(batches).toEqual([[{ name: 'createNamedKeyframe', args: { itemId: 'track-01', keyframeId: id, timeMs: 5000, decorId: 'decor-02' } }]])
    // scene locale (cache lecture seule) inchangée sans écho
    expect(ctrl.getScene().items[0]!.keyframes.find(k => k.id === id)).toBeUndefined()
    ctrl.destroy()
  })

  it('deux appels successifs génèrent deux ids distincts', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const id1 = ctrl.addKeyframe('track-01', 4000)
    const id2 = ctrl.addKeyframe('track-01', 5000)
    expect(id1).not.toBe(id2)
    ctrl.destroy()
  })

  it('removeKeyframe émet deleteKeyframe', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const batches = collectCommands(ctrl)
    ctrl.removeKeyframe('track-01', 'kf-02')
    expect(batches).toEqual([[{ name: 'deleteKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-02' } }]])
    ctrl.destroy()
  })

  it('moveKeyframe (drag start→move→end programmatique) émet moveKeyframe au timeMs snappé', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const batches = collectCommands(ctrl)
    ctrl.moveKeyframe('track-01', 'kf-02', 4000)
    expect(ctrl.getSnapshot().value).toBe('idle')
    expect(batches).toEqual([[{ name: 'moveKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-02', timeMs: 4000 } }]])
    ctrl.destroy()
  })
})

// ─── Tracks (items) — pas de addTrack (retiré, §controller.ts) ; le reste émet ────────────────

describe('removeTrack / toggleVisibility / moveTrack émettent leur commande (structure : commandes CENTRALES réutilisées)', () => {
  it('removeTrack émet le deleteItem central', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const batches = collectCommands(ctrl)
    ctrl.removeTrack('track-01')
    expect(batches).toEqual([[{ name: 'deleteItem', args: { itemId: 'track-01' } }]])
    ctrl.destroy()
  })

  it('toggleVisibility émet toggleItemVisibility', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const batches = collectCommands(ctrl)
    ctrl.toggleVisibility('track-01')
    expect(batches).toEqual([[{ name: 'toggleItemVisibility', args: { itemId: 'track-01' } }]])
    ctrl.destroy()
  })

  it('moveTrack émet le attachItem central avec parentId/order', () => {
    const ctrl = new SequenceEditorController(NESTED)
    const batches = collectCommands(ctrl)
    ctrl.moveTrack('track-cta', 'track-capsule-01', 'z')
    expect(batches).toEqual([[{ name: 'attachItem', args: { itemId: 'track-cta', parentId: 'track-capsule-01', order: 'z' } }]])
    ctrl.destroy()
  })
})

// ─── Markers — chaque méthode émet sa commande ─────────────────────────────────

describe('addMarkerTrack / removeMarkerTrack / renameMarkerTrack / toggleMarkerTrackVisibility', () => {
  it('addMarkerTrack retourne un id et émet addMarkerTrack', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const batches = collectCommands(ctrl)
    const id = ctrl.addMarkerTrack('Visèmes')
    expect(typeof id).toBe('string')
    expect(batches).toEqual([[{ name: 'addMarkerTrack', args: { markerTrackId: id, label: 'Visèmes', color: undefined } }]])
    ctrl.destroy()
  })

  it('renameMarkerTrack émet renameMarkerTrack', () => {
    const ctrl = new SequenceEditorController(NESTED)
    const batches = collectCommands(ctrl)
    ctrl.renameMarkerTrack('mtrack-01', 'Gestes')
    expect(batches).toEqual([[{ name: 'renameMarkerTrack', args: { markerTrackId: 'mtrack-01', label: 'Gestes' } }]])
    ctrl.destroy()
  })

  it('toggleMarkerTrackVisibility émet toggleMarkerTrackVisibility', () => {
    const ctrl = new SequenceEditorController(NESTED)
    const batches = collectCommands(ctrl)
    ctrl.toggleMarkerTrackVisibility('mtrack-01')
    expect(batches).toEqual([[{ name: 'toggleMarkerTrackVisibility', args: { markerTrackId: 'mtrack-01' } }]])
    ctrl.destroy()
  })

  it('removeMarkerTrack émet removeMarkerTrack ET efface le markerId local sélectionné s\'il appartenait à la piste', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.selectMarker('marker-01') // appartient à mtrack-01 dans la fixture NESTED
    const batches = collectCommands(ctrl)
    ctrl.removeMarkerTrack('mtrack-01')
    expect(batches).toEqual([[{ name: 'removeMarkerTrack', args: { markerTrackId: 'mtrack-01' } }]])
    expect(ctrl.getSnapshot().context.selection.markerId).toBeNull()
    ctrl.destroy()
  })
})

describe('addMarker / moveMarker / removeMarker / attachMarker / detachMarker', () => {
  it('addMarker émet addMarker avec un marker complet', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const batches = collectCommands(ctrl)
    const id = ctrl.addMarker('mt1', 5000, 'Repère')
    expect(batches).toEqual([[{ name: 'addMarker', args: { markerTrackId: 'mt1', marker: { id, timeMs: 5000, label: 'Repère' } } }]])
    ctrl.destroy()
  })

  it('moveMarker émet moveMarker', () => {
    const ctrl = new SequenceEditorController(NESTED)
    const batches = collectCommands(ctrl)
    ctrl.moveMarker('marker-01', 4000)
    expect(batches).toEqual([[{ name: 'moveMarker', args: { markerId: 'marker-01', timeMs: 4000 } }]])
    ctrl.destroy()
  })

  it('removeMarker émet removeMarker ET efface le markerId local sélectionné', () => {
    const ctrl = new SequenceEditorController(NESTED)
    ctrl.selectMarker('marker-01')
    const batches = collectCommands(ctrl)
    ctrl.removeMarker('marker-01')
    expect(batches).toEqual([[{ name: 'removeMarker', args: { markerId: 'marker-01' } }]])
    expect(ctrl.getSnapshot().context.selection.markerId).toBeNull()
    ctrl.destroy()
  })

  it('attachMarker / detachMarker émettent leur commande', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const batches = collectCommands(ctrl)
    ctrl.attachMarker('track-01', 'kf-02', 'm1')
    ctrl.detachMarker('track-01', 'kf-02')
    expect(batches).toEqual([
      [{ name: 'attachMarkerToKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-02', markerId: 'm1' } }],
      [{ name: 'detachMarkerFromKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-02' } }],
    ])
    ctrl.destroy()
  })
})

// ─── Sélection — markerId local ; trackId/keyframeId nécessitent un écho pour se refléter ──────

describe('selectTrack / selectKeyframe / selectMarker', () => {
  it('selectTrack / selectKeyframe émettent onSelectionRequest, ne changent pas la sélection locale sans écho', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const requests = collectSelectionRequests(ctrl)
    ctrl.selectTrack('track-01')
    ctrl.selectKeyframe('track-01', 'kf-02')
    expect(requests).toEqual([
      { itemIds: ['track-01'], keyframeId: undefined },
      { itemIds: ['track-01'], keyframeId: 'kf-02' },
    ])
    expect(ctrl.getSnapshot().context.selection.trackId).toBeNull()
  })

  it('selectMarker sélectionne un marker localement ET émet une désélection centrale (itemIds: [])', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    const requests = collectSelectionRequests(ctrl)
    ctrl.selectMarker('marker-01')
    const { selection } = ctrl.getSnapshot().context
    expect(selection.markerId).toBe('marker-01')
    expect(requests).toEqual([{ itemIds: [] }])
    ctrl.destroy()
  })

  it('selectTrack efface le markerId local sélectionné (mutuellement exclusif, purement local)', () => {
    const ctrl = new SequenceEditorController(ONE_TRACK)
    ctrl.selectMarker('marker-01')
    ctrl.selectTrack('track-01')
    expect(ctrl.getSnapshot().context.selection.markerId).toBeNull()
    ctrl.destroy()
  })
})

// ─── Audio (item média + masterItemId) — émet setMasterWaveform ────────────────

describe('setMasterWaveform', () => {
  it('émet setMasterWaveform', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const batches = collectCommands(ctrl)
    const wf = { version: 1 as const, sampleRate: 44100, durationSec: 8, points: 4, min: [-1, -1, -1, -1], max: [1, 1, 1, 1] }
    ctrl.setMasterWaveform(wf)
    expect(batches).toEqual([[{ name: 'setMasterWaveform', args: { waveform: wf } }]])
    ctrl.destroy()
  })
})

// ─── Duration ───────────────────────────────────────────────────────────────

describe('setDuration', () => {
  it('émet setSceneDuration', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    const batches = collectCommands(ctrl)
    ctrl.setDuration(20000, 'audio-primary')
    expect(batches).toEqual([[{ name: 'setSceneDuration', args: { durationMs: 20000, source: 'audio-primary' } }]])
    ctrl.destroy()
  })
})

// ─── Coordinate utilities — purement locales, non affectées ────────────────────

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
    expect(ctrl.snapToGrid(1050)).toBe(1000)
    ctrl.destroy()
  })

  it('snapToGrid arrondi à 100 ms si hors seuil', () => {
    const ctrl = new SequenceEditorController(EMPTY)
    expect(ctrl.snapToGrid(3450)).toBe(3500)
    ctrl.destroy()
  })
})

// ─── Viewport — purement local ──────────────────────────────────────────────

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
    ctrl.notifyResize(400, 600)
    const before = ctrl.getViewport().startMs
    ctrl.pan(100)
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

// ─── Playhead — purement local ──────────────────────────────────────────────

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

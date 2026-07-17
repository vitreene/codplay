import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { sequenceEditorMachine } from '../src/sequence-editor/machine'
import type { Command } from '../src/app/controller/types'
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

/** Même filtre que `SequenceEditorController.onCommand` — un commandBatch vide EST émis au niveau brut (`emit()` doit toujours retourner un event), filtré une couche plus haut. */
function collectCommands(actor: ReturnType<typeof boot>): Command[][] {
  const batches: Command[][] = []
  actor.on('commandBatch', (e) => { if (e.commands.length > 0) batches.push(e.commands) })
  return batches
}

// ─── Add / remove keyframe — émettent, ne mutent plus scene localement ──────

describe('KEYFRAME.ADD', () => {
  it('émet createNamedKeyframe avec le timeMs demandé, scene locale inchangée', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 3000 })
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes).toHaveLength(3) // inchangé — pas d'auto-mutation
    expect(batches[0]![0]).toMatchObject({ name: 'createNamedKeyframe', args: { itemId: 'track-01', timeMs: 3000 } })
    actor.stop()
  })

  it('clampe le timeMs à [0, durationMs] avant émission', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 99999 })
    expect(batches[0]![0]).toMatchObject({ args: { timeMs: 10000 } })
    actor.stop()
  })

  it('dégrade le machine en idle après émission', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 'track-01', timeMs: 4000 })
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })
})

describe('KEYFRAME.REMOVE', () => {
  it('émet deleteKeyframe pour le keyframe ciblé', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 'track-01', keyframeId: 'kf-02' })
    expect(batches).toEqual([[{ name: 'deleteKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-02' } }]])
    actor.stop()
  })
})

// ─── Drag start → move (avec snap) → end ────────────────────────────────────

describe('drag keyframe', () => {
  it('DRAG.START_KEYFRAME → state dragging-keyframe (interaction reste locale)', () => {
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

  it('DRAG.MOVE met à jour currentMs localement (arrondi à 100 ms) — n\'émet rien', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 2050 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'dragging-keyframe') expect(i.currentMs).toBe(2100)
    expect(batches).toHaveLength(0)
    actor.stop()
  })

  it('DRAG.MOVE snap sur un marqueur à portée', () => {
    // Remplace l'ancien `CUE.ADD` (supprimé — les cues vivent désormais dans `Content`, par item
    // média) : un point d'aimantation autoportant sur la scène est un marqueur (`markerTracks`).
    // Poser directement le marqueur dans la scène de boot (les mutations ne s'appliquent plus
    // localement — MARKER_TRACK.ADD/MARKER.ADD émettraient, il faudrait un écho pour les voir ici).
    const scene: EditorScene = {
      ...ONE_TRACK,
      markerTracks: { 'mt-test': { id: 'mt-test', label: 'test', visible: true, markers: [{ id: 'marker-test', timeMs: 3000, label: 'test' }] } },
    }
    const actor = boot(scene)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    // avec ZOOM_DEFAULT=80px/s et snapThresholdPx=8, threshold=100ms.  3020 est dans [2900,3100]
    actor.send({ type: 'DRAG.MOVE', pointerMs: 3020 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'dragging-keyframe') expect(i.currentMs).toBe(3000) // snappé sur le marqueur
    actor.stop()
  })

  it('DRAG.END → idle, émet moveKeyframe au currentMs (scene locale inchangée)', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 4000 })
    actor.send({ type: 'DRAG.END' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(batches).toEqual([[{ name: 'moveKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-02', timeMs: 4000 } }]])
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes.find(k => k.id === 'kf-02')?.timeMs).toBe(600) // inchangé localement
    actor.stop()
  })

  it('DRAG.END : currentMs clampé à durationMs, le guard canCommitDrag passe donc toujours (comportement du code, pas juste un test)', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 'track-01', keyframeId: 'kf-02' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 11000 })
    actor.send({ type: 'DRAG.END' })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(batches[0]![0]).toMatchObject({ args: { timeMs: 10000 } })
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

  it('CLIP.DRAW_MOVE met à jour currentMs localement', () => {
    const actor = boot(ONE_TRACK)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 0, introId: 'i1', outroId: 'o1' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 2000 })
    const i = actor.getSnapshot().context.interaction!
    if (i.kind === 'drawing-clip') expect(i.currentMs).toBe(2000)
    actor.stop()
  })

  it('CLIP.DRAW_END → idle, émet la suppression des intro/outro existants puis leur recréation aux bons ids/timeMs', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 1000, introId: 'new-intro', outroId: 'new-outro' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 3000 })
    actor.send({ type: 'CLIP.DRAW_END' })
    expect(actor.getSnapshot().value).toBe('idle')
    // ONE_TRACK a déjà kf-01 (intro) et kf-03 (outro) sur track-01 → deux deleteKeyframe avant les deux creates
    expect(batches).toEqual([[
      { name: 'deleteKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-01' } },
      { name: 'deleteKeyframe', args: { itemId: 'track-01', keyframeId: 'kf-03' } },
      { name: 'createNamedKeyframe', args: { itemId: 'track-01', keyframeId: 'new-intro', timeMs: 1000, name: 'intro' } },
      { name: 'createNamedKeyframe', args: { itemId: 'track-01', keyframeId: 'new-outro', timeMs: 3000, name: 'outro' } },
    ]])
    actor.stop()
  })

  it('CLIP.DRAW_END normalise les bornes (start > end)', () => {
    const actor = boot(ONE_TRACK)
    const batches = collectCommands(actor)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'track-01', pointerMs: 4000, introId: 'rev-i', outroId: 'rev-o' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 2000 })
    actor.send({ type: 'CLIP.DRAW_END' })
    expect(batches[0]!.find(c => c.name === 'createNamedKeyframe' && c.args.name === 'intro')).toMatchObject({ args: { timeMs: 2000 } })
    expect(batches[0]!.find(c => c.name === 'createNamedKeyframe' && c.args.name === 'outro')).toMatchObject({ args: { timeMs: 4000 } })
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
    const actor = boot(EMPTY, 400)
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

// Le statut de lecture réel et son avance ne sont plus simulés localement (`PLAYHEAD.TICK`/
// `START_PLAY`/`PAUSE`/`STOP` retirés) — `TelcoApi` (`codplay`) les possède désormais ;
// `TELCO.SYNC_PLAYHEAD` en est le seul écho (`2026-07-17-telco-real-transport-plan.md` §Étape C).
describe('playhead', () => {
  it('TELCO.SYNC_PLAYHEAD reflète le curseur telco', () => {
    const actor = boot(EMPTY)
    actor.send({ type: 'TELCO.SYNC_PLAYHEAD', timelineMs: 500 })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.playheadMs).toBe(500)
    actor.stop()
  })
})

// ─── SCENE.LOAD ──────────────────────────────────────────────────────────────

describe('SCENE.LOAD', () => {
  it('remplace la scène et remet playhead à 0 (réservé au vrai changement de document — §ci-dessus)', () => {
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

  it('TRACK.REMOVE émet le deleteItem central (le nettoyage des descendants est la responsabilité de base-commands.ts, testé là-bas)', () => {
    const actor = boot(NESTED)
    const batches = collectCommands(actor)
    actor.send({ type: 'TRACK.REMOVE', trackId: 'track-capsule-01' })
    expect(batches).toEqual([[{ name: 'deleteItem', args: { itemId: 'track-capsule-01' } }]])
    actor.stop()
  })
})

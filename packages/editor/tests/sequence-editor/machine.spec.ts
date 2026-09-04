// Filet de sécurité — machine.ts n'auto-mute plus jamais `scene`/`selection` (§"unicité de la
// source", `2026-07-13-controller-islands-bridge-plan.md` §3bis) : les handlers de geste
// utilisateur ÉMETTENT des commandes/intentions de sélection au lieu de les appliquer localement.
// Seuls SCENE.SYNC/SCENE.LOAD écrivent scene/selection — testés séparément, en contraste explicite
// (SCENE.SYNC préserve playhead/sélection/interaction ; SCENE.LOAD réinitialise tout).

import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { sequenceEditorMachine, applySnapToMs } from '../../src/sequence-editor/machine'
import type { Command } from '../../src/app/controller/types'
import type { EditorScene, Item } from '../../src/sequence-editor/types'

function actorWithScene(scene: EditorScene) {
  const actor = createActor(sequenceEditorMachine, { input: { scene, viewWidthPx: 800, viewHeightPx: 600 } })
  actor.start()
  return actor
}

/**
 * Collecte les commandes émises (commandBatch) pendant le test — filtre les batches vides, comme
 * le fait réellement `SequenceEditorController.onCommand` (`emit()` doit toujours retourner un
 * event, un batch vide EST émis au niveau brut de l'acteur ; ce filtre-là vit dans le contrôleur,
 * pas la machine — reproduit ici pour observer ce qu'un vrai consommateur voit).
 */
function collectCommands(actor: ReturnType<typeof actorWithScene>): Command[][] {
  const batches: Command[][] = []
  actor.on('commandBatch', (e) => { if (e.commands.length > 0) batches.push(e.commands) })
  return batches
}

/** Collecte les demandes de sélection émises pendant le test. */
function collectSelectionRequests(actor: ReturnType<typeof actorWithScene>): { itemIds: string[]; keyframeId?: string }[] {
  const requests: { itemIds: string[]; keyframeId?: string }[] = []
  actor.on('selectionRequested', (e) => requests.push({ itemIds: e.itemIds, keyframeId: e.keyframeId }))
  return requests
}

function elementItem(id: string, overrides: Partial<Item> = {}): Item {
  return { id, type: 'text', label: id, parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'decor-init', keyframes: [], ...overrides }
}

function capsuleItem(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id, type: 'capsule', label: id, parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'decor-init',
    keyframes: [], capsule: { kind: 'rangee', distribution: { mode: 'sequential' } }, ...overrides,
  }
}

function baseScene(items: Item[] = []): EditorScene {
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

describe('sequenceEditorMachine — keyframes émettent des commandes, ne mutent plus scene localement', () => {
  it('KEYFRAME.ADD hérite le décor initial au premier KF, avec le timeMs snappé/clampé, sans toucher scene', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 1234, id: 'kf-a' })

    expect(actor.getSnapshot().context.scene.items[0]!.keyframes).toHaveLength(0)
    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual([{ name: 'createNamedKeyframe', args: { itemId: 't1', keyframeId: 'kf-a', timeMs: 1200, decorId: 'decor-init' } }])
  })

  it('KEYFRAME.ADD reuses an adjacent decorId when one exists (read-only lookup on the cached scene)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1', { keyframes: [{ id: 'kf-0', timeMs: 500, decorId: 'd0' }] })]))
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.ADD', trackId: 't1', timeMs: 600, id: 'kf-a' })
    expect(batches[0]![0]).toMatchObject({ name: 'createNamedKeyframe', args: { decorId: 'd0' } })
  })

  it('KEYFRAME.REMOVE emits deleteKeyframe', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.REMOVE', trackId: 't1', keyframeId: 'kf-a' })
    expect(batches[0]).toEqual([{ name: 'deleteKeyframe', args: { itemId: 't1', keyframeId: 'kf-a' } }])
  })

  it('KEYFRAME.CLEAR_TRACK / TRACK.RESET_KEYFRAMES both emit clearItemKeyframes (same underlying command)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.CLEAR_TRACK', trackId: 't1' })
    actor.send({ type: 'TRACK.RESET_KEYFRAMES', trackId: 't1' })
    expect(batches[0]).toEqual([{ name: 'clearItemKeyframes', args: { itemId: 't1' } }])
    expect(batches[1]).toEqual([{ name: 'clearItemKeyframes', args: { itemId: 't1' } }])
  })

  it('KEYFRAME.CLEAR_CAPSULE emits clearCapsuleKeyframes', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.CLEAR_CAPSULE', trackId: 'cap' })
    expect(batches[0]).toEqual([{ name: 'clearCapsuleKeyframes', args: { itemId: 'cap' } }])
  })

  it('KEYFRAME.RENAME / ASSIGN_DECOR / SET_TRANSITION_IN / SET_TRANSITION_OUT / ATTACH_MARKER / DETACH_MARKER each emit their own command', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'KEYFRAME.RENAME', trackId: 't1', keyframeId: 'kf-a', name: 'intro' })
    actor.send({ type: 'KEYFRAME.ASSIGN_DECOR', trackId: 't1', keyframeId: 'kf-a', decorId: 'd9' })
    actor.send({ type: 'KEYFRAME.SET_TRANSITION_IN', trackId: 't1', keyframeId: 'kf-a', def: { kind: 'named', name: 'fade', durationMs: 300 } })
    actor.send({ type: 'KEYFRAME.SET_TRANSITION_OUT', trackId: 't1', keyframeId: 'kf-a', def: null })
    actor.send({ type: 'KEYFRAME.ATTACH_MARKER', trackId: 't1', keyframeId: 'kf-a', markerId: 'm1' })
    actor.send({ type: 'KEYFRAME.DETACH_MARKER', trackId: 't1', keyframeId: 'kf-a' })

    expect(batches.map((b) => b[0]!.name)).toEqual([
      'renameKeyframe', 'assignKeyframeDecor', 'setKeyframeTransitionIn', 'setKeyframeTransitionOut',
      'attachMarkerToKeyframe', 'detachMarkerFromKeyframe',
    ])
  })
})

describe('sequenceEditorMachine — snap (pure function, non affectée par le refactor)', () => {
  it('applySnapToMs snaps to the nearest point within threshold', () => {
    const snapGrid = [{ timeMs: 1000, kind: 'keyframe' as const, sourceId: 'kf-a' }]
    expect(applySnapToMs(1005, snapGrid, 50)).toBe(1000)
  })

  it('applySnapToMs falls back to the time step grid outside threshold', () => {
    const snapGrid = [{ timeMs: 1000, kind: 'keyframe' as const, sourceId: 'kf-a' }]
    expect(applySnapToMs(1234, snapGrid, 10)).toBe(1200)
  })
})

describe('sequenceEditorMachine — drag (l\'état/interaction reste local ; le commit émet)', () => {
  it('DRAG.START_KEYFRAME sets local interaction AND emits a selection request (mutual: geste local + intention de sélection)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })]))
    const selectionRequests = collectSelectionRequests(actor)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 't1', keyframeId: 'kf-a' })

    expect(actor.getSnapshot().value).toBe('dragging-keyframe')
    const i = actor.getSnapshot().context.interaction!
    expect(i).toMatchObject({ kind: 'dragging-keyframe', originMs: 1000, currentMs: 1000 })
    expect(selectionRequests).toEqual([{ itemIds: ['t1'], keyframeId: 'kf-a' }])
    // La sélection locale (lecture seule) N'A PAS changé — seul un écho SCENE.SYNC pourrait l'écrire.
    expect(actor.getSnapshot().context.selection).toEqual({ trackId: null, keyframeId: null, markerId: null })
  })

  it('DRAG.START_KEYFRAME (un clic simple, pas seulement un drag effectif) amène aussi la tête de lecture au timeMs du kf — voir l\'item dans son état au moment fixé', () => {
    const actor = actorWithScene(baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 2500, decorId: 'd1' }] })]))
    actor.send({ type: 'PLAYHEAD.SET', timeMs: 0 })
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 't1', keyframeId: 'kf-a' })
    expect(actor.getSnapshot().context.playheadMs).toBe(2500)
  })

  it('DRAG.MOVE updates local currentMs (rounded to 100ms) — purely local, no emission', () => {
    const actor = actorWithScene(baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })]))
    const batches = collectCommands(actor)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 't1', keyframeId: 'kf-a' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 2050 })
    const i = actor.getSnapshot().context.interaction!
    expect(i.kind === 'dragging-keyframe' && i.currentMs).toBe(2100)
    expect(batches).toHaveLength(0)
  })

  it('DRAG.END emits moveKeyframe with the committed time, clears local interaction', () => {
    const actor = actorWithScene(baseScene([elementItem('t1', { keyframes: [{ id: 'kf-a', timeMs: 1000, decorId: 'd1' }] })]))
    const batches = collectCommands(actor)
    actor.send({ type: 'DRAG.START_KEYFRAME', trackId: 't1', keyframeId: 'kf-a' })
    actor.send({ type: 'DRAG.MOVE', pointerMs: 4000 })
    actor.send({ type: 'DRAG.END' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.interaction).toBeNull()
    expect(batches).toEqual([[{ name: 'moveKeyframe', args: { itemId: 't1', keyframeId: 'kf-a', timeMs: 4000 } }]])
    // scene locale (cache lecture seule) inchangée — seul un écho SCENE.SYNC la mettrait à jour.
    expect(actor.getSnapshot().context.scene.items[0]!.keyframes[0]!.timeMs).toBe(1000)
  })
})

describe('sequenceEditorMachine — clip draw (capsule intro/outro)', () => {
  it('CLIP.START_DRAW → DRAW_MOVE → DRAW_END emits delete-old (none here) + two createNamedKeyframe', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'cap', pointerMs: 1000, introId: 'intro-1', outroId: 'outro-1' })
    expect(actor.getSnapshot().value).toBe('drawing-clip')
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 4000 })
    actor.send({ type: 'CLIP.DRAW_END' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(batches).toEqual([[
      { name: 'createNamedKeyframe', args: { itemId: 'cap', keyframeId: 'intro-1', timeMs: 1000, name: 'intro' } },
      { name: 'createNamedKeyframe', args: { itemId: 'cap', keyframeId: 'outro-1', timeMs: 4000, name: 'outro' } },
    ]])
  })

  it('CLIP.DRAW_END on a capsule with an existing intro/outro emits deleteKeyframe for each before recreating (fixes the old decor-leak — deleteKeyframe prunes, the old array-filter did not)', () => {
    const cap = capsuleItem('cap', {
      keyframes: [
        { id: 'old-intro', timeMs: 0, decorId: 'd0', name: 'intro' },
        { id: 'old-outro', timeMs: 5000, decorId: 'd1', name: 'outro' },
      ],
    })
    const actor = actorWithScene(baseScene([cap]))
    const batches = collectCommands(actor)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'cap', pointerMs: 1000, introId: 'new-intro', outroId: 'new-outro' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 3000 })
    actor.send({ type: 'CLIP.DRAW_END' })

    expect(batches[0]).toEqual([
      { name: 'deleteKeyframe', args: { itemId: 'cap', keyframeId: 'old-intro' } },
      { name: 'deleteKeyframe', args: { itemId: 'cap', keyframeId: 'old-outro' } },
      { name: 'createNamedKeyframe', args: { itemId: 'cap', keyframeId: 'new-intro', timeMs: 1000, name: 'intro' } },
      { name: 'createNamedKeyframe', args: { itemId: 'cap', keyframeId: 'new-outro', timeMs: 3000, name: 'outro' } },
    ])
  })

  it('CLIP.DRAW_END discards the draw (emits nothing) when min >= max (degenerate range)', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'CLIP.START_DRAW', trackId: 'cap', pointerMs: 1000, introId: 'i', outroId: 'o' })
    actor.send({ type: 'CLIP.DRAW_MOVE', pointerMs: 1000 })
    actor.send({ type: 'CLIP.DRAW_END' })
    expect(batches).toHaveLength(0)
  })

  it('CLIP.PLACE creates intro first, then outro, then moves the nearest bound', () => {
    const actor = actorWithScene(baseScene([capsuleItem('cap')]))
    const batches = collectCommands(actor)

    actor.send({ type: 'CLIP.PLACE', trackId: 'cap', pointerMs: 1000 })
    expect(batches[0]![0]).toMatchObject({ name: 'createNamedKeyframe', args: { name: 'intro', timeMs: 1000 } })
  })
})

describe('sequenceEditorMachine — virtual keyframes (calculées depuis la scène de boot, non affectées par le refactor émission)', () => {
  it('applies the implicit root capsule distribution to root children', () => {
    const emptyChild = elementItem('root-empty', { order: 'a' })
    const singleChild = elementItem('root-single', {
      order: 'b',
      keyframes: [{ id: 'kf-root-single', timeMs: 2500, decorId: 'd0' }],
    })
    const singleAtEnd = elementItem('root-single-at-end', {
      order: 'c',
      keyframes: [{ id: 'kf-root-single-at-end', timeMs: 10000, decorId: 'd0' }],
    })
    const actor = actorWithScene(baseScene([emptyChild, singleChild, singleAtEnd]))
    const vkfs = actor.getSnapshot().context.virtualKeyframes

    expect(vkfs.find((v) => v.trackId === 'root-empty' && v.name === 'intro')).toMatchObject({ timeMs: 0 })
    expect(vkfs.find((v) => v.trackId === 'root-empty' && v.name === 'outro')).toMatchObject({ timeMs: 10000 })
    expect(vkfs.find((v) => v.trackId === 'root-single' && v.name === 'intro')).toBeUndefined()
    expect(vkfs.find((v) => v.trackId === 'root-single' && v.name === 'outro')).toMatchObject({ timeMs: 10000 })
    expect(vkfs.find((v) => v.trackId === 'root-single-at-end' && v.name === 'outro')).toBeUndefined()
  })

  it('computes virtual keyframes for free children of a capsule with intro/outro + capsule.kind', () => {
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

  it('treats unnamed first/last child keyframes as real visibility bounds', () => {
    const capsule = capsuleItem('cap', {
      keyframes: [
        { id: 'kf-cap-first', timeMs: 0, decorId: 'd0' },
        { id: 'kf-cap-last', timeMs: 4000, decorId: 'd0' },
      ],
    })
    const lockedChild = elementItem('locked-child', {
      parentId: 'cap',
      order: 'a',
      keyframes: [
        { id: 'kf-child-first', timeMs: 1000, decorId: 'd0' },
        { id: 'kf-child-last', timeMs: 3000, decorId: 'd0' },
      ],
    })
    const freeChild = elementItem('free-child', { parentId: 'cap', order: 'b' })
    const actor = actorWithScene(baseScene([capsule, lockedChild, freeChild]))
    const vkfs = actor.getSnapshot().context.virtualKeyframes

    expect(vkfs.filter((v) => v.trackId === 'locked-child')).toHaveLength(0)
    expect(vkfs.find((v) => v.trackId === 'free-child' && v.name === 'intro')).toMatchObject({ timeMs: 3000 })
    expect(vkfs.find((v) => v.trackId === 'free-child' && v.name === 'outro')).toMatchObject({ timeMs: 4000 })
  })

  it('a locked child\'s own transitionIn duration shortens its distribution slot, same formula as build-scene.ts (TransitionTiming)', () => {
    const capsule = capsuleItem('cap', {
      keyframes: [
        { id: 'kf-intro', timeMs: 0, decorId: 'd0', name: 'intro' },
        { id: 'kf-outro', timeMs: 4000, decorId: 'd0', name: 'outro' },
      ],
    })
    // child-a: real intro kf only (300ms transitionIn) — its own virtual outro, and the
    // following free child's virtual intro, both fall at 2350 (not 2500) because the transition
    // is subtracted before the remaining space is shared out (sequential, cursor stays at 0
    // through a half-locked child, so only this subtraction moves the shared boundary).
    const childA = elementItem('child-a', {
      parentId: 'cap',
      order: 'a',
      keyframes: [{ id: 'kf-a-intro', timeMs: 1000, decorId: 'd0', name: 'intro', transitionIn: { kind: 'named', name: 'fade', durationMs: 300 } }],
    })
    const childB = elementItem('child-b', { parentId: 'cap', order: 'b' })
    const actor = actorWithScene(baseScene([capsule, childA, childB]))
    const vkfs = actor.getSnapshot().context.virtualKeyframes

    expect(vkfs.find((v) => v.trackId === 'child-a' && v.name === 'outro')).toMatchObject({ timeMs: 2350 })
    expect(vkfs.find((v) => v.trackId === 'child-b' && v.name === 'intro')).toMatchObject({ timeMs: 2350 })
    expect(vkfs.find((v) => v.trackId === 'child-b' && v.name === 'outro')).toMatchObject({ timeMs: 4000 })
  })
})

describe('sequenceEditorMachine — playhead / play range / viewport (purement locaux)', () => {
  it('PLAYRANGE.SET / CLEAR', () => {
    const actor = actorWithScene(baseScene())
    actor.send({ type: 'PLAYRANGE.SET', inMs: 1000, outMs: 5000 })
    expect(actor.getSnapshot().context.playRange).toEqual({ inMs: 1000, outMs: 5000 })
    actor.send({ type: 'PLAYRANGE.CLEAR' })
    expect(actor.getSnapshot().context.playRange).toBeNull()
  })

  it('VIEWPORT.ZOOM / PAN', () => {
    const actor = actorWithScene(baseScene())
    const before = actor.getSnapshot().context.viewport.pixelsPerMs
    actor.send({ type: 'VIEWPORT.ZOOM', factor: 2, focusMs: 0 })
    expect(actor.getSnapshot().context.viewport.pixelsPerMs).toBeGreaterThan(before)

    actor.send({ type: 'VIEWPORT.PAN_START', pointerPx: 100 })
    expect(actor.getSnapshot().value).toBe('panning')
    actor.send({ type: 'VIEWPORT.PAN_MOVE', pointerPx: 50 })
    actor.send({ type: 'VIEWPORT.PAN_END' })
    expect(actor.getSnapshot().value).toBe('idle')
  })
})

describe('sequenceEditorMachine — tracks (items) : structure du document, commandes CENTRALES réutilisées', () => {
  it('TRACK.MOVE emits the CENTRAL attachItem command (not a local one)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1'), capsuleItem('cap')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'TRACK.MOVE', trackId: 't1', parentId: 'cap', order: 'b' })
    expect(batches).toEqual([[{ name: 'attachItem', args: { itemId: 't1', parentId: 'cap', order: 'b' } }]])
  })

  it('TRACK.REMOVE emits the CENTRAL deleteItem command', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'TRACK.REMOVE', trackId: 't1' })
    expect(batches).toEqual([[{ name: 'deleteItem', args: { itemId: 't1' } }]])
  })

  it('TRACK.TOGGLE_VISIBILITY emits toggleItemVisibility', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const batches = collectCommands(actor)
    actor.send({ type: 'TRACK.TOGGLE_VISIBILITY', trackId: 't1' })
    expect(batches).toEqual([[{ name: 'toggleItemVisibility', args: { itemId: 't1' } }]])
  })
})

describe('sequenceEditorMachine — sélection', () => {
  it('TRACK.SELECT / KEYFRAME.SELECT emit selectionRequested ; trackId/keyframeId locaux restent en cache lecture seule (inchangés sans écho)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    const requests = collectSelectionRequests(actor)
    actor.send({ type: 'TRACK.SELECT', trackId: 't1' })
    actor.send({ type: 'KEYFRAME.SELECT', trackId: 't1', keyframeId: 'kf-a' })

    expect(requests).toEqual([
      { itemIds: ['t1'], keyframeId: undefined },
      { itemIds: ['t1'], keyframeId: 'kf-a' },
    ])
    expect(actor.getSnapshot().context.selection.trackId).toBeNull()
    expect(actor.getSnapshot().context.selection.keyframeId).toBeNull()
  })

  it('TRACK.SELECT / KEYFRAME.SELECT clear the LOCAL markerId (mutual exclusivity — markerId a un seul écrivain légitime : cette machine)', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'MARKER.SELECT', markerId: 'm1' })
    expect(actor.getSnapshot().context.selection.markerId).toBe('m1')

    actor.send({ type: 'TRACK.SELECT', trackId: 't1' })
    expect(actor.getSnapshot().context.selection.markerId).toBeNull()
  })

  it('MARKER.SELECT sets local markerId AND emits a central deselection (itemIds: []) — never writes trackId/keyframeId directly (un seul écrivain légitime pour ces deux champs : l\'écho du centre)', () => {
    const actor = actorWithScene(baseScene())
    const requests = collectSelectionRequests(actor)
    actor.send({ type: 'MARKER.SELECT', markerId: 'm1' })
    expect(actor.getSnapshot().context.selection.markerId).toBe('m1')
    expect(requests).toEqual([{ itemIds: [] }])
  })
})

describe('sequenceEditorMachine — markers (document — commandes émises)', () => {
  it('MARKER_TRACK.ADD / MARKER.ADD / MOVE / REMOVE each emit their command', () => {
    const actor = actorWithScene(baseScene())
    const batches = collectCommands(actor)
    actor.send({ type: 'MARKER_TRACK.ADD', markerTrackId: 'mt1', label: 'Repères' })
    actor.send({ type: 'MARKER.ADD', markerTrackId: 'mt1', marker: { id: 'm1', timeMs: 1000, label: 'M1' } })
    actor.send({ type: 'MARKER.MOVE', markerId: 'm1', timeMs: 2000 })
    actor.send({ type: 'MARKER.REMOVE', markerId: 'm1' })

    expect(batches.map((b) => b[0]!.name)).toEqual(['addMarkerTrack', 'addMarker', 'moveMarker', 'removeMarker'])
  })
})

describe('sequenceEditorMachine — audio / durée', () => {
  it('AUDIO.SET_WAVEFORM emits setMasterWaveform', () => {
    const actor = actorWithScene(baseScene())
    const batches = collectCommands(actor)
    const wf = { version: 1 as const, sampleRate: 100, durationSec: 3, points: 1, min: [0], max: [0] }
    actor.send({ type: 'AUDIO.SET_WAVEFORM', waveform: wf })
    expect(batches).toEqual([[{ name: 'setMasterWaveform', args: { waveform: wf } }]])
  })

  it('SCENE.SET_DURATION emits setSceneDuration', () => {
    const actor = actorWithScene(baseScene())
    const batches = collectCommands(actor)
    actor.send({ type: 'SCENE.SET_DURATION', durationMs: 20000, source: 'audio-primary' })
    expect(batches).toEqual([[{ name: 'setSceneDuration', args: { durationMs: 20000, source: 'audio-primary' } }]])
  })
})

describe('sequenceEditorMachine — SCENE.SYNC vs SCENE.LOAD (le cœur du refactor : un seul écrivain, deux comportements distincts)', () => {
  it('SCENE.SYNC replaces scene + central selection fields, but preserves playhead/interaction/local markerId', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'PLAYHEAD.SET', timeMs: 5000 })
    actor.send({ type: 'MARKER.SELECT', markerId: 'm1' })

    const nextScene = baseScene([elementItem('t2')])
    actor.send({ type: 'SCENE.SYNC', scene: nextScene, selection: { itemIds: ['t2'], keyframeId: 'kf-x' } })

    const ctx = actor.getSnapshot().context
    expect(ctx.scene.items[0]!.id).toBe('t2')
    expect(ctx.selection).toEqual({ trackId: 't2', keyframeId: 'kf-x', markerId: null }) // markerId cleared by any authoritative sync
    expect(ctx.playheadMs).toBe(5000) // PRESERVED — c'est tout l'objet de SCENE.SYNC vs SCENE.LOAD
  })

  it('SCENE.LOAD replaces everything, including playhead/selection/interaction — reserved for a genuine document switch', () => {
    const actor = actorWithScene(baseScene([elementItem('t1')]))
    actor.send({ type: 'TRACK.SELECT', trackId: 't1' }) // n'a plus d'effet local (émis seulement) — juste pour bien montrer que SCENE.LOAD réinitialise même une sélection déjà vide
    actor.send({ type: 'PLAYHEAD.SET', timeMs: 5000 })

    const nextScene = baseScene([elementItem('t2')])
    actor.send({ type: 'SCENE.LOAD', scene: nextScene })

    const ctx = actor.getSnapshot().context
    expect(ctx.scene.items[0]!.id).toBe('t2')
    expect(ctx.playheadMs).toBe(0) // RÉINITIALISÉ — contraste avec SCENE.SYNC
    expect(ctx.selection).toEqual({ trackId: null, keyframeId: null, markerId: null })
    expect(ctx.interaction).toBeNull()
  })
})

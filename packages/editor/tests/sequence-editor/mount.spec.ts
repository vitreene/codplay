// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SequenceEditorController } from '../../src/sequence-editor/controller'
import { mountSequenceEditor } from '../../src/sequence-editor/mount'
import type { EditorScene } from '../../src/sequence-editor/types'
import type { TelcoApi, TelcoStateListener } from 'codplay-v1/telco/types'
import type { PlayerStateSnapshot } from 'codplay-v1/player/types'

// jsdom does not implement ResizeObserver (https://github.com/jsdom/jsdom/issues/3368) — a
// no-op stub is enough here, `mountSequenceEditor` only uses it to react to real layout changes,
// which don't occur in a headless test DOM anyway.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
})

function minimalScene(): EditorScene {
  return {
    id: 'scene-1',
    meta: {
      title: 'Scène minimale',
      durationMs: 3000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items: [
      {
        id: 'item-1',
        type: 'text',
        label: 'Item',
        parentId: null,
        order: 'a',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-1',
        keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'decor-1' }],
      },
    ],
    contents: {},
    decors: { 'decor-1': { id: 'decor-1' } },
    zones: {},
    markerTracks: {},
  }
}

function snapshot(patch: Partial<PlayerStateSnapshot> = {}): PlayerStateSnapshot {
  return {
    status: 'paused',
    initialized: true,
    sequenceEnded: false,
    timelineMs: 0,
    horizon: { playedEndMs: 0, projectedMasterEndMs: 0, authorEndMs: 0, progressEndMs: 0, seekEndMs: 0 },
    runtimeRevision: 1,
    ...patch,
  }
}

/** Fake minimal — `onChange`/`onProgress` gardent leurs listeners pour que le test les déclenche à la main. */
function fakeTelco(initial: PlayerStateSnapshot = snapshot()): TelcoApi & { fireChange(s: PlayerStateSnapshot): void; fireProgress(s: PlayerStateSnapshot): void } {
  let state = initial
  const changeListeners = new Set<TelcoStateListener>()
  const progressListeners = new Set<TelcoStateListener>()
  return {
    getState: () => state,
    commandInFlight: false,
    rate: 1,
    setRate: vi.fn(),
    play: vi.fn(async () => { state = { ...state, status: 'playing' }; return { ok: true } }),
    pause: vi.fn(async () => { state = { ...state, status: 'paused' }; return { ok: true } }),
    togglePlay: vi.fn(async () => ({ ok: true })),
    seek: vi.fn(async () => ({ ok: true })),
    rewind: vi.fn(async () => ({ ok: true })),
    onChange: (listener) => { changeListeners.add(listener); return () => changeListeners.delete(listener) },
    onProgress: (listener) => { progressListeners.add(listener); return () => progressListeners.delete(listener) },
    fireChange(s: PlayerStateSnapshot): void { state = s; changeListeners.forEach((l) => l(s)) },
    fireProgress(s: PlayerStateSnapshot): void { state = s; progressListeners.forEach((l) => l(s)) },
  }
}

describe('mountSequenceEditor', () => {
  let container: HTMLElement
  let controller: SequenceEditorController

  afterEach(() => {
    controller?.destroy()
  })

  it('renders the toolbar and the track label for the given scene', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())

    const handle = mountSequenceEditor(container, controller)

    expect(container.querySelector('.seq-toolbar')).not.toBeNull()
    expect(container.querySelector('.seq-timeline')).not.toBeNull()
    expect(container.textContent).toContain('Item')

    handle.destroy()
  })

  it('destroy() empties the container and stops observing', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())

    const handle = mountSequenceEditor(container, controller)
    handle.destroy()

    expect(container.innerHTML).toBe('')
  })

  it('selecting a track only updates the rendered infobar once the central controller echoes it back (§"unicité de la source" — selectTrack alone only emits, never self-applies)', () => {
    container = document.createElement('div')
    const scene = minimalScene()
    controller = new SequenceEditorController(scene)
    const handle = mountSequenceEditor(container, controller)

    // Simule le pont vers le contrôleur central : celui-ci reçoit la demande de sélection et la
    // renvoie par écho (`syncFromCenter`) — c'est ce round-trip, pas `selectTrack` seul, qui met
    // effectivement à jour la sélection lue par le rendu.
    controller.onSelectionRequest((itemIds, keyframeId) => {
      controller.syncFromCenter(scene, { itemIds, keyframeId })
    })

    controller.selectTrack('item-1')
    expect(container.querySelector('.seq-infobar')?.textContent).toContain('Item')

    handle.destroy()
  })

  it('selectTrack alone (no bridge listening) does not change the rendered infobar — confirms it only emits', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const handle = mountSequenceEditor(container, controller)

    controller.selectTrack('item-1')
    expect(container.querySelector('.seq-infobar')?.textContent ?? '').not.toContain('Item')

    handle.destroy()
  })

  it('calls onPlayheadChange when the playhead moves', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const observed: number[] = []

    const handle = mountSequenceEditor(container, controller, { onPlayheadChange: (ms) => observed.push(ms) })
    controller.seek(1200)

    expect(observed).toContain(1200)

    handle.destroy()
  })

  it('does not call onPlayheadChange when unrelated state changes (only on an actual playhead change)', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const observed: number[] = []

    const handle = mountSequenceEditor(container, controller, { onPlayheadChange: (ms) => observed.push(ms) })
    const callsAfterMount = observed.length
    controller.selectTrack('item-1')

    expect(observed.length).toBe(callsAfterMount)

    handle.destroy()
  })
})

// `2026-07-17-telco-real-transport-plan.md` §Étape A bis/B/D — `telco` n'est branché qu'après coup
// via `attachTelco` (même contrainte de disponibilité tardive que `decorEditor`/`authorApi`).
describe('mountSequenceEditor — attachTelco', () => {
  let container: HTMLElement
  let controller: SequenceEditorController

  afterEach(() => {
    controller?.destroy()
  })

  it('before attachTelco, Play/Stop stay inert (telco null) — no exception', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const handle = mountSequenceEditor(container, controller)

    const btnPlay = container.querySelector<HTMLButtonElement>('[title="Play / Pause"]')!
    expect(() => btnPlay.click()).not.toThrow()

    handle.destroy()
  })

  it('clicking Play calls telco.play() when paused, telco.pause() when playing', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const handle = mountSequenceEditor(container, controller)
    const telco = fakeTelco(snapshot({ status: 'paused' }))
    handle.attachTelco(telco)

    const btnPlay = container.querySelector<HTMLButtonElement>('[title="Play / Pause"]')!
    btnPlay.click()
    expect(telco.play).toHaveBeenCalledOnce()

    telco.fireChange(snapshot({ status: 'playing' }))
    btnPlay.click()
    expect(telco.pause).toHaveBeenCalledOnce()

    handle.destroy()
  })

  it('clicking Stop routes through onPlayheadChange(0) — the same central SEEK relay as scrub, never a direct telco call', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const observed: number[] = []
    const handle = mountSequenceEditor(container, controller, { onPlayheadChange: (ms) => observed.push(ms) })
    const telco = fakeTelco()
    handle.attachTelco(telco)

    const btnStop = container.querySelector<HTMLButtonElement>('[title="Stop"]')!
    btnStop.click()

    expect(observed).toContain(0)
    expect(telco.seek).not.toHaveBeenCalled()

    handle.destroy()
  })

  it('telco.onChange updates the Play/Pause glyph', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const handle = mountSequenceEditor(container, controller)
    const telco = fakeTelco(snapshot({ status: 'paused' }))
    handle.attachTelco(telco)

    const btnPlay = container.querySelector<HTMLButtonElement>('[title="Play / Pause"]')!
    expect(btnPlay.dataset.glyph).toBe('▶')

    telco.fireChange(snapshot({ status: 'playing' }))
    expect(btnPlay.dataset.glyph).toBe('⏸')

    handle.destroy()
  })

  it('telco.onProgress mirrors the playhead without re-triggering onPlayheadChange (no seek loop)', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const observed: number[] = []
    const handle = mountSequenceEditor(container, controller, { onPlayheadChange: (ms) => observed.push(ms) })
    const telco = fakeTelco()
    handle.attachTelco(telco)
    const callsAfterAttach = observed.length

    telco.fireProgress(snapshot({ status: 'playing', timelineMs: 1500 }))

    expect(controller.getPlayheadMs()).toBe(1500)
    expect(observed.length).toBe(callsAfterAttach)

    handle.destroy()
  })

  // `PlayerFacade.seek()` (`create-player.ts`) calls `setStatus('seeking')` — emitting `onChange` —
  // BEFORE updating `this.timelineMs`, so an `onChange` listener wired to the playhead mirror would
  // receive a transient event carrying the PRE-seek position. Reported live 2026-07-17: clicking a
  // keyframe briefly moved the playhead to the right spot then snapped back before the seek settled.
  // `onProgress` never fires during a seek (`status !== 'playing'`), so it alone drives the mirror.
  it('telco.onChange never moves the playhead (would replay the seek-transient stale-position bug)', () => {
    container = document.createElement('div')
    controller = new SequenceEditorController(minimalScene())
    const handle = mountSequenceEditor(container, controller)
    const telco = fakeTelco(snapshot({ timelineMs: 0 }))
    handle.attachTelco(telco)
    controller.seek(1200)
    expect(controller.getPlayheadMs()).toBe(1200)

    // Simulates the transient `seeking` onChange event firing with the STALE pre-seek timelineMs.
    telco.fireChange(snapshot({ status: 'seeking', timelineMs: 0 }))

    expect(controller.getPlayheadMs()).toBe(1200)

    handle.destroy()
  })
})

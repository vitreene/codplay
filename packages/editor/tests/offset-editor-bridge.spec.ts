import { describe, it, expect } from 'vitest'
import { createOffsetEditorBridge } from '../src/app/bridges/offset-editor-bridge'
import type { AuthorApi, LibreAdapter, NodePose, TrackedSession } from '@codplay/selection-frame'
import type { OffsetValuesPx } from '../src/decor-editor/types'

/**
 * `2026-07-17-phase-commit-selection-recovery-plan.md` §Étape C — invariant A4 : l'écart offset ne
 * porte que les composants réellement manipulés depuis le dernier `rebind` (chaque rebuild réel en
 * pose un nouveau, étape A) — un move seul ne doit jamais figer `width`/`height`/`rotate`/`scale`.
 */

function fakeSession(): TrackedSession {
  return {
    getNode: () => null,
    canAct: () => true,
    subscribe: () => () => {},
    destroy: () => {},
    isGestureActive: () => false,
    startGesture: () => true,
    endGesture: () => {},
    onSuspend: () => () => {},
  }
}

function fakeAuthorApi(pose: NodePose): AuthorApi {
  return {
    subscribeToNode: () => () => {},
    getNodePose: () => pose,
    setNodePose: () => {},
    getNodeSnapshot: () => null,
    getPersoStates: () => new Map(),
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
  }
}

const POSE: NodePose = { x: 42, y: 7, rotate: 30, scaleX: 2, scaleY: 2, width: 300, height: 150 }

function binding(pose: NodePose = POSE) {
  return {
    session: fakeSession(),
    adapter: {} as LibreAdapter, // `notifyNow`/`readActivePose` ne touchent jamais `adapter` — seul `apply()` (non exercé ici) le ferait.
    authorApi: fakeAuthorApi(pose),
    itemId: 'item-1',
    referenceWidthPx: () => 100,
  }
}

describe('offset-editor-bridge — props intouchées de l\'écart offset (§Étape C)', () => {
  it('un move seul n\'émet que translate', () => {
    const bridge = createOffsetEditorBridge()
    const received: OffsetValuesPx[] = []
    bridge.onValues((v) => received.push(v))
    bridge.rebind(binding())

    bridge.notifyNow('move')

    expect(received).toEqual([{ translate: { x: 42, y: 7 } }])
  })

  it('un resize seul n\'émet que width/height, jamais translate/rotate/scale', () => {
    const bridge = createOffsetEditorBridge()
    const received: OffsetValuesPx[] = []
    bridge.onValues((v) => received.push(v))
    bridge.rebind(binding())

    bridge.notifyNow('resize')

    expect(received).toEqual([{ width: 300, height: 150 }])
  })

  it('rotate et scale suivent le même principe, chacun isolé', () => {
    const bridge = createOffsetEditorBridge()
    const received: OffsetValuesPx[] = []
    bridge.onValues((v) => received.push(v))
    bridge.rebind(binding())

    bridge.notifyNow('rotate')
    bridge.notifyNow('scale')

    expect(received[0]).toEqual({ rotate: 30 })
    expect(received[1]).toEqual({ rotate: 30, scale: { x: 2, y: 2 } })
  })

  it('move puis resize dans la même phase accumule translate + width/height', () => {
    const bridge = createOffsetEditorBridge()
    const received: OffsetValuesPx[] = []
    bridge.onValues((v) => received.push(v))
    bridge.rebind(binding())

    bridge.notifyNow('move')
    bridge.notifyNow('resize')

    expect(received[1]).toEqual({ translate: { x: 42, y: 7 }, width: 300, height: 150 })
  })

  it('un rebind (nouvelle phase, après le rebuild de l\'étape A) repart à zéro', () => {
    const bridge = createOffsetEditorBridge()
    const received: OffsetValuesPx[] = []
    bridge.onValues((v) => received.push(v))
    const b = binding()

    bridge.rebind(b)
    bridge.notifyNow('resize')
    bridge.rebind(b) // simule le rebind systématique après chaque rebuild réel (étape A)
    bridge.notifyNow('move')

    expect(received[received.length - 1]).toEqual({ translate: { x: 42, y: 7 } })
  })

  it('rebind(null) — désélection — n\'émet rien et purge les composants accumulés', () => {
    const bridge = createOffsetEditorBridge()
    const received: OffsetValuesPx[] = []
    bridge.onValues((v) => received.push(v))
    bridge.rebind(binding())
    bridge.notifyNow('resize')

    bridge.rebind(null)
    bridge.notifyNow('move') // aucun binding actif — readActivePose renvoie null, rien émis

    expect(received).toEqual([{ width: 300, height: 150 }])
  })
})

describe('offset-editor-bridge — commitNow/onCommit (2026-07-18-pose-edit-architecture-study.md §7)', () => {
  it('commitNow broadcasts the kind to onCommit subscribers, distinct from notifyNow/onValues', () => {
    const bridge = createOffsetEditorBridge()
    const values: OffsetValuesPx[] = []
    const commits: string[] = []
    bridge.onValues((v) => values.push(v))
    bridge.onCommit((kind) => commits.push(kind))
    bridge.rebind(binding())

    bridge.notifyNow('move')
    expect(commits).toEqual([])

    bridge.commitNow('move')
    expect(commits).toEqual(['move'])
    // commitNow carries no value of its own — the value already reached onValues via notifyNow.
    expect(values).toEqual([{ translate: { x: 42, y: 7 } }])
  })

  it('onCommit returns a working unsubscribe', () => {
    const bridge = createOffsetEditorBridge()
    const commits: string[] = []
    const unsubscribe = bridge.onCommit((kind) => commits.push(kind))

    bridge.commitNow('rotate')
    unsubscribe()
    bridge.commitNow('scale')

    expect(commits).toEqual(['rotate'])
  })
})

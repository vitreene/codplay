import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { decorEditSessionMachine, editRegistryKey, type DecorEditState, type FrameGesture } from '../../src/app/bridges/decor-edit/decor-edit-session-machine'

const GESTURE: FrameGesture = {
  basePx: { x: 10, y: 20, width: 100, height: 50 },
  kind: 'move',
  hasNetDelta: false,
  baseDecorState: null,
  baseAuthorRotate: 0,
  baseAuthorFrame: null,
}

/** Starts the session machine alone. */
function startSession() {
  return createActor(decorEditSessionMachine).start()
}

describe('Decor edit session — frame gesture region', () => {
  it('captures a gesture on its first preview, tracks its net delta and forgets it on release', () => {
    const session = startSession()
    session.send({ type: 'GESTURE_START', gesture: GESTURE })
    expect(session.getSnapshot().matches({ gesture: 'active' })).toBe(true)
    session.send({ type: 'GESTURE_DELTA', hasNetDelta: true })
    expect(session.getSnapshot().context.gesture).toEqual({ ...GESTURE, hasNetDelta: true })
    session.send({ type: 'GESTURE_END' })
    expect(session.getSnapshot().matches({ gesture: 'idle' })).toBe(true)
    expect(session.getSnapshot().context.gesture).toBeNull()
  })

  it('keeps an Escape-cancelled gesture cancelled across a projection reset, until its release', () => {
    const session = startSession()
    session.send({ type: 'GESTURE_START', gesture: GESTURE })
    session.send({ type: 'GESTURE_ESCAPE' })
    expect(session.getSnapshot().context.gesture?.basePx).toEqual(GESTURE.basePx)
    session.send({ type: 'GESTURE_RESET' })
    expect(session.getSnapshot().matches({ gesture: 'cancelled' })).toBe(true)
    expect(session.getSnapshot().context.gesture).toBeNull()
    session.send({ type: 'GESTURE_START', gesture: GESTURE })
    expect(session.getSnapshot().matches({ gesture: 'cancelled' })).toBe(true)
    session.send({ type: 'GESTURE_END' })
    expect(session.getSnapshot().matches({ gesture: 'idle' })).toBe(true)
  })

  it('cancels a pressed pointer before any preview, and resets an active gesture on reprojection', () => {
    const session = startSession()
    session.send({ type: 'GESTURE_ESCAPE' })
    expect(session.getSnapshot().matches({ gesture: 'cancelled' })).toBe(true)
    session.send({ type: 'GESTURE_END' })
    session.send({ type: 'GESTURE_START', gesture: GESTURE })
    session.send({ type: 'GESTURE_RESET' })
    expect(session.getSnapshot().matches({ gesture: 'idle' })).toBe(true)
    expect(session.getSnapshot().context.gesture).toBeNull()
  })
})

const EDIT: DecorEditState = { base: { style: { color: 'red' } }, modifications: new Map([['style.color', 'blue']]) }

describe('Decor edit session — edit region', () => {
  it('is pending exactly while an exact or temporary edit waits for a boundary', () => {
    const session = startSession()
    expect(session.getSnapshot().matches({ edit: 'idle' })).toBe(true)
    session.send({ type: 'EXACT_EDIT_PENDING', commands: [{ name: 'setDecor', args: { decorId: 'decor', patch: { style: { color: 'blue' } } } }] })
    session.send({ type: 'TEMPORARY_EDIT_PENDING', edit: { itemId: 'item', timeMs: 500 } })
    expect(session.getSnapshot().matches({ edit: 'pending' })).toBe(true)
    session.send({ type: 'PENDING_DISCARDED', temporary: false })
    expect(session.getSnapshot().matches({ edit: 'pending' })).toBe(true)
    session.send({ type: 'TEMPORARY_DISCARDED' })
    expect(session.getSnapshot().matches({ edit: 'idle' })).toBe(true)
  })

  it('forgets the registry entry of a flushed temporary edit and keeps the others', () => {
    const session = startSession()
    session.send({ type: 'REGISTRY_SET', key: editRegistryKey('item', 500), state: EDIT })
    session.send({ type: 'REGISTRY_SET', key: editRegistryKey('other', 500), state: EDIT })
    session.send({ type: 'TEMPORARY_EDIT_PENDING', edit: { itemId: 'item', timeMs: 500 } })
    session.send({ type: 'FLUSHED' })
    const { registry, pendingTemporary } = session.getSnapshot().context
    expect([...registry.keys()]).toEqual([editRegistryKey('other', 500)])
    expect(pendingTemporary).toBeNull()
    expect(session.getSnapshot().matches({ edit: 'idle' })).toBe(true)
  })

  it('clears a temporary edit at the same author time, within one millisecond', () => {
    const session = startSession()
    session.send({ type: 'TEMPORARY_EDIT_PENDING', edit: { itemId: 'item', timeMs: 500 } })
    session.send({ type: 'TEMPORARY_CLEARED', itemId: 'item', timeMs: 500.6 })
    expect(session.getSnapshot().context.pendingTemporary).toBeNull()
    expect(session.getSnapshot().matches({ edit: 'idle' })).toBe(true)
  })

  it('keeps exact pending commands across Undo/Redo, and empties everything on abort', () => {
    const session = startSession()
    session.send({ type: 'REGISTRY_SET', key: editRegistryKey('item', 0), state: EDIT })
    session.send({ type: 'EXACT_EDIT_PENDING', commands: [{ name: 'setDecor', args: { decorId: 'decor', patch: {} } }] })
    session.send({ type: 'TEMPORARY_EDIT_PENDING', edit: { itemId: 'item', timeMs: 500 } })
    session.send({ type: 'REVERTED' })
    expect(session.getSnapshot().context.registry.size).toBe(0)
    expect(session.getSnapshot().context.pendingTemporary).toBeNull()
    expect(session.getSnapshot().matches({ edit: 'pending' })).toBe(true)
    session.send({ type: 'ABORTED' })
    expect(session.getSnapshot().context.pendingCommands).toBeNull()
    expect(session.getSnapshot().matches({ edit: 'idle' })).toBe(true)
  })
})

const FRAME = { x: 1, y: 2, width: 30, height: 40 }
const OTHER_FRAME = { x: 5, y: 6, width: 30, height: 40 }

describe('Decor edit session — presentation region', () => {
  it('waits for the presentation only when a committed preview is shown', () => {
    const session = startSession()
    session.send({ type: 'COMMIT_SENT', fallback: FRAME })
    expect(session.getSnapshot().matches({ presentation: 'live' })).toBe(true)
    expect(session.getSnapshot().context.commitCandidate).toBeNull()
    session.send({ type: 'PREVIEW_APPLIED', accepted: true })
    session.send({ type: 'COMMIT_SENT', fallback: FRAME })
    expect(session.getSnapshot().matches({ presentation: 'awaitingPresentation' })).toBe(true)
    expect(session.getSnapshot().context.commitCandidate).toEqual(FRAME)
  })

  it('keeps the candidate the gesture released, and settles once the player presents it', () => {
    const session = startSession()
    session.send({ type: 'PREVIEW_APPLIED', accepted: true })
    session.send({ type: 'COMMIT_CANDIDATE', candidate: OTHER_FRAME })
    session.send({ type: 'COMMIT_SENT', fallback: FRAME })
    expect(session.getSnapshot().context.commitCandidate).toEqual(OTHER_FRAME)
    session.send({ type: 'PRESENTATION_SETTLED' })
    expect(session.getSnapshot().matches({ presentation: 'live' })).toBe(true)
    expect(session.getSnapshot().context.commitCandidate).toBeNull()
  })

  it('exposes the result of the latest Decor preview synchronously', () => {
    const session = startSession()
    session.send({ type: 'DECOR_PREVIEW_REQUESTED' })
    expect(session.getSnapshot().context.lastPreviewAccepted).toBe(false)
    session.send({ type: 'DECOR_PREVIEWED', accepted: true })
    expect(session.getSnapshot().context.lastPreviewAccepted).toBe(true)
    session.send({ type: 'PREVIEW_APPLIED', accepted: false })
    expect(session.getSnapshot().context.previewActive).toBe(false)
    session.send({ type: 'PREVIEW_APPLIED', accepted: true })
    session.send({ type: 'PREVIEW_CLEARED' })
    expect(session.getSnapshot().context.previewActive).toBe(false)
  })
})

describe('Decor edit session — projection region', () => {
  it('follows the presented time after a seek and the selection after a deliberate selection', () => {
    const session = startSession()
    expect(session.getSnapshot().matches({ projection: 'followsSelection' })).toBe(true)
    session.send({ type: 'PROJECTION_FOLLOWS_TIME' })
    expect(session.getSnapshot().matches({ projection: 'followsTime' })).toBe(true)
    session.send({ type: 'PROJECTION_FOLLOWS_SELECTION' })
    expect(session.getSnapshot().matches({ projection: 'followsSelection' })).toBe(true)
  })
})

import { assign, setup } from 'xstate'
import type { SelectionFrameDelta } from '@codplay/selection-frame/v2'
import type { DecorPatch, SelectionFrameValue } from '../../../decor-editor/types'
import type { DecorModificationMap } from '../../../decor-editor/modified-properties'
import type { Command } from '../../controller/types'
import { isSameAuthorTime } from '../../config/author-time'

/**
 * Session of one Decor edit, shared by the palette and the Selection Frame
 * (`plan/2026-11-24-revue-interface-items-plan.md`, étape 3d). The machine holds the phases and
 * the edit data; projections, DOM and document effects stay in the bridge. `send` is synchronous,
 * so an author intention reaches the item in the same turn.
 */

/** Sparse edit registry entry: the immutable base of an edit and the properties the author changed. */
export type DecorEditState = Readonly<{ base: DecorPatch; modifications: DecorModificationMap }>

/** Temporary edit between two keyframes, committed as one new keyframe at the next boundary. */
export type PendingTemporaryEdit = Readonly<{ itemId: string; timeMs: number }>

/** One Selection Frame gesture, captured on its first preview. */
export type FrameGesture = Readonly<{
  /** Displayed frame at the start of the gesture, in scene pixels. */
  basePx: SelectionFrameValue
  kind: SelectionFrameDelta['kind']
  /** Whether the latest candidate differs from the start (a click commits nothing). */
  hasNetDelta: boolean
  /** Edit registry entry before the gesture, restored when the gesture is abandoned. */
  baseDecorState: DecorEditState | null
  /** Authored rotation shown at the start of the gesture. */
  baseAuthorRotate: number
  /** Authored frame at the start of the gesture, when the projection has one. */
  baseAuthorFrame: SelectionFrameValue | null
}>

export type DecorEditSessionContext = Readonly<{
  /** Current frame gesture; also kept while a cancelled gesture waits for its release. */
  gesture: FrameGesture | null
  /** Sparse edit registry, by item and author time (`editRegistryKey`). */
  registry: ReadonlyMap<string, DecorEditState>
  /** Commands of an edit on a real decor, committed at the next boundary. */
  pendingCommands: readonly Command[] | null
  /** Edit between two keyframes, committed at the next boundary as a new keyframe. */
  pendingTemporary: PendingTemporaryEdit | null
  /** Whether a preview patch is applied to the runtime snapshot. */
  previewActive: boolean
  /**
   * Result of the latest Decor preview. A frame gesture reads it right after `applyPatch`, whose
   * `onDecorChange` previews synchronously: palette and frame share this one circuit.
   */
  lastPreviewAccepted: boolean
  /** Displayed frame kept authoritative after a commit, until the rebuilt player presents it. */
  commitCandidate: SelectionFrameValue | null
}>

export type DecorEditSessionEvent =
  /** First preview of a frame gesture. */
  | { type: 'GESTURE_START'; gesture: FrameGesture }
  /** A later preview: whether the candidate still differs from the start. */
  | { type: 'GESTURE_DELTA'; hasNetDelta: boolean }
  /** Escape while the pointer is down: further previews are ignored until release. */
  | { type: 'GESTURE_ESCAPE' }
  /** The projection was recomputed under the gesture: its captured base is obsolete. */
  | { type: 'GESTURE_RESET' }
  /** Pointer released or cancelled, or frame unmounted: the gesture is over. */
  | { type: 'GESTURE_END' }
  /** Records (or, with `state: null`, removes) one registry entry. */
  | { type: 'REGISTRY_SET'; key: string; state: DecorEditState | null }
  /** An edit on a real decor waits for the next boundary. */
  | { type: 'EXACT_EDIT_PENDING'; commands: readonly Command[] }
  /** An edit between two keyframes waits for the next boundary. */
  | { type: 'TEMPORARY_EDIT_PENDING'; edit: PendingTemporaryEdit }
  /** The author undid the change: nothing remains to commit (the temporary edit too, when told). */
  | { type: 'PENDING_DISCARDED'; temporary: boolean }
  /** The pending temporary edit is abandoned or was committed by another path. */
  | { type: 'TEMPORARY_DISCARDED' }
  /** One temporary edit was committed or consumed: its registry entry and pending state go. */
  | { type: 'TEMPORARY_CLEARED'; itemId: string; timeMs: number }
  /** The pending edits were taken for commit by the bridge. */
  | { type: 'FLUSHED' }
  /** The edit phase was abandoned: nothing pending, empty registry. */
  | { type: 'ABORTED' }
  /** The document was restored by Undo/Redo: temporary edits and registry no longer apply. */
  | { type: 'REVERTED' }
  /** A Decor preview is about to run; its result arrives with `DECOR_PREVIEWED`. */
  | { type: 'DECOR_PREVIEW_REQUESTED' }
  /** Result of the Decor preview requested by the latest change. */
  | { type: 'DECOR_PREVIEWED'; accepted: boolean }
  /** A patch was sent to the runtime snapshot. */
  | { type: 'PREVIEW_APPLIED'; accepted: boolean }
  /** The runtime preview was cleared. */
  | { type: 'PREVIEW_CLEARED' }
  /** The frame to keep shown after a commit (or none). */
  | { type: 'COMMIT_CANDIDATE'; candidate: SelectionFrameValue | null }
  /** A commit was sent while a preview shows: keep it (with `fallback` as candidate) until presented. */
  | { type: 'COMMIT_SENT'; fallback: SelectionFrameValue | null }
  /** The rebuilt player presents the document, or a seek replaced the presented time. */
  | { type: 'PRESENTATION_SETTLED' }
  /** The author seeks: the frame follows the presented time, even if a keyframe stays selected. */
  | { type: 'PROJECTION_FOLLOWS_TIME' }
  /** A deliberate selection (or a new document) re-establishes its own target. */
  | { type: 'PROJECTION_FOLLOWS_SELECTION' }

/** Registry key of one item at one author time. */
export function editRegistryKey(itemId: string, timeMs: number): string {
  return `${itemId}\u0000${timeMs}`
}

/** Registry without one entry. */
function withoutEntry(registry: ReadonlyMap<string, DecorEditState>, key: string): ReadonlyMap<string, DecorEditState> {
  if (!registry.has(key)) return registry
  const next = new Map(registry)
  next.delete(key)
  return next
}

export const decorEditSessionMachine = setup({
  types: {
    context: {} as DecorEditSessionContext,
    events: {} as DecorEditSessionEvent,
  },
  actions: {
    clearGesture: assign({ gesture: null }),
    clearPending: assign({ pendingCommands: null, pendingTemporary: null }),
  },
  guards: {
    nothingPending: ({ context }) => context.pendingCommands === null && context.pendingTemporary === null,
  },
}).createMachine({
  id: 'decorEditSession',
  context: {
    gesture: null,
    registry: new Map(),
    pendingCommands: null,
    pendingTemporary: null,
    previewActive: false,
    lastPreviewAccepted: false,
    commitCandidate: null,
  },
  type: 'parallel',
  states: {
    gesture: {
      initial: 'idle',
      on: {
        GESTURE_END: { target: '.idle', actions: 'clearGesture' },
      },
      states: {
        idle: {
          on: {
            GESTURE_START: { target: 'active', actions: assign({ gesture: ({ event }) => event.gesture }) },
            GESTURE_ESCAPE: 'cancelled',
          },
        },
        active: {
          on: {
            GESTURE_DELTA: {
              actions: assign({
                gesture: ({ context, event }) => context.gesture === null ? null : { ...context.gesture, hasNetDelta: event.hasNetDelta },
              }),
            },
            GESTURE_ESCAPE: 'cancelled',
            GESTURE_RESET: { target: 'idle', actions: 'clearGesture' },
          },
        },
        cancelled: {
          on: {
            GESTURE_RESET: { actions: 'clearGesture' },
          },
        },
      },
    },
    edit: {
      initial: 'idle',
      on: {
        REGISTRY_SET: {
          actions: assign({
            registry: ({ context, event }) => event.state === null
              ? withoutEntry(context.registry, event.key)
              : new Map(context.registry).set(event.key, event.state),
          }),
        },
        EXACT_EDIT_PENDING: { target: '.pending', actions: assign({ pendingCommands: ({ event }) => event.commands }) },
        TEMPORARY_EDIT_PENDING: { target: '.pending', actions: assign({ pendingTemporary: ({ event }) => event.edit }) },
        PENDING_DISCARDED: {
          target: '.pending',
          actions: assign({
            pendingCommands: null,
            pendingTemporary: ({ context, event }) => event.temporary ? null : context.pendingTemporary,
          }),
        },
        TEMPORARY_DISCARDED: { target: '.pending', actions: assign({ pendingTemporary: null }) },
        TEMPORARY_CLEARED: {
          target: '.pending',
          actions: assign({
            registry: ({ context, event }) => withoutEntry(context.registry, editRegistryKey(event.itemId, event.timeMs)),
            pendingTemporary: ({ context, event }) => context.pendingTemporary?.itemId === event.itemId
              && isSameAuthorTime(context.pendingTemporary.timeMs, event.timeMs)
              ? null
              : context.pendingTemporary,
          }),
        },
        FLUSHED: {
          target: '.idle',
          actions: assign({
            registry: ({ context }) => context.pendingTemporary === null
              ? context.registry
              : withoutEntry(context.registry, editRegistryKey(context.pendingTemporary.itemId, context.pendingTemporary.timeMs)),
            pendingCommands: null,
            pendingTemporary: null,
          }),
        },
        ABORTED: { target: '.idle', actions: [assign({ registry: new Map() }), 'clearPending'] },
        REVERTED: { target: '.pending', actions: assign({ registry: new Map(), pendingTemporary: null }) },
      },
      states: {
        idle: {},
        /** Something waits for the next edit boundary; back to `idle` as soon as nothing does. */
        pending: {
          always: { guard: 'nothingPending', target: 'idle' },
        },
      },
    },
    projection: {
      initial: 'followsSelection',
      on: {
        PROJECTION_FOLLOWS_TIME: '.followsTime',
        PROJECTION_FOLLOWS_SELECTION: '.followsSelection',
      },
      states: {
        followsSelection: {},
        followsTime: {},
      },
    },
    presentation: {
      initial: 'live',
      on: {
        DECOR_PREVIEW_REQUESTED: { actions: assign({ lastPreviewAccepted: false }) },
        DECOR_PREVIEWED: { actions: assign({ lastPreviewAccepted: ({ event }) => event.accepted }) },
        PREVIEW_APPLIED: { actions: assign({ previewActive: ({ context, event }) => context.previewActive || event.accepted }) },
        PREVIEW_CLEARED: { actions: assign({ previewActive: false }) },
        COMMIT_CANDIDATE: { actions: assign({ commitCandidate: ({ event }) => event.candidate }) },
        PRESENTATION_SETTLED: { target: '.live', actions: assign({ commitCandidate: null }) },
      },
      states: {
        live: {
          on: {
            COMMIT_SENT: {
              guard: ({ context }) => context.previewActive,
              target: 'awaitingPresentation',
              actions: assign({ commitCandidate: ({ context, event }) => context.commitCandidate ?? event.fallback }),
            },
          },
        },
        /** A commit was sent while a preview shows; the preview stays until the player presents it. */
        awaitingPresentation: {
          on: {
            COMMIT_SENT: {
              guard: ({ context }) => context.previewActive,
              actions: assign({ commitCandidate: ({ context, event }) => context.commitCandidate ?? event.fallback }),
            },
          },
        },
      },
    },
  },
})

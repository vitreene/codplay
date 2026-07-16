import { createMachine } from 'xstate'

/**
 * One gesture kind's vocabulary: the state entered while it runs, and the
 * events that start/end it. Kept as data (not a hardcoded union) so the same
 * generator produces `csMachine`'s `dragging`/`resizing`/`rotating` and
 * `zoneMachine`'s `moving`/`resizing`/`tracing` — the two were the same
 * machine, hand-derived twice
 * (`2026-07-16-gesture-rebuild-ordering-plan.md` §3.2).
 */
export type GestureKindConfig = {
  /** Stable short id callers use, e.g. `'drag'` — never sent to the machine itself. */
  kind: string
  /** State name entered while this gesture is active, e.g. `'dragging'`. */
  state: string
  /** Event type that starts it, e.g. `'DRAG_START'`. */
  startEvent: string
  /** Event type that ends it, e.g. `'DRAG_END'`. */
  endEvent: string
}

/**
 * `idle ─▶ active(still / <gesture>) ⇄ suspended`, the skeleton shared by
 * every authoring tool's node-lifecycle machine. No capability guard lives
 * here: per-tool capability logic (e.g. `SelectionFrame`'s move/resize/
 * rotate presets, `machine.ts`'s `canMove`/`canResize`/`canRotate`) stays the
 * caller's responsibility — it decides whether to send a `startEvent` at
 * all, this machine never refuses one once sent. `NODE_DISAPPEARED` is
 * declared on the parent `active` state, so it interrupts any gesture
 * sub-state uniformly, matching `csMachine`/`zoneMachine`'s existing
 * behavior exactly.
 *
 * Built from a runtime list rather than a literal state config: XState's own
 * typing can't express a state tree shaped by a variable-length list, so the
 * returned machine's event/state types are intentionally loose (`string`)
 * here — callers that need precise typing wrap this with their own event
 * union, the way `machine.ts`/`zone-machine.ts` do once migrated onto it.
 */
export function createGestureLifecycleMachine(gestureKinds: readonly GestureKindConfig[]) {
  const activeStates: Record<string, unknown> = {
    still: {
      on: Object.fromEntries(gestureKinds.map((kind) => [kind.startEvent, { target: kind.state }]))
    }
  }

  for (const kind of gestureKinds) {
    activeStates[kind.state] = {
      on: { [kind.endEvent]: { target: 'still' } }
    }
  }

  return createMachine({
    id: 'gesture-lifecycle',
    initial: 'idle',
    states: {
      idle: {
        on: { NODE_APPEARED: { target: 'active' } }
      },
      active: {
        initial: 'still',
        on: { NODE_DISAPPEARED: { target: 'suspended' } },
        states: activeStates
      },
      suspended: {
        on: { NODE_APPEARED: { target: 'active' } }
      }
    }
  } as Parameters<typeof createMachine>[0])
}

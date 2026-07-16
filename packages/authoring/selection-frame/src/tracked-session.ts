import { createActor, type Actor } from 'xstate'

import type { AuthorApi } from './author-api'
import { createTrackedNodes } from './tracked-nodes'
import { createGestureLifecycleMachine, type GestureKindConfig } from './gesture-lifecycle-machine'

/**
 * Common surface of both session flavors (`2026-07-16-authoring-shared-
 * tracking-layer-plan.md` §2.1) — the single decision point every consuming
 * module must gate its DOM effects on, replacing five independent, ad hoc
 * re-derivations of "is it safe to act on this node right now".
 */
export type TrackedTarget = {
  getNode(persoId: string): Element | null
  /**
   * True iff every tracked node is present AND currently connected — checked
   * live on every call, never cached from the last notification (see
   * `tracked-nodes.ts` for why a notification can legitimately arrive before
   * the node is connected).
   */
  canAct(): boolean
  /** Fires on any change relevant to `canAct()` — node lifecycle or gesture lifecycle. */
  subscribe(cb: () => void): () => void
  destroy(): void
}

export type MinimalAnchorOptions = {
  authorApi: AuthorApi
  persoIds: readonly string[]
}

/**
 * Ancrage minimal (§2.1): node tracking + `canAct`, no gesture sub-states.
 * For tools with no continuous gesture of their own — `FlexAnchorTool`
 * (click-only) and `LibreAdapter` (executes deltas produced by another
 * module's full session; it has no gesture of its own to declare, only a
 * question to ask before each `applyMove`/`applyResize`/`applyRotate`).
 */
export function createMinimalAnchor(options: MinimalAnchorOptions): TrackedTarget {
  const nodes = createTrackedNodes(options.authorApi, options.persoIds)

  return {
    getNode: (persoId) => nodes.getNode(persoId),
    canAct: () => nodes.allConnected(),
    subscribe: (cb) => nodes.subscribe(cb),
    destroy: () => nodes.destroy()
  }
}

export type TrackedSessionOptions = {
  authorApi: AuthorApi
  persoIds: readonly string[]
  gestureKinds: readonly GestureKindConfig[]
  /**
   * Per-tool capability guard (e.g. `SelectionFrame`'s move/resize/rotate
   * presets, today's `canMove`/`canResize`/`canRotate` XState guards on
   * `machine.ts`). Absent = always allowed (`ZoneEditor`/
   * `MultiSelectionFrame` today have no such guard). The skeleton itself
   * never refuses a gesture — see `gesture-lifecycle-machine.ts`.
   */
  canStartGesture?: (kind: string) => boolean
}

export type TrackedSession = TrackedTarget & {
  /** True iff some gesture kind is currently active. */
  isGestureActive(): boolean
  /** Attempts to start one declared gesture kind; returns whether it was allowed to (capability guard + node present). */
  startGesture(kind: string): boolean
  endGesture(kind: string): void
  /**
   * Fires whenever the session is interrupted mid-gesture by the node
   * disappearing (transition into `suspended`) — the abort signal
   * `gesture-session.ts`'s pointer sessions must consult (§2.5), on top of
   * their existing native pointer-event channels, never in place of them.
   */
  onSuspend(cb: () => void): () => void
}

/**
 * Session complète (§2.1): node tracking + the shared gesture-lifecycle
 * machine (`idle → active(still/<gesture>) ⇄ suspended`). For
 * `SelectionFrame`, `MultiSelectionFrame`, `ZoneEditor` — one instance can
 * track 1..N `persoIds` (a multi-selection is one session over N tracked
 * nodes, not N sessions — `2026-07-16-gesture-rebuild-ordering-plan.md` §4,
 * "Une session par outil actif, portant 1..N cibles suivies").
 */
export function createTrackedSession(options: TrackedSessionOptions): TrackedSession {
  const nodes = createTrackedNodes(options.authorApi, options.persoIds)
  const machine = createGestureLifecycleMachine(options.gestureKinds)
  const kindByName = new Map(options.gestureKinds.map((k) => [k.kind, k]))

  const actor: Actor<typeof machine> = createActor(machine)
  const listeners = new Set<() => void>()
  const suspendListeners = new Set<() => void>()

  let wasSuspended = false

  const notify = (): void => {
    for (const cb of listeners) cb()
  }

  // The only place snapshot transitions are observed — detects a suspend
  // edge for `onSuspend`, nothing else. General change notification
  // (`notify`) is driven explicitly by whichever call caused it
  // (`syncPresence`/`startGesture`/`endGesture`), not by this subscription,
  // to avoid a double notify when a node change also flips presence.
  actor.subscribe((snapshot) => {
    const isSuspended = snapshot.matches('suspended')
    if (isSuspended && !wasSuspended) {
      for (const cb of suspendListeners) cb()
    }
    wasSuspended = isSuspended
  })

  const syncPresence = (): void => {
    // Raw presence (node !== null), not connectedness: codplay's own render
    // pass routinely notifies with a not-yet-connected node (tracked-nodes.ts)
    // — gating presence on `isConnected` here would flip active→suspended→
    // active on every rebuild even when nothing structurally changed for
    // this item. `canAct()` is where connectedness is actually checked,
    // live, at the moment a consumer wants to act — not here.
    const present = options.persoIds.some((id) => nodes.getNode(id) !== null)
    actor.send({ type: present ? 'NODE_APPEARED' : 'NODE_DISAPPEARED' })
  }

  actor.start()
  syncPresence()

  const unsubscribeNodes = nodes.subscribe(() => {
    syncPresence()
    notify()
  })

  return {
    getNode: (persoId) => nodes.getNode(persoId),
    canAct: () => nodes.allConnected() && !actor.getSnapshot().matches('suspended'),
    isGestureActive: () => {
      const snapshot = actor.getSnapshot()
      return snapshot.matches('active') && !snapshot.matches({ active: 'still' })
    },
    startGesture: (kind) => {
      const config = kindByName.get(kind)
      if (config === undefined) return false
      if (options.canStartGesture?.(kind) === false) return false
      actor.send({ type: config.startEvent })
      const started = actor.getSnapshot().matches({ active: config.state })
      if (started) notify()
      return started
    },
    endGesture: (kind) => {
      const config = kindByName.get(kind)
      if (config === undefined) return
      actor.send({ type: config.endEvent })
      notify()
    },
    subscribe: (cb) => {
      // Fires immediately with the current state — same contract as
      // tracked-nodes.ts's own subscribe, for the same reason: a late
      // subscriber onto an already-populated session must not miss it.
      listeners.add(cb)
      cb()
      return () => {
        listeners.delete(cb)
      }
    },
    onSuspend: (cb) => {
      suspendListeners.add(cb)
      return () => {
        suspendListeners.delete(cb)
      }
    },
    destroy: () => {
      unsubscribeNodes()
      nodes.destroy()
      actor.stop()
      listeners.clear()
      suspendListeners.clear()
    }
  }
}

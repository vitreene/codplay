import type { AuthorApi } from './author-api'

/**
 * Tracks the live DOM node(s) behind one or more persoIds via
 * `authorApi.subscribeToNode`. Raw references are never filtered by
 * connectedness at notify time: codplay's `render()` applies style before a
 * node is attached to the document (loadPersos runs its style pass before
 * any move/attach pass — see `docs/formalisation/v1-component-api.md` and
 * `2026-07-16-container-query-resolution-spec.md`), so a `subscribeToNode`
 * callback routinely delivers a node that is not yet connected. A second,
 * corrective notification always follows once the tree is actually attached
 * — ed2's `scene-player-bridge.ts::rebuild()` runs an explicit `seek()`
 * right after every `load()`, which re-triggers `loadPersos()` (a refresh
 * pass, same node object reused in place) against the now-attached tree.
 * Filtering the raw reference here at notify time would discard that node
 * permanently instead of waiting one tick for the follow-up notification
 * that already carries the correct, connected one — `isConnected` must be
 * checked live, at the moment a consumer actually wants to act (`canAct` in
 * `tracked-session.ts`), never cached from the notification itself.
 */
export type TrackedNodes = {
  /** Raw node last delivered for this id — may be non-null yet not yet connected. */
  getNode(persoId: string): Element | null
  /** True once every tracked id currently has a connected node. */
  allConnected(): boolean
  /** True once at least one tracked id currently has a connected node (the multi-target aggregate `multi-selection-frame.ts:193` computes by hand today as `anyPresent`). */
  anyConnected(): boolean
  /**
   * Fires once immediately with the current state on subscription — matching
   * `authorApi.subscribeToNode`'s own contract — then again on every raw
   * `subscribeToNode` callback for any tracked id, not only when the
   * reference actually changes. Two reasons both matter: a late subscriber
   * onto an anchor another module already constructed (e.g. `SelectionFrame`
   * subscribing to an anchor `LibreAdapter` built and populated first — same
   * shared instance, `2026-07-16-authoring-shared-tracking-layer-plan.md`
   * §3 Étape 2) must not miss the state that arrived before it subscribed; a
   * refresh pass can also renotify with the SAME node object once it becomes
   * connected (`buildNode` preserves node identity on refresh), which a
   * listener firing only on reference change would miss entirely.
   */
  subscribe(cb: () => void): () => void
  destroy(): void
}

/**
 * Creates one node tracker for `persoIds`. Shared by both session flavors
 * (`tracked-session.ts`) — the only piece two flavors both need.
 */
export function createTrackedNodes(authorApi: AuthorApi, persoIds: readonly string[]): TrackedNodes {
  const nodeById = new Map<string, Element | null>()
  const listeners = new Set<() => void>()

  for (const persoId of persoIds) {
    nodeById.set(persoId, null)
  }

  const notify = (): void => {
    for (const cb of listeners) cb()
  }

  const isConnected = (persoId: string): boolean => {
    const node = nodeById.get(persoId) ?? null
    return node !== null && node.isConnected
  }

  const unsubscribers = persoIds.map((persoId) =>
    authorApi.subscribeToNode(persoId, (node) => {
      nodeById.set(persoId, node)
      notify()
    })
  )

  return {
    getNode: (persoId) => nodeById.get(persoId) ?? null,
    allConnected: () => persoIds.every(isConnected),
    anyConnected: () => persoIds.some(isConnected),
    subscribe: (cb) => {
      listeners.add(cb)
      cb()
      return () => {
        listeners.delete(cb)
      }
    },
    destroy: () => {
      for (const unsubscribe of unsubscribers) unsubscribe()
      listeners.clear()
    }
  }
}

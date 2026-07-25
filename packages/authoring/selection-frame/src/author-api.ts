import type { NodePose, PlayerApi } from 'codplay/player/player'

export type { NodePose }

/**
 * Player state slice exposed to authoring modules (v1-author-api-spec).
 */
export type PlayerAuthorState = {
  isPlaying: boolean
}

/**
 * Contract through which authoring modules interact with a codplay player.
 * Wraps PlayerApi without codplay knowing authoring exists; authoring
 * modules must depend on this surface, never on PlayerApi directly.
 */
export type AuthorApi = {
  subscribeToNode: (persoId: string, cb: (node: Element | null) => void) => () => void
  /**
   * Reads the pose anime.js currently resolves for a node — the only
   * correct source, since anime freely chooses its own DOM representation
   * (discrete CSS properties or a composed `transform`) and that choice can
   * change across a rebuild (v1-author-api-spec.md). Never reconstruct a
   * pose from getComputedStyle in authoring code — use this instead.
   */
  getNodePose: (persoId: string) => NodePose | null
  /**
   * Write-side symmetry of `getNodePose` — routes a partial pose through anime.js's own bookkeeping
   * (`utils.set`) instead of writing `node.style.*` directly. Authoring code must never write pose
   * properties straight onto the node: anime.js composes `x`/`y`/`rotate`/`scaleX`/`scaleY` into
   * `style.transform`, never into the discrete CSS properties (`style.translate`/`.rotate`/
   * `.scale`) — a direct write to those discrete properties does not replace what anime.js holds,
   * it accumulates alongside it the next time anime.js writes (confirmed: CSS `transform` and the
   * discrete transform properties compose additively). Only the keys present in `pose` are
   * touched. No-op when the perso has no node mounted.
   */
  setNodePose: (persoId: string, pose: Partial<NodePose>) => void
  /**
   * Generalization of `getNodePose` beyond its fixed 7-property pose vocabulary — reads whatever
   * properties the caller asks for, straight from anime.js's own bookkeeping (`utils.get`, never
   * `getComputedStyle`). Values are returned AS-IS: a color comes back as a CSS string
   * (`"oklch(...)"`), a length outside anime's own pose vocabulary comes back px-suffixed
   * (`"8.52px"`) — no `Number()` coercion, unlike `getNodePose`.
   *
   * NOT gesture-safe: while a CS gesture is active on this node, `LibreAdapter` writes pose
   * directly to the node, bypassing `utils.set` — anime's cache (what this reads) is stale until
   * the next rebuild. Callers must gate on `session.isGestureActive()` themselves, same as
   * `offset-editor-bridge.ts::readLiveGestureNodePose` already does for pose.
   */
  getNodeSnapshot: (persoId: string, props: readonly string[]) => Record<string, string | number> | null
  /**
   * Returns the state of every currently-animated perso, captured at the last `seek()` — in the
   * perso's OWN unit as authored (e.g. `cqw`, or a bare number for properties with no unit), never
   * read from the DOM/anime.js's cache tied to a real node (`2026-07-25-perso-state-at-t-plan.md`,
   * `packages/codplay`). Unlike `getNodeSnapshot`, this never depends on a node being mounted, and
   * never needs a per-perso call — a caller with a multi-item selection filters the map itself.
   */
  getPersoStates: () => ReadonlyMap<string, Record<string, unknown>>
  subscribeToPlayerState: (cb: (state: PlayerAuthorState) => void) => () => void
  getPlayerState: () => PlayerAuthorState
}

function toAuthorState(status: string): PlayerAuthorState {
  return { isPlaying: status === 'playing' }
}

export function createAuthorApi(player: PlayerApi): AuthorApi {
  return {
    subscribeToNode: (persoId, cb) => player.subscribeToNode(persoId, cb),

    getNodePose: (persoId) => player.getNodePose(persoId),

    setNodePose: (persoId, pose) => player.setNodePose(persoId, pose),

    getNodeSnapshot: (persoId, props) => player.getNodeSnapshot(persoId, props),

    getPersoStates: () => player.getPersoStates(),

    subscribeToPlayerState: (cb) => {
      let last = toAuthorState(player.getState().status)
      cb(last)
      return player.onChange((snapshot) => {
        const next = toAuthorState(snapshot.status)
        if (next.isPlaying === last.isPlaying) {
          return
        }
        last = next
        cb(next)
      })
    },

    getPlayerState: () => toAuthorState(player.getState().status)
  }
}

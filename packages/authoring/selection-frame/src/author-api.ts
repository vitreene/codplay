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

    getNodeSnapshot: (persoId, props) => player.getNodeSnapshot(persoId, props),

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

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

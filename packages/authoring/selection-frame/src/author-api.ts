import type { PlayerApi } from 'codplay/player/player'

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
  subscribeToPlayerState: (cb: (state: PlayerAuthorState) => void) => () => void
  getPlayerState: () => PlayerAuthorState
}

function toAuthorState(status: string): PlayerAuthorState {
  return { isPlaying: status === 'playing' }
}

export function createAuthorApi(player: PlayerApi): AuthorApi {
  return {
    subscribeToNode: (persoId, cb) => player.subscribeToNode(persoId, cb),

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

import type { StrapFn } from "codplay/player/strap-types"

/** Scene-level `game:extra:collect` handler: grants one retry token, ignores re-collection. */
export const gameExtraCollectStrap: StrapFn = ({ state }) => {
  if (state.extraToken === true) {
    return undefined
  }

  return {
    update: { extraToken: true },
    events: [{ name: "game:extra:inventory:collect" }]
  }
}

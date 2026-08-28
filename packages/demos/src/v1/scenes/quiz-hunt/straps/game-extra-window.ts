import type { StrapFn } from "codplay-v1/player/strap-types"

/** Routes the extra token visibility window without rehiding a token already collected. */
export const gameExtraWindowStrap: StrapFn = ({ event, state }) => {
  if (event.name === "game:extra:window:show") {
    if (state.extraToken === true) {
      return undefined
    }

    return { events: [{ name: "game:extra:token:show", data: event.data }] }
  }

  if (event.name === "game:extra:window:hide") {
    if (state.extraToken === true) {
      return undefined
    }

    return { events: [{ name: "game:extra:token:hide" }] }
  }

  return undefined
}

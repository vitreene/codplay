import type { StrapFn } from "codplay/player/strap-types"

/**
 * Scene-level `game:final:start` handler: guards on a full basket, stops the timer,
 * and reveals the final story for whichever word ended up filling the seed-drawn color.
 */
export function createGameFinalRouteStrap(finalColor: string, colors: string[]): StrapFn {
  return ({ state }) => {
    const basket = (state.basket as Record<string, { wordId: string; wordLabel: string } | null> | undefined) ?? {}
    const basketComplete = colors.every((color) => basket[color] !== null && basket[color] !== undefined)
    if (!basketComplete) {
      return undefined
    }

    const finalWordId = basket[finalColor]?.wordId
    if (finalWordId === undefined) {
      return undefined
    }

    return {
      update: { phase: "final" },
      events: [
        { name: "game:timer:stop" },
        { name: "game:grid:hide" },
        { name: `game:final:${finalWordId}:show` }
      ]
    }
  }
}

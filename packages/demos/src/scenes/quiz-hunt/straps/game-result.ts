import type { StrapFn } from "codplay/player/strap-types"

/**
 * Scene-level handler for final win/loss panels and timer expiry.
 * Builds the structured `game:result:show` payload plus the display-ready text events.
 */
export function createGameResultStrap(totalMs: number, colors: string[]): StrapFn {
  return ({ event, state }) => {
    if (event.name !== "game:final:won" && event.name !== "game:final:lost" && event.name !== "game:timer:expired") {
      return undefined
    }

    const passed = event.name === "game:final:won"
    const basket = (state.basket as Record<string, { wordId: string; wordLabel: string } | null> | undefined) ?? {}
    const foundCount = colors.filter((color) => basket[color] !== null && basket[color] !== undefined).length
    const remaining = typeof state.timerRemainingMs === "number" ? state.timerRemainingMs : totalMs
    const timerUsedMs = Math.max(0, totalMs - remaining)
    const minutes = Math.floor(timerUsedMs / 60000)
    const seconds = Math.floor((timerUsedMs % 60000) / 1000)
    const timeText = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

    return {
      update: { phase: "result" },
      events: [
        { name: "game:result:show", data: { passed, basket, timerUsedMs } },
        { name: passed ? "game:result:verdict:passed" : "game:result:verdict:failed" },
        { name: "game:result:summary", data: { content: `${foundCount} / ${colors.length} couleurs trouvées` } },
        { name: "game:result:time", data: { content: timeText } }
      ]
    }
  }
}

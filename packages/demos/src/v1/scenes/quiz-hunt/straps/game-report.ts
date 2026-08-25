import type { StrapFn } from "codplay/player/strap-types"

/**
 * Scene-level side-effect strap: reports the finished game session. V1 demo logs to
 * the console — a real deployment would replace the body with a `fetch` call.
 */
export function createGameReportStrap(seed: number): StrapFn {
  return ({ event }) => {
    console.log("[quiz-hunt] game finished", { ...event.data, seed })
    return undefined
  }
}

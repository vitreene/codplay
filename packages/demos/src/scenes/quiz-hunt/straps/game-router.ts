import type { StrapFn, StrapReturnValue } from "codplay/player/strap-types"
import type { GameConfig, GameDraw } from "../types"

/**
 * Scene-level `game:trial:open` handler: gates access (locked tile, extra token),
 * starts/pauses the timer, swaps grid ↔ trial panel, and schedules the fixed-delay
 * question reveal — plus the one-shot extra token window when this trial hosts it.
 */
export function createGameRouterStrap(config: GameConfig, draw: GameDraw): StrapFn {
  return ({ event, state, context }) => {
    const trialId = typeof event.data?.trialId === "string" ? event.data.trialId : undefined
    if (trialId === undefined) {
      return undefined
    }

    const trialStatus = (state.trialStatus as Record<string, string> | undefined) ?? {}
    const status = trialStatus[trialId]

    if (status === "success") {
      return undefined
    }

    const extraToken = state.extraToken === true
    if (status === "fail" && !extraToken) {
      return undefined
    }

    const unlockEvents = status === "fail" && extraToken
      ? [{ name: `game:grid:tile:${trialId}:unlocked` }]
      : []
    const tokenUpdate = status === "fail" && extraToken
      ? { extraToken: false, extraConsumedOn: trialId }
      : {}

    const timerStarted = state.timerStarted === true
    const timerEvent = timerStarted
      ? { name: "game:timer:pause" }
      : { name: "game:timer:start", data: { durationMs: config.timerTotalMs } }

    const revealEventName = `game:trial:${trialId}:reveal-question`
    const reveal = context.planned.delay(3000, { event: { name: revealEventName } })

    const extraAlreadyOffered = state.extraOfferedOn !== null && state.extraOfferedOn !== undefined
    const shouldOfferExtra = trialId === draw.extraWordId && !extraAlreadyOffered

    const extraSchedule = shouldOfferExtra
      ? [
          ...context.planned.delay(draw.extraOffsetMs, {
            event: { name: "game:extra:show", data: { label: config.labels.extraLabel } }
          }),
          ...context.planned.delay(draw.extraOffsetMs + config.extraDurationMs, {
            event: { name: "game:extra:hide" }
          })
        ]
      : []

    const result: StrapReturnValue[] = [
      {
        update: {
          phase: "trial",
          currentTrialId: trialId,
          timerStarted: true,
          ...tokenUpdate,
          ...(shouldOfferExtra ? { extraOfferedOn: trialId } : {})
        },
        events: [
          { name: "game:grid:hide" },
          { name: `game:trial:${trialId}:show` },
          timerEvent,
          ...unlockEvents
        ]
      },
      reveal,
      extraSchedule
    ]

    return result
  }
}

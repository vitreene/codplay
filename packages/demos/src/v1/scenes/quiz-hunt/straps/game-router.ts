import type { StrapFn, StrapReturnValue } from "codplay/player/strap-types"
import type { GameConfig, GameDraw } from "../types"

/**
 * Scene-level `game:trial:open` handler: blocks completed/failed tiles, swaps grid ↔
 * trial panel, manages the reading-phase timer pause/reveal on first access, and keeps
 * retry re-openings immediate once a retry token drop has restored the trial to available.
 */
export function createGameRouterStrap(config: GameConfig, draw: GameDraw): StrapFn {
  const revealDelayMsByTrialId = Object.fromEntries(
    config.content.words.map((word) => [word.id, typeof word.trial.revealDelayMs === "number" ? word.trial.revealDelayMs : 3000])
  )

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

    if (status === "fail") {
      return undefined
    }

    // The clock only freezes while the clue text is being read; it must already be
    // running again once the question appears, so the first-ever trial pauses it
    // right after starting it rather than leaving it running through the reading delay.
    const timerStarted = state.timerStarted === true
    const timerEvents = timerStarted
      ? [{ name: "game:timer:pause" }]
      : [{ name: "game:timer:start", data: { durationMs: config.timerTotalMs } }, { name: "game:timer:pause" }]
    const clueMediaStartEventName = `game:trial:${trialId}:clue-media:start`
    const revealDelayMs = revealDelayMsByTrialId[trialId] ?? 3000

    const extraAlreadyOffered = state.extraOfferedOn !== null && state.extraOfferedOn !== undefined
    const shouldOfferExtra = trialId === draw.extraWordId && !extraAlreadyOffered

    const extraSchedule = shouldOfferExtra
      ? [
          ...context.planned.delay(draw.extraOffsetMs, {
            event: { name: "game:extra:window:show", data: { label: config.labels.extraLabel } }
          }),
          ...context.planned.delay(draw.extraOffsetMs + config.extraDurationMs, {
            event: { name: "game:extra:window:hide" }
          })
        ]
      : []

    const result: StrapReturnValue[] = [
      {
        update: {
          phase: "trial",
          currentTrialId: trialId,
          timerStarted: true,
          ...(shouldOfferExtra ? { extraOfferedOn: trialId } : {})
        },
        events: [{ name: "game:grid:hide" }, { name: `game:trial:${trialId}:show` }, { name: clueMediaStartEventName }, ...timerEvents]
      }
    ]

    const revealEventName = `game:trial:${trialId}:reveal-question`
    result.push(context.planned.delay(revealDelayMs, [{ event: { name: revealEventName } }, { event: { name: "game:timer:resume" } }]))

    if (extraSchedule.length > 0) {
      result.push(extraSchedule)
    }

    return result
  }
}

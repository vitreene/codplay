import type { StrapFn, StrapHelperHandle } from "codplay/player/strap-types"
import type { TweenFn } from "codplay/tween/tween-runner"

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function buildFillFn(totalMs: number, remainingAtSegmentStart: number): TweenFn {
  return ({ progress }) => {
    const remaining = Math.max(0, remainingAtSegmentStart * (1 - progress))
    const percent = totalMs > 0 ? (remaining / totalMs) * 100 : 0
    return { style: { width: `${percent.toFixed(2)}%` } }
  }
}

function buildLabelFn(remainingAtSegmentStart: number): TweenFn {
  return ({ progress }) => ({
    content: formatRemaining(remainingAtSegmentStart * (1 - progress))
  })
}

/**
 * Scene-level timer engine: a single one-shot expiry timer (`context.live.wait`) per
 * running segment, replaced by a `TweenAction` for the visible countdown (jauge + label).
 * No repeating loop, so there is structurally never more than one expiry timer active —
 * `start`/`resume` always cancel the previous one before scheduling a new one.
 */
export function createGameTimerStrap(totalMs: number): StrapFn {
  let expiryHandle: StrapHelperHandle | undefined

  return ({ event, state, meta, context }) => {
    const nowMs = meta.ms ?? 0

    if (event.name === "game:timer:start" || event.name === "game:timer:resume") {
      const remaining = event.name === "game:timer:start"
        ? totalMs
        : (typeof state.timerRemainingMs === "number" ? state.timerRemainingMs : totalMs)

      expiryHandle?.cancel()
      expiryHandle = undefined

      if (remaining <= 0) {
        return {
          update: { timerStarted: true, timerRemainingMs: 0 },
          events: [{ name: "game:timer:expired" }]
        }
      }

      expiryHandle = context.live.wait(remaining, { event: { name: "game:timer:expired" } })

      return {
        update: { timerStarted: true, timerRemainingMs: remaining, segmentStartedAtMs: nowMs },
        events: [
          {
            name: "game:timer:fill",
            data: { duration: remaining, ease: "linear", fn: buildFillFn(totalMs, remaining) }
          },
          {
            name: "game:timer:label",
            data: { duration: remaining, ease: "linear", fn: buildLabelFn(remaining) }
          }
        ]
      }
    }

    if (event.name === "game:timer:pause" || event.name === "game:timer:stop") {
      expiryHandle?.cancel()
      expiryHandle = undefined

      const remainingAtSegmentStart = typeof state.timerRemainingMs === "number" ? state.timerRemainingMs : totalMs
      const segmentStartedAtMs = typeof state.segmentStartedAtMs === "number" ? state.segmentStartedAtMs : nowMs
      const remaining = Math.max(0, remainingAtSegmentStart - (nowMs - segmentStartedAtMs))

      return {
        update: { timerRemainingMs: remaining },
        events: [{ name: "tween:stop" }]
      }
    }

    return undefined
  }
}

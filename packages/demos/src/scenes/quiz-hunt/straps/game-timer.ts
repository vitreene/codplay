import type { StrapFn, StrapReturnValue } from "codplay/player/strap-types"
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

const TIMER_EVENT_NAMES = ["game:timer:start", "game:timer:resume", "game:timer:pause", "game:timer:stop"]

/** Event privé : "le minuteur d'expiration d'un segment arrive à échéance, à vérifier." */
const EXPIRY_CHECK_EVENT = "game:timer:expiry-check"

/**
 * Scene-level timer engine: a single one-shot expiry check (`context.planned.delay`) per
 * running segment ("segment" = the period between one start/resume and the next
 * pause/stop/resume), replaced by a `TweenAction` for the visible countdown (jauge + label).
 * No repeating loop, no `context.live` helper, no closure-held cancellable handle.
 *
 * Staleness is handled declaratively instead of by cancellation: each scheduled expiry check
 * carries the `segmentStartedAtMs` of the segment it was scheduled for. When it fires, it is
 * only treated as a real expiry if `state.segmentStartedAtMs` still matches that value — i.e.
 * no later `pause`/`resume`/`stop` has started a new segment since. Otherwise it is a stale
 * check from a now-superseded segment and is silently ignored.
 */
export function createGameTimerStrap(totalMs: number): StrapFn {
  return ({ event, state, meta, context }) => {
    if (event.name === EXPIRY_CHECK_EVENT) {
      const scheduledSegmentStartedAtMs = typeof event.data?.segmentStartedAtMs === "number" ? event.data.segmentStartedAtMs : undefined
      const currentSegmentStartedAtMs = typeof state.segmentStartedAtMs === "number" ? state.segmentStartedAtMs : undefined
      if (scheduledSegmentStartedAtMs === undefined || scheduledSegmentStartedAtMs !== currentSegmentStartedAtMs) {
        return undefined
      }

      return {
        update: { timerStarted: true, timerRemainingMs: 0, segmentStartedAtMs: undefined },
        events: [{ name: "game:timer:expired" }]
      }
    }

    if (!TIMER_EVENT_NAMES.includes(event.name)) {
      return undefined
    }

    const nowMs = meta.ms ?? 0

    const segmentStartedAtMs = typeof state.segmentStartedAtMs === "number" ? state.segmentStartedAtMs : undefined
    const remainingAtSegmentStart = typeof state.timerRemainingMs === "number" ? state.timerRemainingMs : totalMs
    const elapsedInSegment = segmentStartedAtMs === undefined ? 0 : Math.max(0, nowMs - segmentStartedAtMs)

    const remainingNow = event.name === "game:timer:start"
      ? totalMs
      : Math.max(0, remainingAtSegmentStart - elapsedInSegment)

    if (event.name === "game:timer:pause" || event.name === "game:timer:stop") {
      return {
        update: { timerRemainingMs: remainingNow, segmentStartedAtMs: undefined },
        events: [{ name: "tween:stop" }]
      }
    }

    if (remainingNow <= 0) {
      return {
        update: { timerStarted: true, timerRemainingMs: 0, segmentStartedAtMs: undefined },
        events: [{ name: "game:timer:expired" }]
      }
    }

    const result: StrapReturnValue[] = [
      {
        update: { timerStarted: true, timerRemainingMs: remainingNow, segmentStartedAtMs: nowMs },
        events: [
          {
            name: "game:timer:fill",
            data: { duration: remainingNow, ease: "linear", fn: buildFillFn(totalMs, remainingNow) }
          },
          {
            name: "game:timer:label",
            data: { duration: remainingNow, ease: "linear", fn: buildLabelFn(remainingNow) }
          }
        ]
      },
      context.planned.delay(remainingNow, {
        event: { name: EXPIRY_CHECK_EVENT, data: { segmentStartedAtMs: nowMs } }
      })
    ]

    return result
  }
}

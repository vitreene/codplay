import type { StrapFn, StrapReturnValue } from "codplay/player/strap-types"
import type { TweenFn } from "codplay/tween/tween-runner"

const ELAPSED_RING_RADIUS = 132
const ELAPSED_RING_CIRCUMFERENCE = 2 * Math.PI * ELAPSED_RING_RADIUS

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function resolveTimerColor(progress: number): string {
  return progress < 0.5 ? "#4ade80" : progress < 0.75 ? "#fb923c" : "#f87171"
}

function buildNeedleFn(remainingAtSegmentStart: number): TweenFn {
  const startDeg = (remainingAtSegmentStart / 1000 / 60) * 360
  return ({ progress }) => {
    const deg = startDeg * (1 - progress)
    return { style: { transform: `rotate(${deg.toFixed(3)}deg)` } }
  }
}

function buildElapsedFn(totalMs: number, remainingAtSegmentStart: number): TweenFn {
  return ({ progress }) => {
    const remaining = remainingAtSegmentStart * (1 - progress)
    const elapsedRatio = totalMs > 0 ? Math.min(1, Math.max(0, (totalMs - remaining) / totalMs)) : 1
    const dashOffset = ELAPSED_RING_CIRCUMFERENCE * (1 - elapsedRatio)
    return {
      attr: { "stroke-dashoffset": dashOffset.toFixed(3) }
    }
  }
}

function buildDisplayFn(remainingAtSegmentStart: number): TweenFn {
  return ({ progress }) => {
    const remaining = remainingAtSegmentStart * (1 - progress)
    return {
      content: formatRemaining(remaining),
      style: { color: resolveTimerColor(progress) }
    }
  }
}

const TIMER_EVENT_NAMES = ["game:timer:start", "game:timer:resume", "game:timer:pause", "game:timer:stop"]

/** Event privé : "le minuteur d'expiration d'un segment arrive à échéance, à vérifier." */
const EXPIRY_CHECK_EVENT = "game:timer:expiry-check"

/**
 * Scene-level timer engine: a single one-shot expiry check (`context.planned.delay`) per
 * running segment ("segment" = the period between one start/resume and the next
 * pause/stop/resume), replaced by `TweenAction`s for the chrono needle, display,
 * and elapsed-time ring.
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
            name: "game:timer:elapsed",
            data: { duration: remainingNow, ease: "linear", fn: buildElapsedFn(totalMs, remainingNow) }
          },
          {
            name: "game:timer:needle",
            data: { duration: remainingNow, ease: "linear", fn: buildNeedleFn(remainingNow) }
          },
          {
            name: "game:timer:display",
            data: { duration: remainingNow, ease: "linear", fn: buildDisplayFn(remainingNow) }
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

import type { StrapContext, StrapFn, StrapStep, StrapStepResult } from "codplay/player/strap-types"

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function startTick(context: StrapContext, totalMs: number, remainingAtStart: number): void {
  context.live.loop(
    {
      eachMs: 250,
      until: [
        { type: "event", name: "game:timer:pause" },
        { type: "event", name: "game:timer:stop" },
        { type: "duration", maxMs: remainingAtStart }
      ]
    },
    ({ elapsedMs }): StrapStepResult => {
      const remaining = Math.max(0, remainingAtStart - elapsedMs)
      const percent = totalMs > 0 ? (remaining / totalMs) * 100 : 0

      const steps: StrapStep[] = [
        {
          update: { timerRemainingMs: remaining },
          event: { name: "game:timer:fill", data: { style: { width: `${percent.toFixed(2)}%` } } }
        },
        { event: { name: "game:timer:label", data: { content: formatRemaining(remaining) } } }
      ]

      if (remaining <= 0) {
        steps.push({ event: { name: "game:timer:expired" } })
      }

      return steps
    }
  )
}

/**
 * Scene-level timer engine: owns start/resume via a `context.live.loop` tick that keeps
 * `timerRemainingMs` current in scene state. Pause/stop need no strap logic — the loop's
 * own `until: { type: 'event', ... }` conditions stop it as soon as those events fire.
 */
export function createGameTimerStrap(totalMs: number): StrapFn {
  return ({ event, state, context }) => {
    if (event.name === "game:timer:start") {
      startTick(context, totalMs, totalMs)
      return { update: { timerStarted: true, timerRemainingMs: totalMs } }
    }

    if (event.name === "game:timer:resume") {
      const remaining = typeof state.timerRemainingMs === "number" ? state.timerRemainingMs : totalMs
      startTick(context, totalMs, remaining)
      return undefined
    }

    return undefined
  }
}

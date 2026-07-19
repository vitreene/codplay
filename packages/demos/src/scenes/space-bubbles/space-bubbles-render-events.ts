import type { TweenFn } from "codplay/tween/tween-runner"
import { SPACE_BUBBLE_COLORS, SPACE_BUBBLES_MAX_DURATION_MS, SPACE_BUBBLES_WORLD, type SpaceBubbleColor, type SpaceBubblesState, type WorldPoint } from "./space-bubbles-types"
import { resolveBubbleLevelScale } from "./space-bubbles-state"

export const FAILURE_FALL_DURATION_MS = 760

type EventLike = {
  name: string
  data?: Record<string, unknown>
}

function colorLabel(color: SpaceBubbleColor): string {
  return color === "red" ? "Rouge" : color === "blue" ? "Bleu" : color === "yellow" ? "Jaune" : "Vert"
}

function formatElapsedMs(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1).padStart(4, "0")
}

function buildElapsedTimerFn(durationMs: number): TweenFn {
  return ({ progress }) => ({ content: formatElapsedMs(durationMs * progress) })
}

/** Builds events that reset and reveal the game surface for a new run. */
export function buildGameStartEvents(state: SpaceBubblesState): EventLike[] {
  return [
    { name: "space:stage:fade-in", data: { className: { add: "is-playing", remove: "is-ended" } } },
    { name: "space:result:hide", data: { className: { add: "is-hidden", remove: "is-visible is-success is-fail" } } },
    { name: "space:projectile:hide", data: { style: { opacity: 0 } } },
    { name: "space:picker:hide", data: { className: { add: "is-hidden" }, style: { opacity: 0 } } },
    { name: "space:maluser:hide", data: { className: { add: "is-hidden" }, style: { opacity: 0 } } },
    { name: "space:hud:timer-stop" },
    { name: "space:hud:timer", data: { duration: SPACE_BUBBLES_MAX_DURATION_MS, ease: "linear", fn: buildElapsedTimerFn(SPACE_BUBBLES_MAX_DURATION_MS) } },
    { name: "space:hud:status", data: { content: `Mission : ${state.targetSequence.map(colorLabel).join(" -> ")}` } },
    ...SPACE_BUBBLE_COLORS.map((color) => ({
      name: `space:bubble:${color}:set-level`,
      data: {
        className: { remove: "is-popped is-shocked" },
        style: { "--bubble-level-scale": resolveBubbleLevelScale(state.bubbles[color].level) },
      },
    })),
    ...SPACE_BUBBLE_COLORS.map((color) => ({
      name: `space:mission:${color}:reset`,
      data: { className: { remove: "is-accomplished is-failed" } },
    })),
    buildTurretMoveEvent(state.turretX),
  ]
}

/** Builds events for one picker pass from right to left. */
export function buildPickerSpawnEvents(y: number, durationMs: number): EventLike[] {
  return [
    {
      name: "space:picker:spawn",
      data: {
        className: { remove: "is-hidden" },
        style: {
          opacity: 1,
          x: { from: 1080, to: -120, duration: durationMs, ease: "linear" },
          y,
        },
      },
    },
    { name: "space:controls:left:picker-mode", data: { content: "↑" } },
    { name: "space:controls:right:picker-mode", data: { content: "↓" } },
    { name: "space:hud:status", data: { content: "Picker actif : ajuste sa hauteur." } },
  ]
}

/** Builds events for changing picker height while it crosses the stage. */
export function buildPickerHeightEvents(y: number): EventLike[] {
  return [
    { name: "space:picker:set-height", data: { style: { y: { to: y, duration: 180, ease: "outQuad" } } } },
  ]
}

/** Builds events for the end of one picker pass. */
export function buildPickerEndEvents(): EventLike[] {
  return [
    { name: "space:picker:hide", data: { className: { add: "is-hidden" }, style: { opacity: 0 } } },
    { name: "space:controls:left:turret-mode", data: { content: "←" } },
    { name: "space:controls:right:turret-mode", data: { content: "→" } },
  ]
}

/** Builds events for one maluser diagonal pass. */
export function buildMaluserSpawnEvents(durationMs: number): EventLike[] {
  return [
    {
      name: "space:maluser:spawn",
      data: {
        className: { remove: "is-hidden is-hit" },
        style: {
          opacity: 1,
          x: { from: -90, to: 1090, duration: durationMs, ease: "linear" },
          y: { from: 650, to: 335, duration: durationMs, ease: "linear" },
        },
      },
    },
    { name: "space:hud:status", data: { content: "Maluser en approche : surveille les bulles." } },
  ]
}

/** Builds events for the end of one maluser pass. */
export function buildMaluserEndEvents(): EventLike[] {
  return [{ name: "space:maluser:hide", data: { className: { add: "is-hidden" }, style: { opacity: 0 } } }]
}

/** Builds events for one maluser bubble regrow contact. */
export function buildMaluserHitBubbleEvents(color: SpaceBubbleColor, nextLevel: number): EventLike[] {
  return [
    { name: "space:maluser:hit-bubble", data: { className: { add: "is-hit" } } },
    {
      name: `space:bubble:${color}:set-level`,
      data: { style: { "--bubble-level-scale": resolveBubbleLevelScale(nextLevel as 0 | 1 | 2 | 3) } },
    },
  ]
}

/** Builds events that clear the short maluser hit state. */
export function buildMaluserHitClearEvents(): EventLike[] {
  return [{ name: "space:maluser:hit-bubble", data: { className: { remove: "is-hit" } } }]
}

/** Builds visual events emitted when the player shoots the maluser. */
export function buildMaluserShotEvents(point: WorldPoint): EventLike[] {
  return [
    { name: "space:projectile:hide", data: { style: { opacity: 0 } } },
    { name: "space:maluser:hit-bubble", data: { className: { add: "is-hit" } } },
    {
      name: "space:fx:impact-flash",
      data: { className: { add: "is-active" }, style: { x: point.x, y: point.y } },
    },
    { name: "space:fx:stage-shake", data: { className: { add: "is-shaking" } } },
    { name: "space:hud:status", data: { content: "Maluser touche." } },
  ]
}

/** Clears the maluser shot feedback and removes the maluser from the pass. */
export function buildMaluserShotClearEvents(): EventLike[] {
  return [
    { name: "space:maluser:hit-bubble", data: { className: { remove: "is-hit" } } },
    { name: "space:maluser:hide", data: { className: { add: "is-hidden" }, style: { opacity: 0 } } },
    { name: "space:fx:impact-flash-clear", data: { className: { remove: "is-active" } } },
    { name: "space:fx:stage-shake-clear", data: { className: { remove: "is-shaking" } } },
  ]
}

/** Builds one turret visual movement event. */
export function buildTurretMoveEvent(x: number, options: { fromX?: number; durationMs?: number; ease?: string } = {}): EventLike {
  const transition: Record<string, unknown> = {
    to: x,
    duration: options.durationMs ?? 120,
    ease: options.ease ?? "outQuad",
  }
  if (options.fromX !== undefined) {
    transition.from = options.fromX
  }

  return {
    name: "space:turret:move",
    data: {
      style: {
        x: transition,
        y: SPACE_BUBBLES_WORLD.turretY,
      },
    },
  }
}

/** Builds events for one projectile shot animation. */
export function buildProjectileFireEvents(x: number, durationMs: number): EventLike[] {
  return [
    { name: "space:shot:fired" },
    {
      name: "space:projectile:fly",
      data: {
        style: {
          opacity: 1,
          x,
          y: { from: SPACE_BUBBLES_WORLD.projectileY, to: SPACE_BUBBLES_WORLD.projectileEndY, duration: durationMs, ease: "linear" },
        },
      },
    },
    { name: "space:turret:recoil", data: { className: { add: "is-recoiling" } } },
  ]
}

/** Builds events that clear the short turret recoil animation. */
export function buildTurretRecoilClearEvents(): EventLike[] {
  return [{ name: "space:turret:recoil-clear", data: { className: { remove: "is-recoiling" } } }]
}

/** Builds the visual events emitted when a bubble impact is validated. */
export function buildBubbleImpactEvents(input: {
  color: SpaceBubbleColor
  point: WorldPoint
  nextLevel: number
  destroyed: boolean
  accomplished: boolean
}): EventLike[] {
  const events: EventLike[] = [
    { name: "space:impact:bubble", data: { color: input.color, x: input.point.x, y: input.point.y } },
    { name: "space:projectile:hide", data: { style: { opacity: 0 } } },
    { name: `space:bubble:${input.color}:shock`, data: { className: { add: "is-shocked" } } },
    {
      name: `space:bubble:${input.color}:set-level`,
      data: { style: { "--bubble-level-scale": resolveBubbleLevelScale(input.nextLevel as 0 | 1 | 2 | 3) } },
    },
    {
      name: "space:fx:impact-flash",
      data: {
        className: { add: "is-active" },
        style: { x: input.point.x, y: input.point.y },
      },
    },
    { name: "space:fx:stage-shake", data: { className: { add: "is-shaking" } } },
  ]

  if (input.destroyed) {
    events.push({ name: `space:bubble:${input.color}:pop`, data: { className: { add: "is-popped" } } })
    events.push({
      name: input.accomplished ? `space:mission:${input.color}:accomplished` : `space:mission:${input.color}:failed`,
      data: { className: { add: input.accomplished ? "is-accomplished" : "is-failed" } },
    })
  }

  return events
}

/** Builds events that clear short-lived impact classes. */
export function buildImpactClearEvents(color: SpaceBubbleColor): EventLike[] {
  return [
    { name: `space:bubble:${color}:shock-clear`, data: { className: { remove: "is-shocked" } } },
    { name: "space:fx:impact-flash-clear", data: { className: { remove: "is-active" } } },
    { name: "space:fx:stage-shake-clear", data: { className: { remove: "is-shaking" } } },
  ]
}

/** Builds final panel events. */
export function buildGameEndEvents(state: SpaceBubblesState): EventLike[] {
  const elapsedMs = state.startedAtMs === null || state.endedAtMs === null ? 0 : Math.max(0, state.endedAtMs - state.startedAtMs)
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1)
  const success = state.status === "success"
  return [
    { name: "space:stage:end", data: { className: { add: "is-ended" } } },
    { name: "space:hud:timer-stop" },
    { name: "space:hud:timer", data: { content: formatElapsedMs(elapsedMs) } },
    {
      name: "space:result:show",
      data: {
        content: success ? `Succes en ${elapsedSeconds}s` : `Echec en ${elapsedSeconds}s`,
        className: { add: `is-visible ${success ? "is-success" : "is-fail"}`, remove: "is-hidden" },
      },
    },
    {
      name: "space:hud:status",
      data: {
        content: success
          ? `Ordre valide : ${state.destructionSequence.map(colorLabel).join(" -> ")}`
          : `Ordre obtenu : ${state.destructionSequence.map(colorLabel).join(" -> ")}`,
      },
    },
  ]
}

/** Builds the failure transition that drops remaining bubbles before the final message. */
export function buildFailureFallEvents(state: SpaceBubblesState): EventLike[] {
  return [
    { name: "space:projectile:hide", data: { style: { opacity: 0 } } },
    ...SPACE_BUBBLE_COLORS.filter((color) => state.bubbles[color].alive).map((color) => ({
      name: `space:bubble:${color}:fall`,
      data: {
        style: {
          y: { to: 1120, duration: FAILURE_FALL_DURATION_MS, ease: "inQuad" },
          opacity: { to: 0, duration: FAILURE_FALL_DURATION_MS, ease: "inQuad" },
        },
      },
    })),
  ]
}

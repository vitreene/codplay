import type { BubbleState, ProjectileState, WorldPoint } from "./space-bubbles-types"

function resolveAlternateSine(from: number, to: number, durationMs: number, elapsedMs: number): number {
  const cycleMs = durationMs * 2
  const localMs = ((elapsedMs % cycleMs) + cycleMs) % cycleMs
  const forwardProgress = localMs <= durationMs ? localMs / durationMs : 1 - (localMs - durationMs) / durationMs
  const eased = (1 - Math.cos(forwardProgress * Math.PI)) / 2
  return from + (to - from) * eased
}

function resolveBubbleInitialPoint(bubble: BubbleState): WorldPoint {
  return {
    x: bubble.orbit.centerX + Math.sin(bubble.orbit.phase) * bubble.orbit.radiusX,
    y: bubble.orbit.centerY + Math.sin(bubble.orbit.phase * 2) * bubble.orbit.radiusY,
  }
}

/** Resolves one bubble center in world coordinates at the provided scene time. */
export function resolveBubblePosition(bubble: BubbleState, timelineMs: number, startedAtMs: number): WorldPoint {
  const elapsedMs = Math.max(0, timelineMs - startedAtMs)
  const initial = resolveBubbleInitialPoint(bubble)
  const oppositeX = initial.x < bubble.orbit.centerX
    ? bubble.orbit.centerX + bubble.orbit.radiusX
    : bubble.orbit.centerX - bubble.orbit.radiusX
  const oppositeY = initial.y <= bubble.orbit.centerY
    ? bubble.orbit.centerY + bubble.orbit.radiusY
    : bubble.orbit.centerY - bubble.orbit.radiusY

  return {
    x: resolveAlternateSine(initial.x, oppositeX, bubble.orbit.periodMs / 2, elapsedMs),
    y: resolveAlternateSine(initial.y, oppositeY, bubble.orbit.periodMs / 4, elapsedMs),
  }
}

/** Resolves one projectile center in world coordinates at the provided scene time. */
export function resolveProjectilePosition(projectile: ProjectileState, timelineMs: number): WorldPoint {
  const progress = Math.max(0, Math.min(1, (timelineMs - projectile.firedAtMs) / projectile.durationMs))
  return {
    x: projectile.x,
    y: projectile.startY + (projectile.endY - projectile.startY) * progress,
  }
}

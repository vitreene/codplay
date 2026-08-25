import type { WorldCircle, WorldPoint, WorldRect } from "./space-bubbles-types"

/** Returns true when two logical circles overlap. */
export function circleHitsCircle(a: WorldCircle, b: WorldCircle): boolean {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const radius = a.radius + b.radius
  return dx * dx + dy * dy <= radius * radius
}

/** Returns true when one point is inside one logical circle. */
export function pointHitsCircle(point: WorldPoint, circle: WorldCircle): boolean {
  const dx = point.x - circle.x
  const dy = point.y - circle.y
  return dx * dx + dy * dy <= circle.radius * circle.radius
}

/** Returns true when one logical rectangle overlaps one logical circle. */
export function rectHitsCircle(rect: WorldRect, circle: WorldCircle): boolean {
  const nearestX = Math.max(rect.left, Math.min(circle.x, rect.right))
  const nearestY = Math.max(rect.top, Math.min(circle.y, rect.bottom))
  return pointHitsCircle({ x: nearestX, y: nearestY }, circle)
}

/** Returns true when one segment passes through or near one circle. */
export function segmentHitsCircle(from: WorldPoint, to: WorldPoint, circle: WorldCircle): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return pointHitsCircle(from, circle)
  }

  const t = Math.max(0, Math.min(1, ((circle.x - from.x) * dx + (circle.y - from.y) * dy) / lengthSq))
  return pointHitsCircle({ x: from.x + dx * t, y: from.y + dy * t }, circle)
}

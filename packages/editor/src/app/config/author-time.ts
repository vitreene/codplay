/**
 * Tolerance under which two author times designate the same instant: a keyframe under the
 * playhead, or a player presentation that matches the requested seek.
 */
export const AUTHOR_TIME_TOLERANCE_MS = 1

/** Reports whether two author times designate the same instant. */
export function isSameAuthorTime(left: number, right: number): boolean {
  return Math.abs(left - right) <= AUTHOR_TIME_TOLERANCE_MS
}

/** Pure timing resolution for one editor motion segment. */

export const DEFAULT_MOTION_TRANSITION_WINDOW_MS = 500

export type MotionKeyframeReference = Readonly<{
  id: string
  timeMs: number
}>

export type MotionKeyframeAlignment =
  | { kind: 'no-keyframes' }
  | { kind: 'before-first' }
  | { kind: 'exact'; keyframeId: string }
  | { kind: 'after-last'; keyframeId: string }
  | { kind: 'between'; prevKeyframeId: string; nextKeyframeId: string }

export type MotionLifetimeBoundary = Readonly<{
  name: 'intro' | 'outro'
  timeMs: number
  kind: 'real' | 'virtual'
  keyframeId?: string
}>

export type MotionLifetime = Readonly<{
  intro: MotionLifetimeBoundary
  outro: MotionLifetimeBoundary
}>

export type MotionInheritedLifetime = Readonly<{
  introTimeMs: number
  outroTimeMs: number
}>

export type MotionTimingDefinition = Readonly<{
  durationMs?: number
  direction?: 'before' | 'after'
}>

export type MotionTransitionWindow = Readonly<{
  sourceTimeMs: number
  targetTimeMs: number
  startTimeMs: number
  endTimeMs: number
  durationMs: number
  direction: 'before' | 'after'
}>

/** Returns keyframes in a stable temporal order without mutating the caller's collection. */
export function sortMotionKeyframes<T extends MotionKeyframeReference>(
  keyframes: readonly T[],
): T[] {
  return [...keyframes].sort((left, right) => left.timeMs - right.timeMs)
}

/** Resolves the author's playhead against real keyframes without reading player state. */
export function resolveMotionKeyframeAlignment(
  keyframes: readonly MotionKeyframeReference[],
  timelineMs: number,
): MotionKeyframeAlignment {
  const sorted = sortMotionKeyframes(keyframes)
  const first = sorted[0]
  if (first === undefined) return { kind: 'no-keyframes' }
  if (!Number.isFinite(timelineMs) || sorted.some((keyframe) => !Number.isFinite(keyframe.timeMs))) {
    return { kind: 'no-keyframes' }
  }
  if (timelineMs < first.timeMs) return { kind: 'before-first' }

  const exact = sorted.find((keyframe) => keyframe.timeMs === timelineMs)
  if (exact !== undefined) return { kind: 'exact', keyframeId: exact.id }

  const last = sorted[sorted.length - 1]!
  if (timelineMs >= last.timeMs) return { kind: 'after-last', keyframeId: last.id }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const source = sorted[index]!
    const target = sorted[index + 1]!
    if (timelineMs > source.timeMs && timelineMs < target.timeMs) {
      return { kind: 'between', prevKeyframeId: source.id, nextKeyframeId: target.id }
    }
  }

  // Duplicate keyframe times are invalid document data. Keep the resolver total and deterministic
  // for that input; an exact match above still selects the first keyframe in temporal order.
  return { kind: 'no-keyframes' }
}

/** Resolves which lifetime boundaries belong to the item and which remain inherited virtually. */
export function resolveMotionLifetime(
  keyframes: readonly MotionKeyframeReference[],
  inherited: MotionInheritedLifetime,
): MotionLifetime | null {
  if (!Number.isFinite(inherited.introTimeMs)
    || !Number.isFinite(inherited.outroTimeMs)
    || inherited.outroTimeMs < inherited.introTimeMs) return null

  const sorted = sortMotionKeyframes(keyframes)
  if (sorted.some((keyframe) => !Number.isFinite(keyframe.timeMs))) return null
  const first = sorted[0]
  const last = sorted.length > 1 ? sorted[sorted.length - 1] : undefined

  const intro: MotionLifetimeBoundary = first === undefined
    ? { name: 'intro', timeMs: inherited.introTimeMs, kind: 'virtual' }
    : { name: 'intro', timeMs: first.timeMs, kind: 'real', keyframeId: first.id }
  const outro: MotionLifetimeBoundary = last === undefined
    ? { name: 'outro', timeMs: inherited.outroTimeMs, kind: 'virtual' }
    : { name: 'outro', timeMs: last.timeMs, kind: 'real', keyframeId: last.id }

  // A one-keyframe item inherits its exit. Parent clipping decides whether an item outside that
  // interval is visible; this resolver preserves the real/virtual ownership instead of silently
  // dropping an inherited marker from the timeline projection.
  return { intro, outro }
}

/** Resolves a bounded motion window without reading or mutating editor state. */
export function resolveMotionTransitionWindow(
  sourceTimeMs: number,
  targetTimeMs: number,
  transition?: MotionTimingDefinition,
  defaultDurationMs = DEFAULT_MOTION_TRANSITION_WINDOW_MS,
): MotionTransitionWindow | null {
  if (!Number.isFinite(sourceTimeMs) || !Number.isFinite(targetTimeMs) || targetTimeMs <= sourceTimeMs) return null

  const intervalMs = targetTimeMs - sourceTimeMs
  const requestedDurationMs = transition?.durationMs ?? defaultDurationMs
  const durationMs = Math.min(intervalMs, clampPositiveDuration(requestedDurationMs))
  const direction = transition?.direction ?? 'after'
  const startTimeMs = direction === 'before' ? targetTimeMs - durationMs : sourceTimeMs

  return {
    sourceTimeMs,
    targetTimeMs,
    startTimeMs,
    endTimeMs: startTimeMs + durationMs,
    durationMs,
    direction,
  }
}

/** Keeps a motion duration positive and finite before the interval clamp is applied. */
function clampPositiveDuration(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.round(value))
}

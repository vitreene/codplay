/** Returns true when a value is a finite numeric duration or sample. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Resolves the total duration represented by a motion dt array. */
export function resolveMotionDurationMs(dt: readonly number[] | undefined): number {
  if (!dt) return 0
  return dt.reduce((total, value) => total + (isFiniteNumber(value) && value > 0 ? value : 0), 0)
}

/** Samples one numeric motion channel at elapsed local time. */
export function sampleMotionChannel(values: readonly number[], dt: readonly number[] | undefined, elapsedMs: number): number | null {
  if (values.length === 0) return null
  if (values.length === 1) return values[0] ?? null

  const safeElapsedMs = Math.max(0, elapsedMs)
  if (!dt || dt.length === 0) {
    return values[values.length - 1] ?? null
  }

  if (dt.length === values.length - 1) {
    let cursorMs = 0
    for (let index = 0; index < dt.length; index += 1) {
      const durationMs = Math.max(0, dt[index] ?? 0)
      const nextCursorMs = cursorMs + durationMs
      if (safeElapsedMs <= nextCursorMs || index === dt.length - 1) {
        const from = values[index]
        const to = values[index + 1]
        if (!isFiniteNumber(from) || !isFiniteNumber(to)) return null
        const progress = durationMs > 0 ? Math.max(0, Math.min(1, (safeElapsedMs - cursorMs) / durationMs)) : 1
        return from + (to - from) * progress
      }
      cursorMs = nextCursorMs
    }
  }

  if (dt.length === values.length) {
    let cursorMs = 0
    for (let index = 0; index < dt.length; index += 1) {
      const durationMs = Math.max(0, dt[index] ?? 0)
      const nextCursorMs = cursorMs + durationMs
      if (safeElapsedMs <= nextCursorMs || index === dt.length - 1) {
        const to = values[index]
        if (!isFiniteNumber(to)) return null
        if (index === 0) return to
        const from = values[index - 1]
        if (!isFiniteNumber(from)) return null
        const progress = durationMs > 0 ? Math.max(0, Math.min(1, (safeElapsedMs - cursorMs) / durationMs)) : 1
        return from + (to - from) * progress
      }
      cursorMs = nextCursorMs
    }
  }

  return null
}

/** Samples a MotionEngine-style channel, optionally scaled by a `rescale` curve. */
export function sampleMotionValue(
  values: readonly number[],
  dt: readonly number[] | undefined,
  elapsedMs: number,
  rescale?: readonly number[],
): number | null {
  const value = sampleMotionChannel(values, dt, elapsedMs)
  if (value === null) return null
  if (rescale === undefined) return value

  const scale = sampleMotionChannel(rescale, dt, elapsedMs)
  return scale === null ? null : value * scale
}

import { parseColor, prepareTween, resolveTween, type ColorValue } from '../../ace'
import { isPlainRecord } from '../../shared'
import type { CompiledRecord, CompiledScene, CompiledValue } from '../../scene/compiled'

/** Temporary logical state produced for one compiled perso. */
export type TemporaryPersoState = CompiledRecord

/** Evaluates only the subset needed by the temporary render vertical. */
export function evaluateTemporaryScene(scene: CompiledScene, timeMs: number): Readonly<Record<string, TemporaryPersoState>> {
  const states: Record<string, TemporaryPersoState> = {}
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    const events = (story.eventimes ?? []).filter(isScheduledEvent).filter((event) => event.startAt <= timeMs)
    for (const perso of story.persos) {
      const state = cloneRecord(perso.initial)
      normalizeTemporaryStyleColors(state)
      for (const event of events) {
        const action = perso.actions[event.name]
        if (isPlainRecord(action)) {
          applyTemporaryAction(state, action, timeMs - event.startAt)
        }
      }
      states[`${storyId}:${perso.id}`] = state
    }
  }
  return states
}

/** Identifies the eventime shape understood by the temporary evaluator. */
function isScheduledEvent(value: CompiledRecord): value is CompiledRecord & { name: string; startAt: number } {
  return typeof value.name === 'string' && typeof value.startAt === 'number' && Number.isFinite(value.startAt)
}

/** Applies the intentionally small className/style action subset. */
function applyTemporaryAction(state: Record<string, CompiledValue>, action: CompiledRecord, elapsedMs: number): void {
  if (isPlainRecord(action.className)) {
    state.className = applyClassNamePatch(state.className, action.className)
  }
  if (isPlainRecord(action.style)) {
    const currentStyle: Record<string, CompiledValue> = isPlainRecord(state.style)
      ? { ...(state.style as CompiledRecord) }
      : {}
    for (const [property, value] of Object.entries(action.style)) {
      currentStyle[property] = resolveStyleValue(property, currentStyle[property], value, elapsedMs)
    }
    state.style = currentStyle
  }
}

/** Resolves one explicit style tween or keeps one direct value unchanged. */
function resolveStyleValue(
  property: string,
  current: CompiledValue | undefined,
  value: CompiledValue,
  elapsedMs: number,
): CompiledValue {
  if (!isPlainRecord(value) || !('to' in value)) return normalizeTemporaryColor(property, value) ?? value
  const to = normalizeTemporaryColor(property, value.to)
  if (!isTweenValue(to)) throw new Error('Temporary evaluator only supports scalar or color style tweens.')
  const from = normalizeTemporaryColor(property, value.from ?? current)
  if (!isTweenValue(from)) throw new Error('Temporary evaluator requires an explicit or materialized tween from.')
  const tween = prepareTween({
    from,
    to,
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    delay: typeof value.delay === 'number' ? value.delay : undefined,
    ease: typeof value.ease === 'string' ? value.ease : undefined,
  })
  return resolveTween(tween, elapsedMs) as CompiledValue
}

/** Normalizes initial color strings before the temporary evaluator calls ACE. */
function normalizeTemporaryStyleColors(state: Record<string, CompiledValue>): void {
  if (!isPlainRecord(state.style)) return
  const style = state.style as Record<string, CompiledValue>
  for (const [property, value] of Object.entries(style)) {
    const normalized = normalizeTemporaryColor(property, value)
    if (normalized !== undefined) style[property] = normalized
  }
}

/** Normalizes only the color properties used by the temporary vertical. */
function normalizeTemporaryColor(property: string, value: CompiledValue | undefined): CompiledValue | undefined {
  if (!isColorProperty(property) || typeof value !== 'string') return value
  return parseColor(value)
}

/** Identifies the temporary vertical's CSS color properties. */
function isColorProperty(property: string): boolean {
  return property === 'color' || property === 'backgroundColor' || property === 'borderColor'
}

/** Checks values accepted by ACE for a temporary scalar or color tween. */
function isTweenValue(value: CompiledValue | undefined): value is string | number | ColorValue {
  return isScalar(value) || isColorValue(value)
}

/** Checks one normalized color value. */
function isColorValue(value: CompiledValue | undefined): value is ColorValue {
  if (!isPlainRecord(value)) return false
  const candidate = value as Record<string, unknown>
  return candidate.kind === 'color'
    && (candidate.space === 'srgb' || candidate.space === 'oklch')
    && Array.isArray(candidate.coords)
    && candidate.coords.every((coordinate: unknown) => typeof coordinate === 'number')
    && typeof candidate.alpha === 'number'
}

/** Applies an authored className add/remove patch to the temporary state. */
function applyClassNamePatch(current: CompiledValue | undefined, patch: CompiledRecord): string {
  const classes = new Set(typeof current === 'string' ? current.split(/\s+/).filter(Boolean) : [])
  if (typeof patch.remove === 'string') {
    for (const name of patch.remove.split(/\s+/).filter(Boolean)) classes.delete(name)
  }
  if (typeof patch.add === 'string') {
    for (const name of patch.add.split(/\s+/).filter(Boolean)) classes.add(name)
  }
  return [...classes].join(' ')
}

/** Clones one compiled record before applying temporary state changes. */
function cloneRecord(record: CompiledRecord): Record<string, CompiledValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]))
}

/** Clones one compiled value without carrying mutable author objects into the state. */
function cloneValue(value: CompiledValue): CompiledValue {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (isPlainRecord(value)) return cloneRecord(value)
  return value
}

/** Checks values accepted by the temporary scalar tween path. */
function isScalar(value: CompiledValue | undefined): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

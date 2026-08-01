import { parseColor, prepareTween, resolveTween, type ColorValue } from '../../../ace'
import { isPlainRecord } from '../../../shared'
import type { CompiledRecord, CompiledValue } from '../../../scene/compiled'
import type { MaterializedPerso, MaterializedScene, ResolvedPerso, ResolvedScene } from './types'

/** Resolves discrete patches and continuous ACE values for one materialized scene. */
export function resolveScene(materialized: MaterializedScene): ResolvedScene {
  const persos: Record<string, ResolvedPerso> = {}
  for (const perso of Object.values(materialized.persos)) {
    persos[perso.key] = {
      key: perso.key,
      storyId: perso.storyId,
      persoId: perso.persoId,
      type: perso.type,
      state: resolvePerso(perso),
    }
  }
  return { timeMs: materialized.timeMs, persos }
}

/** Resolves one perso without mutating compiled or materialized input data. */
function resolvePerso(perso: MaterializedPerso): CompiledRecord {
  const state = cloneRecord(perso.initial)
  normalizeStyleColors(state)
  for (const activeAction of perso.actions) {
    applyAction(state, activeAction.action, activeAction.elapsedMs)
  }
  return state
}

/** Applies the supported discrete and continuous action groups. */
function applyAction(state: Record<string, CompiledValue>, action: CompiledRecord, elapsedMs: number): void {
  if (isPlainRecord(action.className)) {
    state.className = applyClassNamePatch(state.className, action.className)
  }
  if (!isPlainRecord(action.style)) return
  const currentStyle: Record<string, CompiledValue> = isPlainRecord(state.style)
    ? { ...(state.style as CompiledRecord) }
    : {}
  for (const [property, value] of Object.entries(action.style)) {
    currentStyle[property] = resolveStyleValue(property, currentStyle[property], value, elapsedMs)
  }
  state.style = currentStyle
}

/** Resolves one explicit tween or preserves one direct style value. */
function resolveStyleValue(
  property: string,
  current: CompiledValue | undefined,
  value: CompiledValue,
  elapsedMs: number,
): CompiledValue {
  if (!isPlainRecord(value) || !('to' in value)) return normalizeColor(property, value) ?? value
  const to = normalizeColor(property, value.to)
  if (!isTweenValue(to)) throw new Error('Resolve only supports scalar or color style tweens.')
  const from = normalizeColor(property, value.from ?? current)
  if (!isTweenValue(from)) throw new Error('Resolve requires an explicit or materialized tween from.')
  const tween = prepareTween({
    from,
    to,
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    delay: typeof value.delay === 'number' ? value.delay : undefined,
    ease: typeof value.ease === 'string' ? value.ease : undefined,
  })
  return resolveTween(tween, elapsedMs) as CompiledValue
}

/** Normalizes initial colors before values enter ACE. */
function normalizeStyleColors(state: Record<string, CompiledValue>): void {
  if (!isPlainRecord(state.style)) return
  const style = state.style as Record<string, CompiledValue>
  for (const [property, value] of Object.entries(style)) {
    const normalized = normalizeColor(property, value)
    if (normalized !== undefined) style[property] = normalized
  }
}

/** Normalizes the color properties supported by this first resolve slice. */
function normalizeColor(property: string, value: CompiledValue | undefined): CompiledValue | undefined {
  if (!isColorProperty(property) || typeof value !== 'string') return value
  return parseColor(value)
}

/** Identifies the supported style color properties. */
function isColorProperty(property: string): boolean {
  return property === 'color' || property === 'backgroundColor' || property === 'borderColor'
}

/** Checks scalar and normalized color values accepted by ACE. */
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

/** Applies an authored class patch without mutating the previous state. */
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

/** Clones one compiled record before resolving its state. */
function cloneRecord(record: CompiledRecord): Record<string, CompiledValue> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, cloneValue(value)]))
}

/** Clones recursive compiled values without mutating compiled input. */
function cloneValue(value: CompiledValue): CompiledValue {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (isPlainRecord(value)) return cloneRecord(value)
  return value
}

/** Checks values accepted by the scalar and color resolver. */
function isScalar(value: CompiledValue | undefined): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

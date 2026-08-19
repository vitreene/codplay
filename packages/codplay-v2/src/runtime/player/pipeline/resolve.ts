import {
  parseColor,
  parseEase,
  prepareTransformTween,
  prepareTween,
  resolveTween,
  type ColorValue,
  type TransformProperty,
} from '../../../ace'
import { isPlainRecord } from '../../../shared'
import type { CompiledFunctionCollection, CompiledRecord, CompiledValue } from '../../../scene/compiled'
import { selectEffectiveMove } from '../../move/move-policy'
import { isTweenAction } from './action-sequence'
import type { MaterializedPerso, MaterializedScene, ResolvedPerso, ResolvedScene } from './types'

/** Resolves discrete patches and continuous ACE values for one materialized scene. */
export function resolveScene(
  materialized: MaterializedScene,
  functions: CompiledFunctionCollection = {},
): ResolvedScene {
  const persos: Record<string, ResolvedPerso> = {}
  for (const perso of Object.values(materialized.persos)) {
    persos[perso.key] = {
      key: perso.key,
      storyId: perso.storyId,
      persoId: perso.persoId,
      type: perso.type,
      state: resolvePerso(perso, functions),
      ...resolvePlacement(perso),
    }
  }
  return {
    scene: materialized.scene,
    timeMs: materialized.timeMs,
    sceneState: materialized.sceneState,
    storyStates: materialized.storyStates,
    persos,
  }
}

/** Resolves the last active authored move without resolving its target registry yet. */
function resolvePlacement(perso: MaterializedPerso): Pick<ResolvedPerso, 'placement' | 'moveIssues'> {
  const result = selectEffectiveMove(perso.initial.move, perso.actions)
  return { placement: result.placement, moveIssues: result.issues }
}

/** Resolves one perso without mutating compiled or materialized input data. */
function resolvePerso(perso: MaterializedPerso, functions: CompiledFunctionCollection): CompiledRecord {
  const state = cloneRecord(perso.initial)
  normalizeStyleColors(state)
  for (const activeAction of perso.actions) {
    applyAction(state, activeAction.action, activeAction.elapsedMs, functions)
  }
  return state
}

/** Applies the supported discrete and continuous action groups. */
function applyAction(
  state: Record<string, CompiledValue>,
  action: CompiledRecord,
  elapsedMs: number,
  functions: CompiledFunctionCollection,
): void {
  if (isTweenAction(action)) {
    const payload = resolveTweenAction(action, elapsedMs, functions)
    if (payload === undefined) return
    applyActionPayload(state, payload, elapsedMs)
    return
  }
  applyActionPayload(state, action, elapsedMs)
}

/** Applies one ordinary action payload after any continuous function evaluation. */
function applyActionPayload(
  state: Record<string, CompiledValue>,
  action: CompiledRecord,
  elapsedMs: number,
): void {
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

/** Evaluates one compiled TweenAction into an ordinary action payload. */
function resolveTweenAction(
  action: CompiledRecord,
  elapsedMs: number,
  functions: CompiledFunctionCollection,
): CompiledRecord | undefined {
  if (!isTweenAction(action)) return undefined
  const fn = functions[action.fn.ref]
  if (fn === undefined) {
    throw new Error(`TweenAction function is not available: ${action.fn.ref}`)
  }
  const rawProgress = clamp(elapsedMs / action.duration, 0, 1)
  const ease = parseEase(typeof action.ease === 'string' ? action.ease : 'linear')
  const progress = ease(rawProgress)
  let output: unknown
  try {
    output = fn({ progress, data: action })
  } catch (error) {
    throw new Error(
      `TweenAction function failed: ${action.fn.ref}: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }
  if (output === undefined) return undefined
  if (!isPlainRecord(output)) {
    throw new Error(`TweenAction function must return a record or undefined: ${action.fn.ref}`)
  }
  return output as CompiledRecord
}

/** Clamps one continuous progress value to the closed interval [0, 1]. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Resolves one explicit tween or preserves one direct style value. */
function resolveStyleValue(
  property: string,
  current: CompiledValue | undefined,
  value: CompiledValue,
  elapsedMs: number,
): CompiledValue {
  const transformProperty = resolveTransformProperty(property)
  if (transformProperty !== undefined) return resolveTransformStyleValue(transformProperty, current, value, elapsedMs)
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

/** Resolves one scalar transform channel from the authored x/y aliases. */
function resolveTransformStyleValue(
  property: TransformProperty,
  current: CompiledValue | undefined,
  value: CompiledValue,
  elapsedMs: number,
): CompiledValue {
  if (!isPlainRecord(value) || !('to' in value)) return value
  if (!isScalar(value.to)) throw new Error(`Transform channel ${property} requires a scalar target.`)
  const from = value.from === undefined
    ? isScalar(current) ? current : undefined
    : isScalar(value.from) ? value.from : undefined
  if (value.from !== undefined && from === undefined) {
    throw new Error(`Transform channel ${property} requires a scalar from value.`)
  }
  return resolveTween(prepareTransformTween({
    property,
    from,
    to: value.to,
    duration: typeof value.duration === 'number' ? value.duration : undefined,
    delay: typeof value.delay === 'number' ? value.delay : undefined,
    ease: typeof value.ease === 'string' ? value.ease : undefined,
  }), elapsedMs) as CompiledValue
}

/** Maps the supported style aliases to their canonical ACE transform channels. */
function resolveTransformProperty(property: string): TransformProperty | undefined {
  if (property === 'x') return 'translateX'
  if (property === 'y') return 'translateY'
  return undefined
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

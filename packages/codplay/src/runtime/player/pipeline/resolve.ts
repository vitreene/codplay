import {
  isScalarTransformProperty,
  parseEase,
  prepareTransformTween,
  prepareTween,
  resolveTransformProperty as canonicalTransformProperty,
  resolveTween,
  type ColorValue,
  type TransformProperty,
} from 'ace'
import { cloneRecord, cloneValue, isPlainRecord } from '../../../shared'
import {
  isCompiledLengthValue,
  type CompiledFunctionCollection,
  type CompiledRecord,
  type CompiledValue,
} from '../../../scene/compiled'
import { selectEffectiveMove } from '../../move/move-policy'
import { isActionSequence, isTweenAction } from './action-sequence'
import { resolveActionDefinition } from './action-resolution'
import { resolveStyleTweenTiming } from './style-timing'
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
      actions: perso.actions,
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

/** Resolves one capture action against a current perso state without journaling it. */
export function resolveLiveCaptureActionState(
  baseState: CompiledRecord,
  actionValue: CompiledValue | undefined,
  eventData: CompiledRecord | undefined,
  functions: CompiledFunctionCollection = {},
): CompiledRecord | undefined {
  const action = resolveActionDefinition(actionValue, eventData)
  if (action === null) return undefined
  if (isActionSequence(action)) {
    throw new Error('Live capture actions cannot target an ActionSequence.')
  }
  const state = cloneRecord(baseState)
  applyAction(state, action, 0, functions)
  return state
}

/** Resolves the last active authored move without resolving its target registry yet. */
function resolvePlacement(perso: MaterializedPerso): Pick<ResolvedPerso, 'placement' | 'moveIssues'> {
  const result = selectEffectiveMove(perso.initial.move, perso.actions)
  return { placement: result.placement, moveIssues: result.issues }
}

/** Resolves one perso without mutating compiled or materialized input data. */
function resolvePerso(perso: MaterializedPerso, functions: CompiledFunctionCollection): CompiledRecord {
  const state = cloneRecord(perso.initial)
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
  // Source is reconstructible logical state; media components own side-effectful node caches.
  // Component-specific fields are copied as well so core components do not need a parallel
  // action-resolution circuit. Style and className retain their dedicated patch semantics.
  for (const [property, value] of Object.entries(action)) {
    if (property === 'className' || property === 'style') continue
    if (property === 'attr' || property === 'move') {
      state[property] = cloneValue(value)
      continue
    }
    if (isPlainRecord(value) && isPlainRecord(state[property])) {
      state[property] = { ...(state[property] as CompiledRecord), ...cloneRecord(value) }
      continue
    }
    state[property] = cloneValue(value)
  }
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
  if (isLengthTween(value, current)) return resolveLengthStyleValue(property, current, value, elapsedMs)
  const transformProperty = resolveTransformProperty(property)
  if (transformProperty !== undefined) return resolveTransformStyleValue(transformProperty, current, value, elapsedMs)
  if (!isPlainRecord(value) || !('to' in value)) return value
  const to = value.to
  if (!isTweenValue(to)) throw new Error('Resolve only supports scalar or color style tweens.')
  const from = value.from ?? current
  if (!isTweenValue(from)) throw new Error('Resolve requires an explicit or materialized tween from.')
  const timing = resolveStyleTweenTiming(value)
  if (timing === undefined) throw new Error('Resolve requires a style tween declaration.')
  const tween = prepareTween({
    from,
    to,
    ...timing,
  })
  return resolveTween(tween, elapsedMs) as CompiledValue
}

/** Resolves one tween whose bounds are explicit logical lengths and retains that shape. */
function resolveLengthStyleValue(
  property: string,
  current: CompiledValue | undefined,
  value: CompiledRecord,
  elapsedMs: number,
): CompiledValue {
  const to = value.to
  if (!isCompiledLengthValue(to)) {
    throw new Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${property} mixes a cqw length with a CSS value.`)
  }
  const from = value.from ?? current
  if (!isCompiledLengthValue(from)) {
    throw new Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${property} mixes a cqw length with a CSS value.`)
  }
  if (from.unit !== to.unit) {
    throw new Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${property} uses incompatible length units.`)
  }
  const timing = resolveStyleTweenTiming(value)
  if (timing === undefined) throw new Error('Resolve requires a style tween declaration.')
  const resolved = resolveTween(prepareTween({
    from: `${from.value}${from.unit}`,
    to: `${to.value}${to.unit}`,
    ...timing,
  }), elapsedMs)
  const numericValue = typeof resolved === 'number' ? resolved : Number.parseFloat(String(resolved))
  if (!Number.isFinite(numericValue)) {
    throw new Error(`RUNTIME_STYLE_LENGTH_INCOMPATIBLE: property ${property} produced an invalid cqw value.`)
  }
  return { kind: 'length', unit: to.unit, value: numericValue }
}

/** Reports whether a style tween has an explicit logical length endpoint. */
function isLengthTween(value: CompiledValue, current: CompiledValue | undefined): value is CompiledRecord {
  if (!isPlainRecord(value) || !('to' in value)) return false
  return isCompiledLengthValue(value.to)
    || isCompiledLengthValue(value.from)
    || isCompiledLengthValue(current)
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
  const timing = resolveStyleTweenTiming(value)
  if (timing === undefined) throw new Error('Resolve requires a transform tween declaration.')
  return resolveTween(prepareTransformTween({
    property,
    from,
    to: value.to,
    ...timing,
  }), elapsedMs) as CompiledValue
}

/** Maps the supported style aliases to their canonical ACE transform channels. */
function resolveTransformProperty(property: string): TransformProperty | undefined {
  const canonical = canonicalTransformProperty(property)
  return canonical !== undefined && isScalarTransformProperty(canonical) ? canonical : undefined
}

/** Checks scalar and normalized color values accepted by ACE. */
function isTweenValue(value: unknown): value is string | number | ColorValue {
  return isScalar(value) || isColorValue(value)
}

/** Checks one normalized color value. */
function isColorValue(value: unknown): value is ColorValue {
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

/** Checks values accepted by the scalar and color resolver. */
function isScalar(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

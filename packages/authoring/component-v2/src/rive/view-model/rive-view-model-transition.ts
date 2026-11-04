import type { ComponentActionOccurrence } from 'codplay'
import type { RiveInputValues, RiveViewModelActionPayload } from '../rive-types'

type ValueTransition = Readonly<{
  from: RiveInputValues
  to: RiveInputValues
  startAt: number
}>

const SETTLE_THRESHOLD = 0.05

/** Reconstructs numeric ViewModel transitions at one absolute CodPlay time. */
export function resolveRiveViewModelTransition(
  defaults: RiveInputValues,
  initialValues: RiveInputValues | undefined,
  resolvedValues: RiveInputValues,
  activeActions: readonly ComponentActionOccurrence[],
  timeMs: number,
  blendSpeed: number,
): RiveInputValues {
  if (blendSpeed === 0) return resolvedValues

  const valueActions = activeActions
    .filter((occurrence) => occurrence.startAt <= timeMs
      && (occurrence.action as RiveViewModelActionPayload).values !== undefined)
    .sort((left, right) => left.startAt - right.startAt)
    .map((occurrence) => ({
      startAt: occurrence.startAt,
      values: (occurrence.action as RiveViewModelActionPayload).values!,
    }))

  if (valueActions.length === 0) return resolvedValues

  const animatedNames = new Set(valueActions.flatMap(({ values }) =>
    Object.keys(values).filter((name) => typeof values[name] === 'number')))
  if (animatedNames.size === 0) return resolvedValues

  const baseline = { ...defaults, ...initialValues }
  const history = valueActions.reduce<{
    target: RiveInputValues
    transition: ValueTransition
  } | undefined>((previous, action) => {
    const from = previous === undefined
      ? baseline
      : sampleTransition(previous.transition, action.startAt, blendSpeed)
    const target = { ...(previous?.target ?? baseline), ...action.values }
    return {
      target,
      transition: { from, to: target, startAt: action.startAt },
    }
  }, undefined)
  if (history === undefined) return resolvedValues

  const sampledValues = sampleTransition(history.transition, timeMs, blendSpeed)
  const result: Record<string, number | boolean> = { ...resolvedValues }
  animatedNames.forEach((name) => {
    const value = sampledValues[name]
    if (typeof value === 'number') result[name] = value
  })
  return result
}

/** Applies the reference tester's exponential blend and settling threshold. */
function sampleTransition(
  transition: ValueTransition,
  timeMs: number,
  blendSpeed: number,
): RiveInputValues {
  const elapsedMs = Math.max(0, timeMs - transition.startAt)
  const names = new Set([...Object.keys(transition.from), ...Object.keys(transition.to)])
  const values: Record<string, number | boolean> = {}

  names.forEach((name) => {
    const from = transition.from[name]
    const to = transition.to[name]
    if (typeof from === 'number' && typeof to === 'number') {
      const remaining = Math.exp(-blendSpeed * elapsedMs / 1000)
      const value = to + (from - to) * remaining
      values[name] = Math.abs(to - value) <= SETTLE_THRESHOLD ? to : value
      return
    }
    if (to !== undefined) values[name] = to
    else if (from !== undefined) values[name] = from
  })
  return values
}

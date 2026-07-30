import { applyRelative, compose, decompose, type RelativeOperator } from './values'
import { prepareTween, resolveTween, type Tween, type TweenInput } from './tween'

/** A numeric or unit-bearing coordinate accepted by a polar declaration. */
export type PolarMeasure = number | string

/** An authored polar coordinate, using CSS rotate and translate value forms. */
export type PolarCoordinates = Readonly<{
  a: PolarMeasure
  d: PolarMeasure
}>

/** A polar value declaration prepared as two synchronized tweens. */
export type PolarInput = Readonly<{
  from: PolarCoordinates
  to: PolarCoordinates
  origin?: readonly [PolarMeasure, PolarMeasure]
} & Omit<TweenInput, 'from' | 'to' | 'path'>>

/** A prepared polar tween that resolves to an ordered x/y pair. */
export type PolarTween = Readonly<{
  angle: Tween
  distance: Tween
  origin: readonly [number, number]
  unit: string | null
}>

type PreparedAngle = Readonly<{
  value: number
  operator: RelativeOperator | null
}>

const ANGLE_UNITS: Readonly<Record<string, number>> = {
  deg: Math.PI / 180,
  grad: Math.PI / 200,
  rad: 1,
  turn: Math.PI * 2,
}

/** Normalizes a CSS rotate value into radians. */
const prepareAngle = (value: PolarMeasure, name: 'from' | 'to'): PreparedAngle => {
  const decomposed = decompose(value)
  if (decomposed.kind === 'number') {
    return { value: decomposed.number * ANGLE_UNITS.deg, operator: decomposed.operator }
  }
  if (decomposed.kind !== 'unit' || !decomposed.unit || ANGLE_UNITS[decomposed.unit] === undefined) {
    throw new Error(`ace: polar.${name}.a doit etre un angle CSS`)
  }
  return {
    value: decomposed.number * ANGLE_UNITS[decomposed.unit],
    operator: decomposed.operator,
  }
}

/** Resolves an origin coordinate against the distance unit. */
const prepareOriginCoordinate = (value: PolarMeasure, unit: string | null): number => {
  const decomposed = decompose(value)
  if (decomposed.kind !== 'number' && decomposed.kind !== 'unit') {
    throw new Error('ace: polar.origin doit etre une coordonnee de mesure')
  }
  if (decomposed.operator) throw new Error('ace: polar.origin ne peut pas etre relative')
  if (decomposed.unit === unit) return decomposed.number
  if (decomposed.unit === null && decomposed.number === 0) return 0
  throw new Error('ace: polar.origin doit employer la meme unite que d')
}

/** Prepares a polar declaration with an explicit or zero origin. */
export const preparePolarTween = (input: PolarInput): PolarTween => {
  const { from, to, origin = [0, 0], ...timing } = input
  const fromAngle = prepareAngle(from.a, 'from')
  const toAngle = prepareAngle(to.a, 'to')
  if (fromAngle.operator) throw new Error('ace: polar.from.a ne peut pas etre relative')

  const angle = prepareTween({
    ...timing,
    from: fromAngle.value,
    to: toAngle.operator
      ? applyRelative(fromAngle.value, toAngle.value, toAngle.operator)
      : toAngle.value,
  })
  const distance = prepareTween({ ...timing, from: from.d, to: to.d })
  if (distance.interval.kind !== 'number') {
    throw new Error('ace: polar.d doit etre une valeur de translate scalaire')
  }

  const unit = distance.interval.unit
  return {
    angle,
    distance,
    origin: [
      prepareOriginCoordinate(origin[0], unit),
      prepareOriginCoordinate(origin[1], unit),
    ],
    unit,
  }
}

/** Resolves a prepared polar tween into x/y coordinates. */
export const resolvePolarTween = (tween: PolarTween, instant: number): readonly [number | string, number | string] => {
  const angle = resolveTween(tween.angle, instant)
  const distance = resolveTween(tween.distance, instant)
  if (typeof angle !== 'number') throw new Error('ace: polar angle invalide')

  const decomposedDistance = decompose(distance as number | string)
  if (decomposedDistance.kind !== 'number' && decomposedDistance.kind !== 'unit') {
    throw new Error('ace: polar distance invalide')
  }
  const x = tween.origin[0] + decomposedDistance.number * Math.cos(angle)
  const y = tween.origin[1] + decomposedDistance.number * Math.sin(angle)
  const kind = tween.unit === null ? 'number' : 'unit'
  return [compose(kind, x, tween.unit), compose(kind, y, tween.unit)]
}

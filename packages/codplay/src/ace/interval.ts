import { applyRelative, compose, decompose, lerp } from './values'
import {
  ACHROMATIC_CHROMA,
  isColorCandidate,
  isColorValue,
  isLegacySrgbColorValue,
  parseColor,
  toOklchColor,
  type ColorSpace,
  type ColorValue,
  type LegacySrgbColorValue,
} from './adapters/color-adapter'

export type { ColorSpace, ColorValue }

/** Direction retenue pour le passage entre deux teintes polaires. */
export type HuePath = 'shorter' | 'longer' | 'increasing' | 'decreasing'

/** Un objet de valeur preparee, potentiellement imbrique. */
export interface InterpolationObject {
  readonly [key: string]: InterpolationValue
}

/** Toute valeur preparee qu'ACE peut interpoler. */
export type InterpolationValue =
  | number
  | string
  | boolean
  | null
  | undefined
  | ColorValue
  | LegacySrgbColorValue
  | readonly InterpolationValue[]
  | InterpolationObject

type NumberInterval = Readonly<{
  kind: 'number'
  from: number
  to: number
  unit: string | null
}>

type ColorInterval = Readonly<{
  kind: 'color'
  space: ColorSpace
  from: readonly number[]
  to: readonly number[]
  fromAlpha: number
  toAlpha: number
  hue: HuePath
}>

type StringInterval = Readonly<{
  kind: 'string'
  parts: ReadonlyArray<string | NumberInterval>
}>

type ArrayInterval = Readonly<{
  kind: 'array'
  values: ReadonlyArray<Interval>
}>

type ObjectInterval = Readonly<{
  kind: 'object'
  values: Readonly<Record<string, Interval>>
}>

type ConstantInterval = Readonly<{
  kind: 'constant'
  value: InterpolationValue
}>

/** Un intervalle prepare hors du chemin chaud. */
export type Interval =
  | NumberInterval
  | ColorInterval
  | StringInterval
  | ArrayInterval
  | ObjectInterval
  | ConstantInterval

const NUMBER_PATTERN = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g

const isColor = (value: InterpolationValue): value is ColorValue | LegacySrgbColorValue =>
  isColorValue(value) || isLegacySrgbColorValue(value)

const isRecord = (value: InterpolationValue): value is InterpolationObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !isColor(value)

/**
 * Normalizes a CSS color string or a legacy sRGB value into OKLCH before interval preparation.
 * @deprecated path for strings: compiled scenes already carry OKLCH `ColorValue`s.
 */
const normalizeColorInput = (value: InterpolationValue): InterpolationValue => {
  if (typeof value === 'string') return isColorCandidate(value) ? parseColor(value) : value
  return isLegacySrgbColorValue(value) ? toOklchColor(value) : value
}

/**
 * Prepare un nombre, avec ou sans unite, en appliquant les operateurs relatifs d'anime.
 */
const prepareNumber = (from: number | string, to: number | string): NumberInterval => {
  const fromValue = decompose(from)
  const toValue = decompose(to)
  if (fromValue.kind === 'color' || toValue.kind === 'color') {
    throw new Error('ace: une couleur ne peut pas etre preparee comme un nombre')
  }
  if (fromValue.kind !== 'number' && fromValue.kind !== 'unit') {
    throw new Error('ace: cette valeur textuelle doit etre preparee comme chaine composee')
  }
  if (toValue.kind !== 'number' && toValue.kind !== 'unit') {
    throw new Error('ace: cette valeur textuelle doit etre preparee comme chaine composee')
  }
  if (fromValue.operator) throw new Error('ace: from ne peut pas etre une valeur relative')
  if (fromValue.unit !== toValue.unit) {
    throw new Error('ace: from et to doivent employer la meme unite')
  }
  return {
    kind: 'number',
    from: fromValue.number,
    to: toValue.operator
      ? applyRelative(fromValue.number, toValue.number, toValue.operator)
      : toValue.number,
    unit: fromValue.unit,
  }
}

/**
 * Prepare les fragments fixes et les nombres mobiles d'une chaine composee.
 */
const prepareString = (from: string, to: string): StringInterval => {
  const fromNumbers = from.matchAll(NUMBER_PATTERN)
  const toNumbers = to.matchAll(NUMBER_PATTERN)
  const parts: Array<string | NumberInterval> = []
  let cursor = 0

  while (true) {
    const fromMatch = fromNumbers.next()
    const toMatch = toNumbers.next()
    if (fromMatch.done || toMatch.done) break

    const source = fromMatch.value
    const target = toMatch.value
    if (target.index > cursor) parts.push(to.slice(cursor, target.index))
    if (source[0] === target[0]) parts.push(target[0])
    else parts.push(prepareNumber(+source[0], +target[0]))
    cursor = target.index + target[0].length
  }

  if (cursor < to.length || parts.length === 0) parts.push(to.slice(cursor))
  return { kind: 'string', parts }
}

/**
 * Prepare deux couleurs OKLCH. Une borne achromatique emprunte la teinte de l'autre borne.
 */
const prepareColor = (from: ColorValue, to: ColorValue): ColorInterval => {
  const fromCoords = [...from.coords]
  const toCoords = [...to.coords]
  if (fromCoords[1] < ACHROMATIC_CHROMA) fromCoords[2] = toCoords[2]
  else if (toCoords[1] < ACHROMATIC_CHROMA) toCoords[2] = fromCoords[2]
  return {
    kind: 'color',
    space: 'oklch',
    from: fromCoords,
    to: toCoords,
    fromAlpha: from.alpha,
    toAlpha: to.alpha,
    hue: 'shorter',
  }
}

/**
 * Normalise les couleurs CSS puis prepare une valeur pour l'interpolation recursive.
 */
const prepareValue = (from: InterpolationValue, to: InterpolationValue): Interval => {
  const normalizedFrom = normalizeColorInput(from)
  const normalizedTo = normalizeColorInput(to)

  if (isColor(normalizedFrom) || isColor(normalizedTo)) {
    if (!isColor(normalizedFrom) || !isColor(normalizedTo)) {
      throw new Error('ace: from et to doivent etre deux couleurs ou deux valeurs de meme nature')
    }
    return prepareColor(toOklchColor(normalizedFrom), toOklchColor(normalizedTo))
  }

  if (Array.isArray(normalizedFrom) || Array.isArray(normalizedTo)) {
    if (!Array.isArray(normalizedFrom) || !Array.isArray(normalizedTo)) {
      throw new Error('ace: from et to doivent etre deux tableaux ou deux valeurs de meme nature')
    }
    const values: Interval[] = []
    const commonLength = Math.min(normalizedFrom.length, normalizedTo.length)
    for (let index = 0; index < commonLength; index++) {
      values.push(prepareValue(normalizedFrom[index], normalizedTo[index]))
    }
    for (let index = commonLength; index < normalizedTo.length; index++) {
      values.push({ kind: 'constant', value: normalizedTo[index] })
    }
    return { kind: 'array', values }
  }

  if (isRecord(normalizedFrom) || isRecord(normalizedTo)) {
    if (!isRecord(normalizedFrom) || !isRecord(normalizedTo)) {
      throw new Error('ace: from et to doivent etre deux objets ou deux valeurs de meme nature')
    }
    const values: Record<string, Interval> = {}
    for (const [key, value] of Object.entries(normalizedTo)) {
      values[key] = key in normalizedFrom
        ? prepareValue(normalizedFrom[key], value)
        : { kind: 'constant', value }
    }
    return { kind: 'object', values }
  }

  if (
    (typeof normalizedFrom === 'number' || typeof normalizedFrom === 'string') &&
    (typeof normalizedTo === 'number' || typeof normalizedTo === 'string')
  ) {
    const fromValue = decompose(normalizedFrom)
    const toValue = decompose(normalizedTo)
    return fromValue.kind === 'complex' || toValue.kind === 'complex'
      ? prepareString(String(normalizedFrom), String(normalizedTo))
      : prepareNumber(normalizedFrom, normalizedTo)
  }
  return { kind: 'constant', value: normalizedTo }
}

/**
 * Interpole une teinte selon le chemin prepare, avec une teinte absente propagee depuis l'autre borne.
 */
const resolveHue = (from: number, to: number, progress: number, path: HuePath): number => {
  if (Number.isNaN(from)) return to
  if (Number.isNaN(to)) return from
  const delta = to - from
  const shortest = ((delta + 540) % 360) - 180
  const distance = path === 'shorter'
    ? shortest
    : path === 'longer'
      ? shortest <= 0 ? shortest + 360 : shortest - 360
      : path === 'increasing'
        ? ((delta % 360) + 360) % 360
        : -(((-delta % 360) + 360) % 360)
  return from + distance * progress
}

/**
 * Interpole lightness et chroma en alpha premultiplie (CSS Color 4) ; la teinte ne l'est jamais.
 */
const resolveColor = (interval: ColorInterval, progress: number): ColorValue => {
  const alpha = lerp(interval.fromAlpha, interval.toAlpha, progress)
  const premultiplied = (index: number): number => alpha === 0
    ? lerp(interval.from[index], interval.to[index], progress)
    : lerp(interval.from[index] * interval.fromAlpha, interval.to[index] * interval.toAlpha, progress) / alpha
  return {
    kind: 'color',
    space: interval.space,
    coords: [premultiplied(0), premultiplied(1), resolveHue(interval.from[2], interval.to[2], progress, interval.hue)],
    alpha,
  }
}

/**
 * Resout un intervalle prepare pour une progression deja calculee.
 */
const resolveValue = (interval: Interval, progress: number): InterpolationValue => {
  if (interval.kind === 'constant') return interval.value
  if (interval.kind === 'number') {
    return compose(
      interval.unit === null ? 'number' : 'unit',
      lerp(interval.from, interval.to, progress),
      interval.unit,
    )
  }
  if (interval.kind === 'color') return resolveColor(interval, progress)
  if (interval.kind === 'string') {
    return interval.parts.map((part) =>
      typeof part === 'string' ? part : resolveValue(part, progress),
    ).join('')
  }
  if (interval.kind === 'array') return interval.values.map((value) => resolveValue(value, progress))
  return Object.fromEntries(
    Object.entries(interval.values).map(([key, value]) => [key, resolveValue(value, progress)]),
  )
}

/** Prepares interpolation bounds, normalizing supported CSS colors without reading state. */
export const prepareInterval = (from: InterpolationValue, to: InterpolationValue): Interval =>
  prepareValue(from, to)

/**
 * Resout un intervalle prepare pour une progression deja calculee.
 */
export const resolveInterval = (interval: Interval, progress: number): InterpolationValue =>
  resolveValue(interval, progress)

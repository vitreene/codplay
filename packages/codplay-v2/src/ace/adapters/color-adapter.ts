import type { ColorValue } from '../interval'
import { NAMED_COLORS } from './named-colors'

/** Parses supported CSS color author values into the ACE color intermediate form. */
export function parseColor(value: string): ColorValue {
  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) {
    throw new Error('ace: color value must not be empty.')
  }

  if (normalized === 'transparent') {
    return createSrgbValue([0, 0, 0], 0)
  }

  const named = NAMED_COLORS[normalized]
  if (named !== undefined) {
    return createSrgbValue(named, 1)
  }

  if (normalized.startsWith('#')) {
    return parseHexColor(normalized)
  }

  const functionMatch = /^(rgba?|RGBA?)\((.*)\)$/.exec(normalized)
  if (functionMatch !== null) {
    return parseRgbColor(functionMatch[2])
  }

  const oklchMatch = /^oklch\((.*)\)$/.exec(normalized)
  if (oklchMatch !== null) {
    return parseOklchColor(oklchMatch[1])
  }

  throw new Error(`ace: unsupported color value "${value}".`)
}

/** Creates one normalized sRGB value from 8-bit channels and alpha. */
function createSrgbValue(rgb: readonly [number, number, number], alpha: number): ColorValue {
  return {
    kind: 'color',
    space: 'srgb',
    coords: rgb.map((channel) => channel / 255),
    alpha,
  }
}

/** Parses short and long hexadecimal color forms. */
function parseHexColor(value: string): ColorValue {
  const digits = value.slice(1)
  if (![3, 4, 6, 8].includes(digits.length) || !/^[\da-f]+$/i.test(digits)) {
    throw new Error(`ace: invalid hexadecimal color "${value}".`)
  }

  const expanded = digits.length <= 4
    ? [...digits].map((digit) => `${digit}${digit}`).join('')
    : digits
  const channels = [
    Number.parseInt(expanded.slice(0, 2), 16),
    Number.parseInt(expanded.slice(2, 4), 16),
    Number.parseInt(expanded.slice(4, 6), 16),
  ] as [number, number, number]
  const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1
  return createSrgbValue(channels, alpha)
}

/** Parses comma and space-separated rgb/rgba function bodies. */
function parseRgbColor(body: string): ColorValue {
  const commaParts = body.split(',').map((part) => part.trim())
  if (commaParts.length >= 3 && commaParts.length <= 4) {
    const rgb = commaParts.slice(0, 3).map(parseRgbChannel) as [number, number, number]
    const alpha = commaParts[3] === undefined ? 1 : parseAlpha(commaParts[3])
    return createSrgbValue(rgb, alpha)
  }

  const [channelsPart, alphaPart] = splitAlpha(body)
  const channelParts = channelsPart.trim().split(/\s+/).filter(Boolean)
  if (channelParts.length !== 3) {
    throw new Error(`ace: invalid rgb color "${body}".`)
  }
  const rgb = channelParts.map(parseRgbChannel) as [number, number, number]
  return createSrgbValue(rgb, alphaPart === undefined ? 1 : parseAlpha(alphaPart))
}

/** Parses the CSS OKLCH function into the V2 OKLCH intermediate form. */
function parseOklchColor(body: string): ColorValue {
  const [channelsPart, alphaPart] = splitAlpha(body)
  const channelParts = channelsPart.trim().split(/\s+/).filter(Boolean)
  if (channelParts.length !== 3) {
    throw new Error(`ace: invalid oklch color "${body}".`)
  }

  return {
    kind: 'color',
    space: 'oklch',
    coords: [
      parseOklchLightness(channelParts[0]),
      parseOklchChroma(channelParts[1]),
      parseOklchHue(channelParts[2]),
    ],
    alpha: alphaPart === undefined ? 1 : parseAlpha(alphaPart),
  }
}

/** Parses OKLCH lightness as a clamped number or percentage. */
function parseOklchLightness(value: string): number {
  const normalized = value.trim()
  if (normalized.endsWith('%')) {
    const rawPercentage = normalized.slice(0, -1).trim()
    if (!CSS_NUMBER_PATTERN.test(rawPercentage)) {
      throw new Error(`ace: invalid oklch lightness "${value}".`)
    }
    const percentage = Number(rawPercentage)
    if (!Number.isFinite(percentage)) throw new Error(`ace: invalid oklch lightness "${value}".`)
    return clamp(percentage / 100, 0, 1)
  }
  if (!CSS_NUMBER_PATTERN.test(normalized)) {
    throw new Error(`ace: invalid oklch lightness "${value}".`)
  }
  const lightness = Number(normalized)
  if (!Number.isFinite(lightness)) throw new Error(`ace: invalid oklch lightness "${value}".`)
  return clamp(lightness, 0, 1)
}

/** Parses OKLCH chroma, preserving values outside the displayable gamut. */
function parseOklchChroma(value: string): number {
  const normalized = value.trim()
  if (normalized.endsWith('%')) {
    const rawPercentage = normalized.slice(0, -1).trim()
    if (!CSS_NUMBER_PATTERN.test(rawPercentage)) {
      throw new Error(`ace: invalid oklch chroma "${value}".`)
    }
    const percentage = Number(rawPercentage)
    if (!Number.isFinite(percentage)) throw new Error(`ace: invalid oklch chroma "${value}".`)
    return Math.max(0, percentage / 100 * 0.4)
  }
  if (!CSS_NUMBER_PATTERN.test(normalized)) {
    throw new Error(`ace: invalid oklch chroma "${value}".`)
  }
  const chroma = Number(normalized)
  if (!Number.isFinite(chroma)) throw new Error(`ace: invalid oklch chroma "${value}".`)
  return Math.max(0, chroma)
}

/** Parses an OKLCH hue angle and stores it as normalized degrees. */
function parseOklchHue(value: string): number {
  const normalized = value.trim()
  const angleMatch = CSS_ANGLE_PATTERN.exec(normalized)
  if (angleMatch !== null) {
    const numericValue = Number(angleMatch[1])
    if (!Number.isFinite(numericValue)) throw new Error(`ace: invalid oklch hue "${value}".`)
    const unit = angleMatch[2].toLowerCase()
    const degrees = unit === 'grad'
      ? numericValue * 0.9
      : unit === 'rad'
        ? numericValue * 180 / Math.PI
        : unit === 'turn'
          ? numericValue * 360
          : numericValue
    if (!Number.isFinite(degrees)) throw new Error(`ace: invalid oklch hue "${value}".`)
    return normalizeHue(degrees)
  }
  if (!CSS_NUMBER_PATTERN.test(normalized)) {
    throw new Error(`ace: invalid oklch hue "${value}".`)
  }
  const hue = Number(normalized)
  if (!Number.isFinite(hue)) throw new Error(`ace: invalid oklch hue "${value}".`)
  return normalizeHue(hue)
}

/** Separates an optional slash alpha component from a modern rgb body. */
function splitAlpha(body: string): readonly [string, string | undefined] {
  const slashIndex = body.indexOf('/')
  if (slashIndex < 0) return [body, undefined]
  const alpha = body.slice(slashIndex + 1).trim()
  if (body.indexOf('/', slashIndex + 1) >= 0 || alpha.length === 0) {
    throw new Error(`ace: invalid color alpha "${alpha}".`)
  }
  return [body.slice(0, slashIndex), alpha]
}

/** Parses one rgb channel as a clamped number or percentage. */
function parseRgbChannel(value: string): number {
  const normalized = value.trim()
  if (normalized.endsWith('%')) {
    const rawPercentage = normalized.slice(0, -1).trim()
    if (!CSS_NUMBER_PATTERN.test(rawPercentage)) throw new Error(`ace: invalid rgb channel "${value}".`)
    const percentage = Number(rawPercentage)
    return clamp(percentage, 0, 100) / 100 * 255
  }
  if (!CSS_NUMBER_PATTERN.test(normalized)) throw new Error(`ace: invalid rgb channel "${value}".`)
  const channel = Number(normalized)
  return clamp(channel, 0, 255)
}

/** Parses an alpha channel as a clamped number or percentage. */
function parseAlpha(value: string): number {
  const normalized = value.trim()
  if (normalized.endsWith('%')) {
    const rawPercentage = normalized.slice(0, -1).trim()
    if (!CSS_NUMBER_PATTERN.test(rawPercentage)) throw new Error(`ace: invalid color alpha "${value}".`)
    const percentage = Number(rawPercentage)
    return clamp(percentage, 0, 100) / 100
  }
  if (!CSS_NUMBER_PATTERN.test(normalized)) throw new Error(`ace: invalid color alpha "${value}".`)
  const alpha = Number(normalized)
  return clamp(alpha, 0, 1)
}

/** Clamps one finite color channel to its CSS range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Wraps one hue angle into the canonical [0, 360) degree range. */
function normalizeHue(value: number): number {
  const wrapped = value % 360
  return wrapped === 0 ? 0 : wrapped < 0 ? wrapped + 360 : wrapped
}

/** Matches one complete CSS numeric token, without accepting trailing text. */
const CSS_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i

/** Matches one CSS hue angle with an optional non-degree unit. */
const CSS_ANGLE_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i

import { NAMED_COLORS } from './named-colors'
import {
  hslToSrgb,
  hwbToSrgb,
  labToOklch,
  oklabToOklch,
  polarToRectangular,
  predefinedToOklch,
  srgbToOklch,
  type PredefinedColorSpace,
} from './color-spaces'

/** The single color space kept by compiled scenes and ACE intervals. */
export type ColorSpace = 'oklch'

/** One normalized OKLCH color: lightness, chroma, hue in degrees, then alpha. */
export type ColorValue = Readonly<{
  kind: 'color'
  space: ColorSpace
  coords: readonly number[]
  alpha: number
}>

/**
 * Legacy sRGB intermediate, channels in [0, 1].
 * @deprecated Accepted at input only and converted to OKLCH; author colors go through the compiler.
 */
export type LegacySrgbColorValue = Readonly<{
  kind: 'color'
  space: 'srgb'
  coords: readonly number[]
  alpha: number
}>

type Channels = readonly [number, number, number]
type ChannelScale = Readonly<{ percent: number, min?: number, max?: number }>

const CSS_COLOR_CANDIDATE_PATTERN = /^(?:#|rgba?\(|hsla?\(|hwb\(|lab\(|lch\(|oklab\(|oklch\(|color\()/i
const COLOR_FUNCTION_PATTERN = /^([a-z]+)\((.*)\)$/
const CSS_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const CSS_ANGLE_PATTERN = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|grad|rad|turn)$/i
const ANGLE_TO_DEGREES: Readonly<Record<string, number>> = { deg: 1, grad: 0.9, rad: 180 / Math.PI, turn: 360 }
const PREDEFINED_SPACES: ReadonlySet<string> = new Set<PredefinedColorSpace>([
  'srgb', 'srgb-linear', 'display-p3', 'a98-rgb', 'prophoto-rgb', 'rec2020', 'xyz', 'xyz-d50', 'xyz-d65',
])
const FORMAT_PRECISION = 6

/** Below this OKLCH chroma the hue is powerless (CSS Color 4): conversion noise is dropped. */
export const ACHROMATIC_CHROMA = 1e-4

/** Identifies CSS color inputs that ACE can normalize or explicitly reject. */
export function isColorCandidate(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'transparent'
    || Object.prototype.hasOwnProperty.call(NAMED_COLORS, normalized)
    || CSS_COLOR_CANDIDATE_PATTERN.test(normalized)
}

/** Checks one normalized OKLCH color with finite coordinates. */
export function isColorValue(value: unknown): value is ColorValue {
  return isColorShape(value, 'oklch')
}

/** Checks the deprecated sRGB intermediate still accepted at input. */
export function isLegacySrgbColorValue(value: unknown): value is LegacySrgbColorValue {
  return isColorShape(value, 'srgb')
}

/** Brings a normalized or legacy sRGB color into the single OKLCH space. */
export function toOklchColor(value: ColorValue | LegacySrgbColorValue): ColorValue {
  if (value.space === 'oklch') return value
  const [red, green, blue] = value.coords
  return createOklchValue(srgbToOklch([red, green, blue]), value.alpha)
}

/** Writes one normalized color as CSS `oklch(...)`. */
export function formatColor(value: ColorValue): string {
  const [lightness, chroma, hue] = value.coords.map((coordinate) => Number(coordinate.toFixed(FORMAT_PRECISION)))
  return `oklch(${lightness} ${chroma} ${hue} / ${Number(value.alpha.toFixed(FORMAT_PRECISION))})`
}

/** Parses any supported CSS color author value into the single OKLCH form. */
export function parseColor(value: string): ColorValue {
  const normalized = value.trim().toLowerCase()
  if (normalized.length === 0) throw new Error('ace: color value must not be empty.')
  if (normalized === 'transparent') return createOklchValue([0, 0, 0], 0)

  const named = NAMED_COLORS[normalized]
  if (named !== undefined) return createOklchValue(srgbToOklch(scaleRgb(named)), 1)
  if (normalized.startsWith('#')) return parseHexColor(normalized)

  const match = COLOR_FUNCTION_PATTERN.exec(normalized)
  const parse = match === null ? undefined : COLOR_FUNCTIONS[match[1]]
  if (match === null || parse === undefined) throw new Error(`ace: unsupported color value "${value}".`)
  return parse(match[2], match[1])
}

const COLOR_FUNCTIONS: Readonly<Record<string, (body: string, name: string) => ColorValue>> = {
  rgb: parseRgbColor,
  rgba: parseRgbColor,
  hsl: parseHslColor,
  hsla: parseHslColor,
  hwb: (body, name) => {
    const { channels, alpha } = splitModernBody(body, name)
    const rgb = hwbToSrgb(parseHue(channels[0], name), parseUnit(channels[1], name), parseUnit(channels[2], name))
    return createOklchValue(srgbToOklch(rgb), alpha)
  },
  lab: (body, name) => {
    const { channels, alpha } = splitModernBody(body, name)
    const lightness = parseChannel(channels[0], name, { percent: 100, min: 0, max: 100 })
    const ab = { percent: 125 }
    return createOklchValue(labToOklch(lightness, parseChannel(channels[1], name, ab), parseChannel(channels[2], name, ab)), alpha)
  },
  lch: (body, name) => {
    const { channels, alpha } = splitModernBody(body, name)
    const [lightness, a, b] = polarToRectangular(
      parseChannel(channels[0], name, { percent: 100, min: 0, max: 100 }),
      parseChannel(channels[1], name, { percent: 150, min: 0 }),
      parseHue(channels[2], name),
    )
    return createOklchValue(labToOklch(lightness, a, b), alpha)
  },
  oklab: (body, name) => {
    const { channels, alpha } = splitModernBody(body, name)
    const ab = { percent: 0.4 }
    return createOklchValue(oklabToOklch([
      parseChannel(channels[0], name, { percent: 1, min: 0, max: 1 }),
      parseChannel(channels[1], name, ab),
      parseChannel(channels[2], name, ab),
    ]), alpha)
  },
  oklch: (body, name) => {
    const { channels, alpha } = splitModernBody(body, name)
    return createOklchValue([
      parseChannel(channels[0], name, { percent: 1, min: 0, max: 1 }),
      parseChannel(channels[1], name, { percent: 0.4, min: 0 }),
      parseHue(channels[2], name),
    ], alpha)
  },
  color: parsePredefinedColor,
}

/** Parses short and long hexadecimal color forms. */
function parseHexColor(value: string): ColorValue {
  const digits = value.slice(1)
  if (![3, 4, 6, 8].includes(digits.length) || !/^[\da-f]+$/i.test(digits)) {
    throw new Error(`ace: invalid hexadecimal color "${value}".`)
  }
  const expanded = digits.length <= 4 ? [...digits].map((digit) => `${digit}${digit}`).join('') : digits
  const byte = (index: number): number => Number.parseInt(expanded.slice(index, index + 2), 16)
  const alpha = expanded.length === 8 ? byte(6) / 255 : 1
  return createOklchValue(srgbToOklch(scaleRgb([byte(0), byte(2), byte(4)])), alpha)
}

/** Parses comma and space-separated rgb/rgba bodies; channels are clamped to the sRGB range. */
function parseRgbColor(body: string, name: string): ColorValue {
  const { channels, alpha } = splitBody(body, name)
  const scale = { percent: 255, min: 0, max: 255 }
  const rgb = channels.map((channel) => parseChannel(channel, name, scale)) as unknown as Channels
  return createOklchValue(srgbToOklch(scaleRgb(rgb)), alpha)
}

/** Parses comma and space-separated hsl/hsla bodies. */
function parseHslColor(body: string, name: string): ColorValue {
  const { channels, alpha } = splitBody(body, name)
  const rgb = hslToSrgb(parseHue(channels[0], name), parseUnit(channels[1], name), parseUnit(channels[2], name))
  return createOklchValue(srgbToOklch(rgb), alpha)
}

/** Parses `color(<space> c1 c2 c3 / alpha)` for the CSS predefined spaces. */
function parsePredefinedColor(body: string, name: string): ColorValue {
  const { channels, alpha } = splitModernBody(body, name, 4)
  const space = channels[0]
  if (!PREDEFINED_SPACES.has(space)) throw new Error(`ace: unsupported color() space "${space}".`)
  const scale = { percent: 1 }
  const coords = channels.slice(1).map((channel) => parseChannel(channel, name, scale)) as unknown as Channels
  return createOklchValue(predefinedToOklch(space as PredefinedColorSpace, coords), alpha)
}

/** Splits a legacy comma body or a modern space body into three channels and alpha. */
function splitBody(body: string, name: string): Readonly<{ channels: readonly string[], alpha: number }> {
  const commaParts = body.split(',').map((part) => part.trim())
  if (commaParts.length === 1) return splitModernBody(body, name)
  if (commaParts.length < 3 || commaParts.length > 4 || commaParts.some((part) => part.length === 0)) {
    throw new Error(`ace: invalid ${name} color "${body}".`)
  }
  return { channels: commaParts.slice(0, 3), alpha: commaParts[3] === undefined ? 1 : parseAlpha(commaParts[3]) }
}

/** Splits a space-separated body with an optional slash alpha. */
function splitModernBody(body: string, name: string, count = 3): Readonly<{ channels: readonly string[], alpha: number }> {
  const parts = body.split('/')
  if (parts.length > 2 || (parts.length === 2 && parts[1].trim().length === 0)) {
    throw new Error(`ace: invalid color alpha "${parts.slice(1).join('/').trim()}".`)
  }
  const channels = parts[0].trim().split(/\s+/).filter(Boolean)
  if (channels.length !== count || channels.some((channel) => channel.includes(','))) {
    throw new Error(`ace: invalid ${name} color "${body}".`)
  }
  return { channels, alpha: parts[1] === undefined ? 1 : parseAlpha(parts[1]) }
}

/** Parses one number or percentage channel; `none` resolves to 0 as in CSS conversions. */
function parseChannel(value: string, name: string, scale: ChannelScale): number {
  const isPercent = value.endsWith('%')
  const raw = isPercent ? value.slice(0, -1).trim() : value
  if (value === 'none') return 0
  if (!CSS_NUMBER_PATTERN.test(raw)) throw new Error(`ace: invalid ${name} channel "${value}".`)
  const number = isPercent ? Number(raw) / 100 * scale.percent : Number(raw)
  return Math.min(scale.max ?? Infinity, Math.max(scale.min ?? -Infinity, number))
}

/** Parses an HSL/HWB percentage (or bare number on the same scale) into [0, 1]. */
function parseUnit(value: string, name: string): number {
  return parseChannel(value, name, { percent: 100, min: 0, max: 100 }) / 100
}

/** Parses a hue angle into degrees wrapped into [0, 360). */
function parseHue(value: string, name: string): number {
  if (value === 'none') return 0
  const angle = CSS_ANGLE_PATTERN.exec(value)
  if (angle === null && !CSS_NUMBER_PATTERN.test(value)) throw new Error(`ace: invalid ${name} hue "${value}".`)
  const degrees = angle === null ? Number(value) : Number(angle[1]) * ANGLE_TO_DEGREES[angle[2].toLowerCase()]
  const wrapped = degrees % 360
  return wrapped === 0 ? 0 : wrapped < 0 ? wrapped + 360 : wrapped
}

/** Parses an alpha channel as a clamped number or percentage. */
function parseAlpha(value: string): number {
  const normalized = value.trim()
  const isPercent = normalized.endsWith('%')
  const raw = isPercent ? normalized.slice(0, -1).trim() : normalized
  if (!CSS_NUMBER_PATTERN.test(raw)) throw new Error(`ace: invalid color alpha "${value}".`)
  return Math.min(1, Math.max(0, isPercent ? Number(raw) / 100 : Number(raw)))
}

/** Brings 8-bit RGB channels into [0, 1]. */
function scaleRgb(rgb: Channels): Channels {
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255]
}

/** Stores an achromatic color as chroma 0 and hue 0, so no rounding noise becomes a hue. */
function createOklchValue(coords: Channels, alpha: number): ColorValue {
  const achromatic = coords[1] < ACHROMATIC_CHROMA
  return { kind: 'color', space: 'oklch', coords: achromatic ? [coords[0], 0, 0] : coords, alpha }
}

/** Checks one color record of the given space with three finite coordinates and a finite alpha. */
function isColorShape(value: unknown, space: 'oklch' | 'srgb'): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return candidate.kind === 'color'
    && candidate.space === space
    && Array.isArray(candidate.coords)
    && candidate.coords.length === 3
    && candidate.coords.every((coordinate: unknown) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    && typeof candidate.alpha === 'number'
    && Number.isFinite(candidate.alpha)
}

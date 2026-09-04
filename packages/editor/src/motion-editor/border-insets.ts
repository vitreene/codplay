import { cqwToPx } from '../decor-editor/units'
import type { ContentBoxInsetsPx } from './content-box'

/** Border widths, in pixels, used to locate a content-box frame without expanding it. */
export type FrameBorderInsetsPx = ContentBoxInsetsPx

/** One authored border length retained in its logical CSS unit. */
export type BorderLength = Readonly<{
  value: number
  unit: 'px' | 'cqw'
}>

/** Border widths before the single conversion to physical pixels. */
export type FrameBorderInsets = Readonly<{
  top: BorderLength
  right: BorderLength
  bottom: BorderLength
  left: BorderLength
}>

const ZERO_BORDER_LENGTH: BorderLength = Object.freeze({ value: 0, unit: 'px' })

const BORDER_STYLES = new Set([
  'dashed',
  'dotted',
  'double',
  'groove',
  'inset',
  'outset',
  'ridge',
  'solid',
])

const BORDER_SIDE_NAMES = ['top', 'right', 'bottom', 'left'] as const

/** Resolves the effective physical border insets from the open Decor style map. */
export function resolveBorderInsetsPx(
  style: Readonly<Record<string, unknown>> | undefined,
  rootWidthPx: number,
): FrameBorderInsetsPx {
  const logical = resolveBorderInsetLengths(style)

  return {
    top: borderLengthToPx(logical.top, rootWidthPx),
    right: borderLengthToPx(logical.right, rootWidthPx),
    bottom: borderLengthToPx(logical.bottom, rootWidthPx),
    left: borderLengthToPx(logical.left, rootWidthPx),
  }
}

/** Resolves effective border widths while preserving each supported authored unit. */
export function resolveBorderInsetLengths(
  style: Readonly<Record<string, unknown>> | undefined,
): FrameBorderInsets {
  const widths: Array<BorderLength | undefined> = [undefined, undefined, undefined, undefined]
  const styles: Array<string | undefined> = [undefined, undefined, undefined, undefined]
  const declarations = style ?? {}

  const border = parseBorderShorthand(declarations.border)
  if (border !== undefined) {
    if (border.width !== undefined) assignAll(widths, border.width)
    if (border.style !== undefined) assignAll(styles, border.style)
  }

  // Longhands are the more specific authored declarations and therefore replace a broad
  // `border` shorthand before side-specific declarations are applied below.
  applyQuad(widths, parseQuad(declarations['border-width'], parseBorderWidthValue))
  applyQuad(styles, parseQuad(declarations['border-style'], parseBorderStyleValue))

  for (const side of BORDER_SIDE_NAMES) {
    const shorthand = parseBorderShorthand(declarations[`border-${side}`])
    if (shorthand === undefined) continue
    const index = BORDER_SIDE_NAMES.indexOf(side)
    if (shorthand.width !== undefined) widths[index] = shorthand.width
    if (shorthand.style !== undefined) styles[index] = shorthand.style
  }

  for (const [index, side] of BORDER_SIDE_NAMES.entries()) {
    const width = parseBorderWidthValue(declarations[`border-${side}-width`])
    const borderStyle = parseBorderStyleValue(declarations[`border-${side}-style`])
    if (width !== undefined) widths[index] = width
    if (borderStyle !== undefined) styles[index] = borderStyle
  }

  return {
    top: effectiveLength(widths[0], styles[0]),
    right: effectiveLength(widths[1], styles[1]),
    bottom: effectiveLength(widths[2], styles[2]),
    left: effectiveLength(widths[3], styles[3]),
  }

  function parseBorderWidthValue(value: unknown): BorderLength | undefined {
    return parseLength(value)
      ?? (typeof value === 'string' ? parseNamedBorderWidth(value) : undefined)
  }
}

/** Parses one border shorthand into its optional width and style components. */
function parseBorderShorthand(value: unknown): { width?: BorderLength; style?: string } | undefined {
  if (typeof value !== 'string') return undefined
  const tokens = value.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return undefined
  let width: BorderLength | undefined
  let style: string | undefined
  for (const token of tokens) {
    if (width === undefined) {
      const parsedWidth = parseLength(token)
        ?? parseNamedBorderWidth(token)
      if (parsedWidth !== undefined) {
        width = parsedWidth
        continue
      }
    }
    if (style === undefined) {
      const parsedStyle = parseBorderStyleValue(token)
      if (parsedStyle !== undefined) style = parsedStyle
    }
  }
  return width === undefined && style === undefined ? undefined : { width, style }
}

/** Parses a CSS quad shorthand and expands it to top/right/bottom/left order. */
function parseQuad<T>(value: unknown, parse: (token: unknown) => T | undefined): T[] | undefined {
  if (typeof value !== 'string') {
    const single = parse(value)
    return single === undefined ? undefined : [single]
  }
  const tokens = value.trim().split(/\s+/).filter(Boolean)
  if (tokens.length < 1 || tokens.length > 4) return undefined
  const parsed = tokens.map(token => parse(token))
  return parsed.every((token): token is T => token !== undefined) ? parsed : undefined
}

/** Applies a CSS quad to an existing physical side array. */
function applyQuad<T>(target: Array<T | undefined>, values: T[] | undefined): void {
  if (values === undefined) return
  if (values.length === 1) {
    assignAll(target, values[0]!)
    return
  }
  if (values.length === 2) {
    target[0] = values[0]
    target[2] = values[0]
    target[1] = values[1]
    target[3] = values[1]
    return
  }
  if (values.length === 3) {
    target[0] = values[0]
    target[1] = values[1]
    target[3] = values[1]
    target[2] = values[2]
    return
  }
  target[0] = values[0]
  target[1] = values[1]
  target[2] = values[2]
  target[3] = values[3]
}

/** Assigns one value to all four physical sides. */
function assignAll<T>(target: Array<T | undefined>, value: T): void {
  for (let index = 0; index < target.length; index += 1) target[index] = value
}

/** Parses one border style token; non-border CSS values remain outside this geometry adapter. */
function parseBorderStyleValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  if (normalized === 'none' || normalized === 'hidden' || BORDER_STYLES.has(normalized)) return normalized
  return undefined
}

/** Parses a CSS length used by the current cqw/px Decor vocabulary. */
function parseLength(value: unknown): BorderLength | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.kind !== 'length' || typeof record.value !== 'number' || !Number.isFinite(record.value)) return undefined
    const unit = record.unit === 'cqw' || record.unit === 'px' ? record.unit : undefined
    return unit === undefined ? undefined : { value: Math.max(0, record.value), unit }
  }
  if (typeof value === 'number') return Number.isFinite(value) ? { value: Math.max(0, value), unit: 'px' } : undefined
  if (typeof value !== 'string') return undefined
  const match = value.trim().match(/^([+-]?(?:\d+\.?\d*|\.\d+))(px|cqw)?$/i)
  if (match === null) return undefined
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return undefined
  const unit = (match[2]?.toLowerCase() ?? 'px')
  return unit === 'px' || unit === 'cqw' ? { value: Math.max(0, amount), unit } : undefined
}

/** Converts one retained logical border length to pixels without consulting the DOM. */
function borderLengthToPx(length: BorderLength, rootWidthPx: number): number {
  if (length.unit === 'cqw' && Number.isFinite(rootWidthPx) && rootWidthPx > 0) {
    return cqwToPx(length.value, rootWidthPx)
  }
  return length.unit === 'px' ? length.value : 0
}

/** Resolves the CSS named border widths used by shorthands and the default medium width. */
function parseNamedBorderWidth(value: string): BorderLength | undefined {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'thin') return { value: 1, unit: 'px' }
  if (normalized === 'medium') return { value: 3, unit: 'px' }
  if (normalized === 'thick') return { value: 5, unit: 'px' }
  return undefined
}

/** Applies CSS visibility rules: none/hidden have no geometric inset, visible styles use medium by default. */
function effectiveLength(width: BorderLength | undefined, style: string | undefined): BorderLength {
  if (style === undefined || style === 'none' || style === 'hidden') return ZERO_BORDER_LENGTH
  return width ?? { value: 3, unit: 'px' }
}

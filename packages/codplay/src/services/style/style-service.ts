import { isColorValue, isLegacySrgbColorValue, parseColor, toOklchColor } from 'ace'
import {
  VALIDATION_TARGET_ACTION,
  type PropertyValidationDefinition,
  type ServiceSanitizer,
  type ServiceValidationDefinition,
  type ValidationContext,
  type ValidationFunction,
} from '../service-validation-types'
import { reportInvalidServiceValue } from '../service-validation-report'
import { isPlainRecord } from '../../shared'

/** Open CSS declaration map accepted by the style service. */
export type StyleValue = Readonly<Record<string, unknown>>

/** Style properties whose values use the first V2 color contract. */
export const STYLE_COLOR_PROPERTIES = ['color', 'backgroundColor', 'borderColor'] as const

/** Validates the shape shared by style service payloads. */
export const validateStyle: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) {
    reportInvalidServiceValue(context.diagnostics, 'AUTHOR_STYLE_INVALID', 'style must be a plain object.', context)
  }
}

/** Validates one declared style color or one color tween. */
const validateStyleColor: ValidationFunction = (value, context) => {
  if (context.target === VALIDATION_TARGET_ACTION && isPlainRecord(value) && !isSupportedColor(value)) {
    if (!('to' in value)) {
      reportInvalidColor(context)
      return
    }
    if (value.from !== undefined && !isSupportedColor(value.from)) reportInvalidColor(context)
    if (!isSupportedColor(value.to)) reportInvalidColor(context)
    return
  }

  if (!isSupportedColor(value)) reportInvalidColor(context)
}

/** Reports the common diagnostic for an unsupported or malformed color payload. */
function reportInvalidColor(context: ValidationContext): void {
  reportInvalidServiceValue(
    context.diagnostics,
    'AUTHOR_STYLE_COLOR_INVALID',
    'style color properties accept CSS Color 4 values: named colors, hexadecimal, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() and color().',
    context,
  )
}

/** Checks one supported author color without asking the browser to resolve it. */
function isSupportedColor(value: unknown): boolean {
  if (isColorValue(value) || isLegacySrgbColorValue(value)) return true
  if (typeof value !== 'string') return false
  try {
    parseColor(value)
    return true
  } catch {
    return false
  }
}

/** Normalizes declared style colors after component validation and before extraction. */
const sanitizeStyle: ServiceSanitizer = (value) => {
  if (!isPlainRecord(value)) return value
  const sanitized: Record<string, unknown> = { ...value }
  for (const property of STYLE_COLOR_PROPERTIES) {
    if (!(property in sanitized)) continue
    sanitized[property] = sanitizeStyleColor(sanitized[property])
  }
  return sanitized
}

/** Normalizes a direct color or both bounds of one color tween. */
function sanitizeStyleColor(value: unknown): unknown {
  if (typeof value === 'string') return parseColor(value)
  if (isLegacySrgbColorValue(value)) return toOklchColor(value)
  if (!isPlainRecord(value) || isColorValue(value)) return value
  const sanitized: Record<string, unknown> = { ...value }
  for (const bound of ['from', 'to'] as const) {
    const color = sanitized[bound]
    if (typeof color === 'string') sanitized[bound] = parseColor(color)
    else if (isLegacySrgbColorValue(color)) sanitized[bound] = toOklchColor(color)
  }
  return sanitized
}

/** Declares the property-level validation rules owned by the style service. */
const STYLE_PROPERTY_DEFINITIONS: readonly PropertyValidationDefinition[] = STYLE_COLOR_PROPERTIES.map((name) => ({
  name,
  validate: validateStyleColor,
}))

/** Declares the core style service consumed by components and compilation. */
export const STYLE_SERVICE: ServiceValidationDefinition = {
  name: 'style',
  validate: validateStyle,
  sanitize: sanitizeStyle,
  properties: STYLE_PROPERTY_DEFINITIONS,
  // Ordinary CSS properties remain open. The HTML adapter additionally consumes
  // the V2 transform channels without turning them into a global property matrix.
  allowUnknownProperties: true,
}

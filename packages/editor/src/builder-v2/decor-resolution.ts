import type { Decor, EditorScene, Item, Keyframe } from '../app/commands/types'
import { parseColor } from 'ace'

/** Resolves one Decor into the style record consumed by the V2 tag component. */
export function resolveDecorStyle(decor: Decor | undefined): Record<string, unknown> {
  return {
    ...resolveAuthoredStyle(decor?.style),
    ...resolveOffsetAsStyle(decor?.offset),
    ...resolveCustomStyle(decor?.custom),
  }
}

/** Normalizes standalone CSS colors while preserving every other authored CSS value. */
function resolveAuthoredStyle(style: Decor['style']): Record<string, unknown> {
  if (style === undefined) return {}
  return Object.fromEntries(Object.entries(style).map(([property, value]) => [property, normalizeStyleValue(property, value)]))
}

/** Resolves the effective style at one keyframe using the ed2 cascade order. */
export function resolveKeyframeStyle(
  scene: EditorScene,
  item: Item,
  keyframe: Keyframe,
): Record<string, unknown> {
  const orderedKeyframes = [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  const keyframeIndex = orderedKeyframes.findIndex((candidate) => candidate.id === keyframe.id)
  const layers = [scene.decors[item.initialDecorId]]
  if (keyframeIndex >= 0) {
    layers.push(...orderedKeyframes.slice(0, keyframeIndex + 1).map((candidate) => scene.decors[candidate.decorId]))
  } else {
    layers.push(scene.decors[keyframe.decorId])
  }

  return layers.reduce<Record<string, unknown>>(
    (style, decor) => ({ ...style, ...resolveDecorStyle(decor) }),
    {},
  )
}

/** Resolves the item's initial decor when no keyframe exists yet. */
export function resolveInitialStyle(scene: EditorScene, item: Item): Record<string, unknown> {
  return resolveDecorStyle(scene.decors[item.initialDecorId])
}

/** Resolves the static class value at one keyframe without treating classes as interpolable data. */
export function resolveKeyframeClassName(
  scene: EditorScene,
  item: Item,
  keyframe: Keyframe,
): string | undefined {
  const orderedKeyframes = [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  const keyframeIndex = orderedKeyframes.findIndex((candidate) => candidate.id === keyframe.id)
  const layers = [scene.decors[item.initialDecorId]]
  if (keyframeIndex >= 0) {
    layers.push(...orderedKeyframes.slice(0, keyframeIndex + 1).map((candidate) => scene.decors[candidate.decorId]))
  } else {
    layers.push(scene.decors[keyframe.decorId])
  }

  let className: string | undefined
  for (const decor of layers) {
    if (decor?.classes === undefined) continue
    className = normalizeClassName(decor.classes)
  }
  return className
}

/** Resolves the static root decor without introducing an empty style value. */
export function resolveRootStyle(scene: EditorScene): Record<string, unknown> {
  return resolveDecorStyle(scene.rootDecorId === undefined ? undefined : scene.decors[scene.rootDecorId])
}

/** Resolves the root's static classes while preserving their editor-authored ordering. */
export function resolveRootClassName(scene: EditorScene): string | undefined {
  return normalizeClassName(scene.rootDecorId === undefined ? undefined : scene.decors[scene.rootDecorId]?.classes)
}

/** Resolves the item's static class value when it has no keyframe yet. */
export function resolveInitialClassName(scene: EditorScene, item: Item): string | undefined {
  return normalizeClassName(scene.decors[item.initialDecorId]?.classes)
}

/** Computes a forward style diff; absent destination properties are intentionally untouched. */
export function computeStyleDiff(
  fromStyle: Record<string, unknown>,
  toStyle: Record<string, unknown>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {}
  for (const [property, value] of Object.entries(toStyle)) {
    if (areStyleValuesEqual(fromStyle[property], value)) continue
    diff[property] = value
  }
  return diff
}

/** Compares primitive and structured logical style values without relying on object identity. */
function areStyleValuesEqual(source: unknown, destination: unknown): boolean {
  if (Object.is(source, destination)) return true
  if (Array.isArray(source) || Array.isArray(destination)) {
    if (!Array.isArray(source) || !Array.isArray(destination) || source.length !== destination.length) return false
    return source.every((value, index) => areStyleValuesEqual(value, destination[index]))
  }
  if (!isPlainStyleRecord(source) || !isPlainStyleRecord(destination)) return false
  const sourceKeys = Object.keys(source)
  const destinationKeys = Object.keys(destination)
  if (sourceKeys.length !== destinationKeys.length) return false
  return sourceKeys.every((key) => key in destination && areStyleValuesEqual(source[key], destination[key]))
}

/** Narrows one style value to a non-array record for structural comparison. */
function isPlainStyleRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Reports whether two style values expose a numeric structure ACE can interpolate. */
export function isInterpolableStylePair(from: unknown, to: unknown): boolean {
  if (typeof from !== 'string' || typeof to !== 'string') return true
  const sourceColor = isColorString(from)
  const destinationColor = isColorString(to)
  if (sourceColor || destinationColor) return sourceColor && destinationColor
  const sourceNumbers = extractNumericParts(from).length
  const destinationNumbers = extractNumericParts(to).length
  return sourceNumbers > 0 && sourceNumbers === destinationNumbers
}

/** Recognizes colors through the existing ACE parser, without a CSS property list. */
function isColorString(value: string): boolean {
  try {
    parseColor(value)
    return true
  } catch {
    return false
  }
}

/** Counts numeric components used by ACE's generic compound-value interpolation. */
function extractNumericParts(value: string): readonly string[] {
  return value.match(/[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g) ?? []
}

/** Reports whether a Decor contains structured offset data. */
export function hasOffsetData(decor: Decor | undefined): boolean {
  return decor?.offset !== undefined && Object.keys(decor.offset).length > 0
}

/** Resolves structured offset lengths into unitless V2 transport values. */
export function resolveOffsetAsStyle(offset: Decor['offset']): Record<string, unknown> {
  if (offset === undefined) return {}
  const style: Record<string, unknown> = {}
  if (offset.x !== undefined) style.x = offset.x
  if (offset.y !== undefined) style.y = offset.y
  if (offset.translate?.x !== undefined) style.x = offset.translate.x
  if (offset.translate?.y !== undefined) style.y = offset.translate.y
  if (offset.width !== undefined) style.width = offset.width
  if (offset.height !== undefined) style.height = offset.height
  if (offset.rotate !== undefined) style.rotate = offset.rotate
  if (offset.scale?.x !== undefined) style.scaleX = offset.scale.x
  if (offset.scale?.y !== undefined) style.scaleY = offset.scale.y
  return style
}

/** Reports whether a Decor uses an editor zone that is intentionally deferred to the zones tranche. */
export function hasZoneAssignment(decor: Decor | undefined): boolean {
  return decor?.zoneId !== undefined && decor.zoneId !== null
}

/** Resolves the small CSS declaration syntax stored in Decor.custom without qualifying its values. */
function resolveCustomStyle(custom: string | undefined): Record<string, unknown> {
  if (custom === undefined || custom.trim() === '') return {}

  const style: Record<string, unknown> = {}
  for (const declaration of custom.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue
    const property = declaration.slice(0, separator).trim()
    const value = declaration.slice(separator + 1).trim()
    if (property !== '' && value !== '') style[property] = normalizeStyleValue(property, value)
  }
  return style
}

/** Parses a complete color token only for a color-named property. */
function normalizeStyleValue(property: string, value: unknown): unknown {
  if (!isColorProperty(property) || typeof value !== 'string') return value
  try {
    return parseColor(value)
  } catch {
    return value
  }
}

/** Recognizes CSS color property naming without maintaining a fixed property whitelist. */
function isColorProperty(property: string): boolean {
  const normalized = property.trim()
  if (normalized.startsWith('--')) return false
  return normalized === 'color'
    || normalized.endsWith('-color')
    || normalized.endsWith('Color')
}

/** Normalizes the editor's string-or-array class form to the V2 className string form. */
function normalizeClassName(value: Decor['classes'] | undefined): string | undefined {
  if (value === undefined) return undefined
  const className = Array.isArray(value) ? value.join(' ') : value
  const normalized = className.trim().replace(/\s+/g, ' ')
  return normalized === '' ? undefined : normalized
}

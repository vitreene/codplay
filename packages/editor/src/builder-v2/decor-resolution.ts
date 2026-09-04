import type { Decor, EditorScene, Item, Keyframe } from '../app/commands/types'
import { resolveKeyframeChannel } from '../app/commands/types'
import { parseColor } from 'ace'
import { contentBoxLayoutDisplacement } from '../motion-editor/content-box'
import { resolveBorderInsetLengths, type BorderLength } from '../motion-editor/border-insets'

/** Resolves one Decor into the style record consumed by the V2 tag component. */
export function resolveDecorStyle(decor: Decor | undefined): Record<string, unknown> {
  const decorStyle = resolveDecorChannelStyle(decor)
  return {
    ...decorStyle,
    ...resolveContentAnchoredPoseStyle(resolvePoseChannelStyle(decor), decorStyle),
  }
}

/** Projects structured pose translations so the authored x/y coordinates anchor the content-box. */
export function resolveContentAnchoredPoseStyle(
  poseStyle: Record<string, unknown>,
  decorStyle: Record<string, unknown>,
): Record<string, unknown> {
  const x = finiteStyleNumber(poseStyle.x)
  const y = finiteStyleNumber(poseStyle.y)
  if (x === undefined && y === undefined) return poseStyle

  const border = resolveBorderInsetLengths(decorStyle)
  if (isZeroBorder(border)) return poseStyle

  const width = finiteStyleNumber(poseStyle.width)
  const height = finiteStyleNumber(poseStyle.height)
  const frame = {
    x: x ?? 0,
    y: y ?? 0,
    width: width ?? 0,
    height: height ?? 0,
    rotate: finiteStyleNumber(poseStyle.rotate) ?? 0,
    scaleX: finiteStyleNumber(poseStyle.scaleX) ?? 1,
    scaleY: finiteStyleNumber(poseStyle.scaleY) ?? 1,
    rotationOrigin: parseStyleRotationOrigin(poseStyle['transform-origin']),
  }

  // The common CSS case is axis-aligned. It can be represented with a CSS calc even when a
  // border is authored in px, while a rotated/scaled frame needs the same affine displacement
  // as the editor overlay and therefore requires one common logical unit.
  const displacement = canUseLogicalAffine(border) && width !== undefined && height !== undefined
    ? contentBoxLayoutDisplacement(frame, {
      top: border.top.value,
      right: border.right.value,
      bottom: border.bottom.value,
      left: border.left.value,
    })
    : isAxisAligned(frame)
      ? null
      : undefined
  if (displacement === undefined) return poseStyle

  const result = { ...poseStyle }
  if (x !== undefined) {
    result.x = displacement === null
      ? subtractBorderLength(x, border.left)
      : x - displacement.x
  }
  if (y !== undefined) {
    result.y = displacement === null
      ? subtractBorderLength(y, border.top)
      : y - displacement.y
  }
  return result
}

/** Resolves the open decoration payload without projecting the current pose payload. */
export function resolveDecorChannelStyle(decor: Decor | undefined): Record<string, unknown> {
  return {
    ...resolveAuthoredStyle(decor?.style),
    ...resolveCustomStyle(decor?.custom),
  }
}

/**
 * Resolves the current pose projection of one Decor.
 *
 * `offset` is the current ed2 storage boundary for pose. It is deliberately kept behind this
 * adapter instead of being spread as a property whitelist through the builder; a later pose
 * contract can replace this projection without changing channel selection or decoration folding.
 */
export function resolvePoseChannelStyle(decor: Decor | undefined): Record<string, unknown> {
  return resolveOffsetAsStyle(decor?.offset)
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
  const decorStyle = resolveKeyframeDecorStyle(scene, item, keyframe)
  return {
    ...decorStyle,
    ...resolveKeyframePoseStyle(scene, item, keyframe),
  }
}

/** Resolves all decoration-channel values through the keyframes up to one temporal point. */
export function resolveKeyframeDecorStyle(
  scene: EditorScene,
  item: Item,
  keyframe: Keyframe,
): Record<string, unknown> {
  return resolveKeyframeLayers(scene, item, keyframe)
    .reduce<Record<string, unknown>>(
      (style, decor) => ({ ...style, ...resolveDecorChannelStyle(decor) }),
      {},
    )
}

/** Resolves pose values through pose-channel keyframes while ignoring decoration-only points. */
export function resolveKeyframePoseStyle(
  scene: EditorScene,
  item: Item,
  keyframe: Keyframe,
): Record<string, unknown> {
  const poseStyle = resolveKeyframeLayers(scene, item, keyframe)
    .filter((_decor, index) => index === 0 || resolveKeyframeChannel(resolveLayerKeyframe(item, keyframe, index - 1)) === 'pose')
    .reduce<Record<string, unknown>>(
      (style, decor) => ({ ...style, ...resolvePoseChannelStyle(decor) }),
      {},
    )
  return resolveContentAnchoredPoseStyle(
    poseStyle,
    resolveKeyframeDecorStyle(scene, item, keyframe),
  )
}

/** Returns the initial decor followed by authored layers through the requested keyframe. */
function resolveKeyframeLayers(scene: EditorScene, item: Item, keyframe: Keyframe): Array<Decor | undefined> {
  const orderedKeyframes = [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  const keyframeIndex = orderedKeyframes.findIndex((candidate) => candidate.id === keyframe.id)
  const layers = [scene.decors[item.initialDecorId]]
  if (keyframeIndex >= 0) {
    layers.push(...orderedKeyframes.slice(0, keyframeIndex + 1).map((candidate) => scene.decors[candidate.decorId]))
  } else {
    layers.push(scene.decors[keyframe.decorId])
  }
  return layers
}

/** Maps a resolved layer index back to its authored keyframe for channel filtering. */
function resolveLayerKeyframe(item: Item, keyframe: Keyframe, layerIndex: number): Keyframe {
  const orderedKeyframes = [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
  const keyframeIndex = orderedKeyframes.findIndex((candidate) => candidate.id === keyframe.id)
  if (keyframeIndex >= 0) return orderedKeyframes[Math.max(0, Math.min(keyframeIndex, layerIndex))]!
  return keyframe
}

/** Resolves the item's initial decor when no keyframe exists yet. */
export function resolveInitialStyle(scene: EditorScene, item: Item): Record<string, unknown> {
  return resolveDecorStyle(scene.decors[item.initialDecorId])
}

/** Reads one finite numeric pose value without interpreting open CSS values. */
function finiteStyleNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Parses the builder's percentage transform-origin representation. */
function parseStyleRotationOrigin(value: unknown): { fx: number; fy: number } | undefined {
  if (typeof value !== 'string') return undefined
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return undefined
  const parse = (part: string): number | undefined => {
    if (part === 'center') return 0.5
    if (!part.endsWith('%')) return undefined
    const value = Number.parseFloat(part.slice(0, -1))
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value / 100)) : undefined
  }
  const fx = parse(parts[0]!)
  const fy = parse(parts[1]!)
  return fx === undefined || fy === undefined ? undefined : { fx, fy }
}

/** Reports whether the four effective borders can share the logical cqw affine unit. */
function canUseLogicalAffine(border: ReturnType<typeof resolveBorderInsetLengths>): boolean {
  return [border.top, border.right, border.bottom, border.left]
    .every((length) => length.value === 0 || length.unit === 'cqw')
}

/** Reports whether no authored border contributes to the content-box displacement. */
function isZeroBorder(border: ReturnType<typeof resolveBorderInsetLengths>): boolean {
  return [border.top, border.right, border.bottom, border.left].every((length) => length.value === 0)
}

/** Reports whether a frame needs only an axis-aligned left/top correction. */
function isAxisAligned(frame: {
  rotate: number
  scaleX: number
  scaleY: number
}): boolean {
  return Math.abs(frame.rotate) <= 1e-8
    && Math.abs(frame.scaleX - 1) <= 1e-8
    && Math.abs(frame.scaleY - 1) <= 1e-8
}

/** Subtracts one border length from a logical cqw coordinate without converting through the DOM. */
function subtractBorderLength(value: number, border: BorderLength): number | string {
  if (border.value === 0) return value
  if (border.unit === 'cqw') return value - border.value
  return `calc(${value}cqw - ${border.value}px)`
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

/** Reports whether two complete style values expose a numeric structure ACE can interpolate. */
export function isInterpolableStylePair(from: unknown, to: unknown): boolean {
  // An absent source is not an implicit CSS default. The builder has no authored value to
  // interpolate from; callers must route that destination-only property through the discrete
  // keyframe channel instead of emitting a V2 tween that the resolver cannot materialize.
  if (from === undefined || to === undefined) return false
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
  if (offset.rotationOrigin !== undefined) {
    style['transform-origin'] = `${offset.rotationOrigin.fx * 100}% ${offset.rotationOrigin.fy * 100}%`
  }
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

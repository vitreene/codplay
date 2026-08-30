import type { Decor, EditorScene, Item, Keyframe } from '../app/commands/types'

/** Resolves one Decor into the style record consumed by the V2 tag component. */
export function resolveDecorStyle(decor: Decor | undefined): Record<string, unknown> {
  return {
    ...decor?.style,
    ...resolveCustomStyle(decor?.custom),
  }
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
    if (Object.is(fromStyle[property], value)) continue
    diff[property] = value
  }
  return diff
}

/** Reports whether a Decor contains structured offset data not supported by this V2 increment. */
export function hasOffsetData(decor: Decor | undefined): boolean {
  return decor?.offset !== undefined && Object.keys(decor.offset).length > 0
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
    if (property !== '' && value !== '') style[property] = value
  }
  return style
}

/** Normalizes the editor's string-or-array class form to the V2 className string form. */
function normalizeClassName(value: Decor['classes'] | undefined): string | undefined {
  if (value === undefined) return undefined
  const className = Array.isArray(value) ? value.join(' ') : value
  const normalized = className.trim().replace(/\s+/g, ' ')
  return normalized === '' ? undefined : normalized
}

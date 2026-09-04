import type { DecorPatch } from './types'

/**
 * Removes one inherited Decor property without mutating the source patch. The path may target a
 * root property or any nested future module, for example `style.color` or `offset.translate.x`.
 */
export function stripInherited(patch: DecorPatch, path: string): DecorPatch {
  const segments = path.split('.')
  if (segments.some(segment => segment.length === 0)) return patch

  const result = clonePatch(patch)
  let current = result as Record<string, unknown>
  for (const segment of segments.slice(0, -1)) {
    const child = current[segment]
    if (!child || typeof child !== 'object' || Array.isArray(child)) return patch
    current = child as Record<string, unknown>
  }

  const leaf = segments[segments.length - 1]!
  if (!Object.prototype.hasOwnProperty.call(current, leaf)) return patch
  delete current[leaf]

  // Prune empty parents so a fully stripped group disappears from the sparse patch as well.
  for (let index = segments.length - 2; index >= 0; index -= 1) {
    let parent = result as Record<string, unknown>
    for (const segment of segments.slice(0, index)) parent = parent[segment] as Record<string, unknown>
    const key = segments[index]!
    const child = parent[key]
    if (child && typeof child === 'object' && !Array.isArray(child) && Object.keys(child).length === 0) {
      delete parent[key]
    } else {
      break
    }
  }
  return result
}

/** Copies the JSON-like values used by Decor patches. */
function clonePatch(patch: DecorPatch): DecorPatch {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) result[key] = cloneValue(value)
  return result as DecorPatch
}

/** Clones one nested JSON-like Decor value. */
function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) result[key] = cloneValue(child)
    return result
  }
  return value
}

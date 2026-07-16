import { CSSStyleValue, CSSUnitValue } from 'typed-om-polyfill'

/**
 * CSS container query units resolved by this module. Values in any other
 * unit (px, %, deg, unitless...) pass through unchanged — this module never
 * touches anime.js's own unit handling for those.
 */
const CONTAINER_QUERY_UNITS = new Set(['cqw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax'])

/**
 * The scene's single root container node (the perso resolved from
 * `CompiledScene.rootNodeIds`), set once by the player after mount. Never
 * discovered via DOM traversal (`closest`, class selector) — the scene has
 * exactly one root, known from data, not from CSS convention.
 */
let containerQueryRootNode: Element | null = null

/**
 * Sets the scene's container-query root node, resolved once from
 * `CompiledScene.rootNodeIds` by the player after mount.
 */
export function setContainerQueryRootNode(node: Element | null): void {
  containerQueryRootNode = node
}

type ParsedContainerQueryValue = {
  value: number
  unit: string
}

/**
 * Parses one raw style value as a container query unit, or returns null
 * when it isn't a container query value at all.
 */
function parseContainerQueryValue(rawValue: unknown): ParsedContainerQueryValue | null {
  if (typeof rawValue !== 'string') {
    return null
  }

  let parsed: CSSStyleValue
  try {
    // Parsed against `margin-left`, never `width` — CSS forbids negative `<length>` for `width`,
    // so `CSSStyleValue.parse('width', ...)` throws on any negative cqw value (ex. a leftward/
    // upward `translate`), silently falling through to the raw, unresolved cqw string below.
    // `margin-left` accepts the same `cqw` unit grammar without a sign restriction.
    parsed = CSSStyleValue.parse('margin-left', rawValue)
  } catch {
    return null
  }

  if (!(parsed instanceof CSSUnitValue) || !CONTAINER_QUERY_UNITS.has(parsed.unit)) {
    return null
  }

  return { value: parsed.value, unit: parsed.unit }
}

/**
 * Resolves the container dimension (px) relevant to one container query unit.
 */
function resolveContainerDimensionPx(containerNode: Element, unit: string): number {
  const rect = containerNode.getBoundingClientRect()

  if (unit === 'cqw' || unit === 'cqi') {
    return rect.width
  }
  if (unit === 'cqh' || unit === 'cqb') {
    return rect.height
  }

  return unit === 'cqmin' ? Math.min(rect.width, rect.height) : Math.max(rect.width, rect.height)
}

/**
 * Resolves one style value expressed in a container query unit into an
 * explicit px string, against the scene's single root container node (set via
 * `setContainerQueryRootNode`). Any other value (including a container query
 * value resolved before the root node is known) is returned unchanged.
 *
 * Resolves to a `"Npx"` string rather than a bare number: anime.js only
 * defaults unitless numbers to px for its own transform properties
 * (x/y/rotate/scale) — a bare number handed to a generic CSS property like
 * `width` is not a valid CSS length and is silently dropped.
 */
export function resolveContainerQueryValue(_node: Element, rawValue: unknown): unknown {
  const parsed = parseContainerQueryValue(rawValue)
  if (parsed === null) {
    return rawValue
  }

  const containerNode = containerQueryRootNode
  if (containerNode === null) {
    return rawValue
  }

  const containerDimensionPx = resolveContainerDimensionPx(containerNode, parsed.unit)
  const resolvedPx = (parsed.value / 100) * containerDimensionPx
  // Rounded to at most 2 decimals — cqw source values (percent of a measured pixel
  // rect) routinely carry more float noise than any visual difference can express.
  return `${Math.round(resolvedPx * 100) / 100}px`
}

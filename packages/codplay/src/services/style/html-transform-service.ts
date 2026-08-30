import {
  getTransformOrder,
  isScalarTransformProperty,
  resolveTransformProperty as canonicalTransformProperty,
  type TransformProperty,
} from 'ace'
import {
  projectHtmlLogicalLength,
  setHtmlStyleProperty,
  type HtmlElementNode,
  type HtmlMaterializerRuntimeContext,
} from '../html-materializer-service-types'

/** Component-scoped transform declarations kept by the HTML style adapter. */
export type HtmlTransformStyleState = {
  readonly channels: Map<TransformProperty, string>
  rawTransform: string | undefined
}

/** Creates the transform state associated with one component-scoped style service. */
export function createHtmlTransformStyleState(): HtmlTransformStyleState {
  return {
    channels: new Map(),
    rawTransform: undefined,
  }
}

/** Applies one transform-related declaration and reports whether it was consumed. */
export function applyHtmlTransformStyleProperty(
  state: HtmlTransformStyleState,
  node: HtmlElementNode,
  property: string,
  value: unknown,
  context: HtmlMaterializerRuntimeContext,
): boolean {
  if (property === 'translate') {
    setHtmlStyleProperty(node, property, formatTranslateProperty(value, context))
    return true
  }
  if (property === 'transform') {
    state.rawTransform = rawTransformValue(value)
    return true
  }
  const transformProperty = resolveTransformProperty(property)
  if (transformProperty === undefined) return false
  state.channels.set(transformProperty, transformCssValue(transformProperty, value, context))
  return true
}

/** Removes one transform-related declaration and reports whether it was consumed. */
export function removeHtmlTransformStyleProperty(
  state: HtmlTransformStyleState,
  node: HtmlElementNode,
  property: string,
): boolean {
  if (property === 'translate') {
    setHtmlStyleProperty(node, property, '')
    return true
  }
  if (property === 'transform') {
    state.rawTransform = undefined
    return true
  }
  const transformProperty = resolveTransformProperty(property)
  if (transformProperty === undefined) return false
  state.channels.delete(transformProperty)
  return true
}

/** Reports whether scalar or raw transform output is currently present. */
export function hasHtmlTransformStyleOutput(state: HtmlTransformStyleState): boolean {
  return state.channels.size > 0 || state.rawTransform !== undefined
}

/** Commits the canonical scalar channels followed by the untouched raw transform. */
export function commitHtmlTransformStyle(
  node: HtmlElementNode,
  state: HtmlTransformStyleState,
): void {
  if (!hasHtmlTransformStyleOutput(state)) {
    setHtmlStyleProperty(node, 'transform', '')
    return
  }
  const channelTransform = composeTransformChannels(state.channels)
  const value = [channelTransform, state.rawTransform]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' ')
  setHtmlStyleProperty(node, 'transform', value)
}

/** Converts a numeric or unitless translate property at the HTML boundary. */
function formatTranslateProperty(value: unknown, context: HtmlMaterializerRuntimeContext): string {
  const logicalLength = projectHtmlLogicalLength(value, context)
  if (logicalLength !== undefined) return logicalLength
  if (typeof value === 'number') return `${scaleNumericLength(value, context)}px`
  if (typeof value !== 'string') return String(value)
  const tokens = value.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return value
  if (!tokens.every((token) => /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(token))) return value
  return tokens.map((token) => `${scaleNumericLength(Number(token), context)}px`).join(' ')
}

/** Composes only explicitly supplied scalar channels in the fixed V2 order. */
function composeTransformChannels(channels: ReadonlyMap<TransformProperty, string>): string | undefined {
  if (channels.size === 0) return undefined
  const hasTranslateX = channels.has('translateX')
  const hasTranslateY = channels.has('translateY')
  const translation = hasTranslateX && hasTranslateY
    ? `translate(${channels.get('translateX')}, ${channels.get('translateY')})`
    : undefined

  return getTransformOrder()
    .flatMap((property) => {
      if (property === 'translateX') {
        if (translation !== undefined) return [translation]
        const channel = channels.get(property)
        return channel === undefined ? [] : [`translateX(${channel})`]
      }
      if (property === 'translateY') {
        if (translation !== undefined) return []
        const channel = channels.get(property)
        return channel === undefined ? [] : [`translateY(${channel})`]
      }
      const channel = channels.get(property)
      return channel === undefined ? [] : [`${property}(${channel})`]
    })
    .join(' ')
}

/** Maps one author property to a scalar transform channel materialized by HTML. */
function resolveTransformProperty(property: string): TransformProperty | undefined {
  const canonical = canonicalTransformProperty(property)
  return canonical !== undefined && isScalarTransformProperty(canonical) ? canonical : undefined
}

/** Converts one authored scalar transform value to its CSS channel representation. */
function transformCssValue(
  property: TransformProperty,
  value: unknown,
  context: HtmlMaterializerRuntimeContext,
): string {
  const logicalLength = projectHtmlLogicalLength(value, context)
  if (logicalLength !== undefined) return logicalLength
  if (typeof value !== 'number' || !isLengthTransformProperty(property)) return String(value)
  return `${scaleNumericLength(value, context)}px`
}

/** Identifies transform channels whose numeric values represent lengths. */
function isLengthTransformProperty(property: TransformProperty): boolean {
  return property === 'perspective'
    || property === 'translateX'
    || property === 'translateY'
    || property === 'translateZ'
}

/** Returns one finite runtime scale, falling back to the neutral scale. */
function scaleNumericLength(value: number, context: HtmlMaterializerRuntimeContext): number {
  const scale = Number.isFinite(context.numericLengthScale) ? context.numericLengthScale : 1
  return value * scale
}

/** Preserves a raw author transform without parsing or reordering it. */
function rawTransformValue(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value)
}

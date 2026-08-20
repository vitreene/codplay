import {
  getTransformOrder,
  isScalarTransformProperty,
  resolveTransformProperty as canonicalTransformProperty,
  type TransformProperty,
} from '../../ace'
import { RuntimeComponentServiceCatalog } from '../components'

/** Runtime values supplied by the HTML materializer and kept outside logical state. */
export type HtmlMaterializerRuntimeContext = {
  /** Scale applied to unitless numeric CSS lengths at the HTML boundary. */
  numericLengthScale: number
}

/** Creates the standard DOM services used by the HTML runner. */
export function createDomComponentServiceCatalog(
  context: HtmlMaterializerRuntimeContext = { numericLengthScale: 1 },
): RuntimeComponentServiceCatalog {
  const catalog = new RuntimeComponentServiceCatalog()
  catalog.register({
    id: 'className',
    create: () => ({
      apply: (node, value) => {
        if (!isElementNode(node) || typeof value !== 'string') return
        node.className = value
      },
    }),
  })
  catalog.register({
    id: 'style',
    create: () => {
      const managedProperties = new Set<string>()
      const transformChannels = new Map<TransformProperty, string>()
      let rawTransform: string | undefined
      return {
        apply: (node, value) => {
          if (!isElementNode(node) || !isRecord(value)) return
          const hadTransformOutput = transformChannels.size > 0 || rawTransform !== undefined
          for (const property of managedProperties) {
            if (property in value) continue
            if (property === 'transform') {
              rawTransform = undefined
              continue
            }
            const transformProperty = resolveTransformProperty(property)
            if (transformProperty === undefined) setStyleProperty(node, property, '')
            else transformChannels.delete(transformProperty)
          }
          managedProperties.clear()
          for (const [property, rawValue] of Object.entries(value)) {
            if (property === 'transform') {
              rawTransform = rawTransformValue(rawValue)
            } else {
              const transformProperty = resolveTransformProperty(property)
              if (transformProperty === undefined) {
                setStyleProperty(node, property, cssStyleValue(property, rawValue, context))
              } else {
                transformChannels.set(transformProperty, transformCssValue(transformProperty, rawValue, context))
              }
            }
            managedProperties.add(property)
          }
          if (hadTransformOutput || transformChannels.size > 0 || rawTransform !== undefined) {
            setTransformChannels(node, transformChannels, rawTransform)
          }
        },
      }
    },
  })
  catalog.register({
    id: 'attr',
    create: () => {
      const managedAttributes = new Set<string>()
      return {
        apply: (node, value) => {
          if (!isElementNode(node) || !isRecord(value)) return
          for (const name of managedAttributes) {
            if (!(name in value)) node.removeAttribute(name)
          }
          managedAttributes.clear()
          for (const [name, rawValue] of Object.entries(value)) {
            if (rawValue === false || rawValue === null || rawValue === undefined) node.removeAttribute(name)
            else node.setAttribute(name, rawValue === true ? '' : String(rawValue))
            managedAttributes.add(name)
          }
        },
      }
    },
  })
  catalog.register({
    id: 'content',
    create: () => ({
      apply: (node, value) => {
        if (isElementNode(node)) node.textContent = String(value)
      },
    }),
  })
  return catalog
}

/** Applies one CSS value through the browser style declaration contract. */
function setStyleProperty(node: ElementNode, property: string, value: string): void {
  if (property.startsWith('--')) node.style.setProperty(property, value)
  else node.style[property] = value
}

/** Applies scalar channels followed by the untouched author transform sequence. */
function setTransformChannels(
  node: ElementNode,
  channels: ReadonlyMap<TransformProperty, string>,
  rawTransform: string | undefined,
): void {
  if (channels.size === 0 && rawTransform === undefined) {
    setStyleProperty(node, 'transform', '')
    return
  }
  const channelTransform = composeTransformChannels(channels)
  const value = [channelTransform, rawTransform]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(' ')
  setStyleProperty(node, 'transform', value)
}

/** Composes only the explicitly supplied scalar channels in the fixed V2 order. */
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

/** Maps one author property to a scalar transform channel projected by HTML. */
function resolveTransformProperty(property: string): TransformProperty | undefined {
  const canonical = canonicalTransformProperty(property)
  return canonical !== undefined && isScalarTransformProperty(canonical) ? canonical : undefined
}

/** Converts one authored transform scalar to its CSS channel representation. */
function transformCssValue(
  property: TransformProperty,
  value: unknown,
  context: HtmlMaterializerRuntimeContext,
): string {
  if (typeof value !== 'number' || !isLengthTransformProperty(property)) return String(value)
  return `${scaleNumericLength(value, context)}px`
}

/** Identifies transform channels whose numeric author values represent lengths. */
function isLengthTransformProperty(property: TransformProperty): boolean {
  return property === 'perspective'
    || property === 'translateX'
    || property === 'translateY'
    || property === 'translateZ'
}

/** Converts one authored style value at the HTML materialization boundary. */
function cssStyleValue(property: string, value: unknown, context: HtmlMaterializerRuntimeContext): string {
  if (property !== 'translate') return cssValue(value)
  if (typeof value === 'number') return `${scaleNumericLength(value, context)}px`
  if (typeof value !== 'string') return String(value)
  return scaleUnitlessTranslateTokens(value, context)
}

/** Preserves complex translate expressions and scales only a plain numeric shorthand. */
function scaleUnitlessTranslateTokens(value: string, context: HtmlMaterializerRuntimeContext): string {
  const tokens = value.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 3) return value
  if (!tokens.every((token) => /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(token))) return value
  return tokens.map((token) => `${scaleNumericLength(Number(token), context)}px`).join(' ')
}

/** Returns one finite runtime scale, falling back to the neutral scale. */
function scaleNumericLength(value: number, context: HtmlMaterializerRuntimeContext): number {
  const scale = Number.isFinite(context.numericLengthScale) ? context.numericLengthScale : 1
  return value * scale
}

/** Preserves a raw author transform without attempting to parse or reorder it. */
function rawTransformValue(value: unknown): string | undefined {
  return value === null || value === undefined ? undefined : String(value)
}

/** Converts normalized ACE color values and scalar values to CSS text. */
function cssValue(value: unknown): string {
  if (!isRecord(value)) return String(value)
  if (value.kind !== 'color' || !Array.isArray(value.coords) || typeof value.alpha !== 'number') return String(value)
  const coordinates = value.coords
  if (!coordinates.every((coordinate) => typeof coordinate === 'number')) return String(value)
  if (value.space === 'srgb' && coordinates.length >= 3) {
    const alpha = value.alpha === 1 ? '1' : value.alpha.toFixed(3)
    return `rgba(${Math.round(coordinates[0] * 255)}, ${Math.round(coordinates[1] * 255)}, ${Math.round(coordinates[2] * 255)}, ${alpha})`
  }
  if (value.space === 'oklch' && coordinates.length >= 3) {
    return `oklch(${coordinates[0]} ${coordinates[1]} ${coordinates[2]} / ${value.alpha})`
  }
  return String(value)
}

/** Narrows a record-like value without accepting arrays. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Minimal element contract required by the DOM service implementations. */
type ElementNode = {
  className: string
  style: Record<string, string> & { setProperty: (property: string, value: string) => void }
  textContent: string | null
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

/** Checks the element methods used by the standard DOM services. */
function isElementNode(value: unknown): value is ElementNode {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ElementNode>
  return typeof candidate.className === 'string'
    && candidate.style !== undefined
    && typeof candidate.style.setProperty === 'function'
    && typeof candidate.setAttribute === 'function'
    && typeof candidate.removeAttribute === 'function'
}

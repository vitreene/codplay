import { RuntimeComponentServiceCatalog } from '../components'

/** Creates the standard DOM services used by the HTML runner. */
export function createDomComponentServiceCatalog(): RuntimeComponentServiceCatalog {
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
      const transformChannels = new Map<'translateX' | 'translateY', string>()
      return {
        apply: (node, value) => {
          if (!isElementNode(node) || !isRecord(value)) return
          const hadTransformChannels = transformChannels.size > 0
          for (const property of managedProperties) {
            if (property in value) continue
            const transformProperty = resolveTransformProperty(property)
            if (transformProperty === undefined) setStyleProperty(node, property, '')
            else transformChannels.delete(transformProperty)
          }
          managedProperties.clear()
          for (const [property, rawValue] of Object.entries(value)) {
            const transformProperty = resolveTransformProperty(property)
            if (transformProperty === undefined) setStyleProperty(node, property, cssValue(rawValue))
            else transformChannels.set(transformProperty, transformCssValue(rawValue))
            managedProperties.add(property)
          }
          if (hadTransformChannels || transformChannels.size > 0) setTransformChannels(node, transformChannels)
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

/** Applies the resolved transform channels as one CSS translation. */
function setTransformChannels(
  node: ElementNode,
  channels: ReadonlyMap<'translateX' | 'translateY', string>,
): void {
  if (channels.size === 0) {
    setStyleProperty(node, 'transform', '')
    return
  }
  const x = channels.get('translateX') ?? '0px'
  const y = channels.get('translateY') ?? '0px'
  setStyleProperty(node, 'transform', `translate(${x}, ${y})`)
}

/** Maps the author aliases to the transform channels currently projected by HTML. */
function resolveTransformProperty(property: string): 'translateX' | 'translateY' | undefined {
  if (property === 'x' || property === 'translateX') return 'translateX'
  if (property === 'y' || property === 'translateY') return 'translateY'
  return undefined
}

/** Converts one authored transform scalar to a CSS translation component. */
function transformCssValue(value: unknown): string {
  return typeof value === 'number' ? `${value}px` : String(value)
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

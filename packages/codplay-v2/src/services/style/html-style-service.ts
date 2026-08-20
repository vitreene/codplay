import {
  applyHtmlTransformStyleProperty,
  commitHtmlTransformStyle,
  createHtmlTransformStyleState,
  hasHtmlTransformStyleOutput,
  removeHtmlTransformStyleProperty,
} from './html-transform-service'
import {
  isHtmlElementNode,
  isServiceRecord,
  setHtmlStyleProperty,
  type HtmlMaterializerRuntimeContext,
} from '../html-materializer-service-types'
import type { RuntimeComponentServiceInstance } from '../../runtime/catalog'

/** Creates the component-scoped HTML adapter for the style service. */
export function createHtmlStyleService(context: HtmlMaterializerRuntimeContext): RuntimeComponentServiceInstance {
  const managedProperties = new Set<string>()
  const transformState = createHtmlTransformStyleState()
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node) || !isServiceRecord(value)) return
      const hadTransformOutput = hasHtmlTransformStyleOutput(transformState)

      for (const property of managedProperties) {
        if (property in value) continue
        if (removeHtmlTransformStyleProperty(transformState, node, property)) continue
        setHtmlStyleProperty(node, property, '')
      }

      managedProperties.clear()
      for (const [property, rawValue] of Object.entries(value)) {
        if (rawValue === null || rawValue === undefined) {
          if (!removeHtmlTransformStyleProperty(transformState, node, property)) {
            setHtmlStyleProperty(node, property, '')
          }
          managedProperties.add(property)
          continue
        }
        if (!applyHtmlTransformStyleProperty(transformState, node, property, rawValue, context)) {
          setHtmlStyleProperty(node, property, cssValue(rawValue))
        }
        managedProperties.add(property)
      }

      if (hadTransformOutput || hasHtmlTransformStyleOutput(transformState)) {
        commitHtmlTransformStyle(node, transformState)
      }
    },
  }
}

/** Converts normalized ACE colors and scalar values to CSS text. */
function cssValue(value: unknown): string {
  if (!isServiceRecord(value)) return String(value)
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

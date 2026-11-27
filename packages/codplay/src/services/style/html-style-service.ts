import { formatColor, isColorValue, isLegacySrgbColorValue, toOklchColor } from 'ace'
import {
  applyHtmlTransformStyleProperty,
  commitHtmlTransformStyle,
  createHtmlTransformStyleState,
  hasHtmlTransformStyleOutput,
  removeHtmlTransformStyleProperty,
} from './html-transform-service'
import {
  isHtmlElementNode,
  projectHtmlLogicalLength,
  isServiceRecord,
  setHtmlStyleProperty,
  type HtmlMaterializerRuntimeContext,
} from '../html-materializer-service-types'
import type { ServiceRuntimeInstance } from '../service-runtime-types'

/** Creates the component-scoped HTML adapter for the style service. */
export function createHtmlStyleService(context: HtmlMaterializerRuntimeContext): ServiceRuntimeInstance {
  const stateByNode = new WeakMap<object, {
    managedProperties: Set<string>
    transformState: ReturnType<typeof createHtmlTransformStyleState>
  }>()
  return {
    apply: (node, value) => {
      if (!isHtmlElementNode(node) || !isServiceRecord(value)) return
      const nodeKey = node as object
      const state = stateByNode.get(nodeKey) ?? {
        managedProperties: new Set<string>(),
        transformState: createHtmlTransformStyleState(),
      }
      const { managedProperties, transformState } = state
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
          setHtmlStyleProperty(node, property, cssValue(rawValue, context))
        }
        managedProperties.add(property)
      }

      if (hadTransformOutput || hasHtmlTransformStyleOutput(transformState)) {
        commitHtmlTransformStyle(node, transformState)
      }
      stateByNode.set(nodeKey, state)
    },
  }
}

/** Converts normalized ACE colors and scalar values to CSS text. */
function cssValue(value: unknown, context: HtmlMaterializerRuntimeContext): string {
  const logicalLength = projectHtmlLogicalLength(value, context)
  if (logicalLength !== undefined) return logicalLength
  if (isColorValue(value)) return formatColor(value)
  if (isLegacySrgbColorValue(value)) return formatColor(toOklchColor(value))
  return String(value)
}

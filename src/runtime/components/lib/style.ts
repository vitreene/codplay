import { isDomElement, resolveFinalValue } from '../dom-component-adapter'

export type StyleProps = Record<string, unknown>

export type StylePropsOptions = {
  skipTransitionValues?: boolean
}

export type StylePropsTarget = {
  nodeRef: unknown | null | undefined
  style: StyleProps | undefined
  options?: StylePropsOptions
}

/**
 * Checks whether one style entry uses one transition-like payload.
 */
function isTransitionStyleValue(rawValue: unknown): rawValue is { to: unknown } {
  return typeof rawValue === 'object' && rawValue !== null && 'to' in rawValue
}

/**
 * Applies one style prop map with hot-path oriented loops.
 */
export function applyStyleProps(
  nodeRef: unknown | null | undefined,
  styleProps: StyleProps | undefined,
  options: StylePropsOptions = {}
): void {
  if (nodeRef === null || nodeRef === undefined || styleProps === undefined) {
    return
  }

  if (isDomElement(nodeRef)) {
    const style = (nodeRef as unknown as { style?: Record<string, unknown> }).style
    if (style === undefined || style === null) {
      return
    }

    const styleWithSetProperty = style as Record<string, unknown> & {
      setProperty?: (propertyName: string, value: string) => void
      removeProperty?: (propertyName: string) => void
    }

    for (const key in styleProps) {
      const rawValue = styleProps[key]
      if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
        continue
      }

      const finalValue = resolveFinalValue(rawValue)
      if (finalValue === undefined || finalValue === null) {
        if (key.includes('-')) {
          styleWithSetProperty.removeProperty?.(key)
        } else {
          style[key] = ''
        }
        continue
      }

      const stringValue = String(finalValue)
      if (key.includes('-') && styleWithSetProperty.setProperty) {
        styleWithSetProperty.setProperty(key, stringValue)
        continue
      }

      style[key] = stringValue
    }
    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  const currentStyle =
    typeof mutableNode.style === 'object' && mutableNode.style !== null
      ? (mutableNode.style as Record<string, unknown>)
      : {}

  for (const key in styleProps) {
    const rawValue = styleProps[key]
    if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
      continue
    }

    currentStyle[key] = resolveFinalValue(rawValue)
  }

  mutableNode.style = currentStyle
}

/**
 * Applies style props on several DOM parts with one shared iteration shape.
 */
export function applyStylePropsToTargets(targets: StylePropsTarget[]): void {
  for (const target of targets) {
    applyStyleProps(target.nodeRef, target.style, target.options)
  }
}

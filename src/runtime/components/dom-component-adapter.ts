import type { CreateElementOptions } from '../create-element'
import type { ItemDoc, RuntimeNode } from '../types'

/**
 * Checks whether one runtime node reference is a browser Element.
 */
export function isDomElement(nodeRef: unknown): nodeRef is Element {
  if (typeof globalThis.Element === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Element
}

/**
 * Checks whether one runtime node reference is a browser Node.
 */
export function isDomNode(nodeRef: unknown): nodeRef is Node {
  if (typeof globalThis.Node === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Node
}

/**
 * Resolves final scalar value from either literal or transition object.
 */
export function resolveFinalValue(rawValue: unknown): unknown {
  if (typeof rawValue !== 'object' || rawValue === null) {
    return rawValue
  }

  const transitionLike = rawValue as { to?: unknown }
  if (transitionLike.to !== undefined) {
    return transitionLike.to
  }

  return rawValue
}

/**
 * Checks whether one style payload entry is a transition definition.
 */
function isTransitionStyleValue(rawValue: unknown): rawValue is { to: unknown } {
  return typeof rawValue === 'object' && rawValue !== null && 'to' in rawValue
}

/**
 * Creates one plain object node when browser DOM is unavailable.
 */
function createObjectNode(tagName: string): RuntimeNode {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

/**
 * Creates one runtime node using nodeFactory, DOM, or plain object fallback.
 */
export function createRuntimeNode(
  item: ItemDoc,
  fallbackTagName: string,
  options: CreateElementOptions | undefined
): unknown {
  const customNode = options?.nodeFactory?.(item)
  if (customNode !== undefined) {
    return customNode
  }

  if (typeof globalThis.document !== 'undefined') {
    return globalThis.document.createElement(fallbackTagName)
  }

  return createObjectNode(fallbackTagName.toUpperCase())
}

/**
 * Resets mutable state on one runtime node before applying initial values.
 */
export function resetRuntimeNodeState(nodeRef: unknown): void {
  if (isDomElement(nodeRef)) {
    const attributeNames =
      typeof nodeRef.getAttributeNames === 'function'
        ? nodeRef.getAttributeNames()
        : []

    for (const attributeName of attributeNames) {
      nodeRef.removeAttribute(attributeName)
    }

    nodeRef.className = ''
    nodeRef.textContent = ''

    const style = (nodeRef as unknown as { style?: { cssText?: string } }).style
    if (style && typeof style.cssText === 'string') {
      style.cssText = ''
    }

    if (
      typeof globalThis.HTMLImageElement !== 'undefined' &&
      nodeRef instanceof globalThis.HTMLImageElement
    ) {
      nodeRef.src = ''
      nodeRef.alt = ''
    }

    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  mutableNode.id = undefined
  mutableNode.className = ''
  mutableNode.textContent = undefined
  mutableNode.src = undefined
  mutableNode.alt = undefined
  mutableNode.style = {}
  mutableNode.attributes = {}

  if ('parentId' in mutableNode) {
    delete mutableNode.parentId
  }
}

/**
 * Applies one id value on a runtime node when supported.
 */
export function applyNodeId(nodeRef: unknown, id: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    return
  }

  if (isDomElement(nodeRef)) {
    nodeRef.id = id
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).id = id
  }
}

/**
 * Applies className updates on one runtime node.
 */
export function applyClassNamePatch(
  nodeRef: unknown,
  className: string | { add?: string; remove?: string } | undefined
): void {
  if (className === undefined) {
    return
  }

  if (typeof className === 'string') {
    if (isDomElement(nodeRef)) {
      nodeRef.className = className
      return
    }

    if (typeof nodeRef === 'object' && nodeRef !== null) {
      ;(nodeRef as Record<string, unknown>).className = className
    }
    return
  }

  const initialValue =
    typeof nodeRef === 'object' && nodeRef !== null && typeof (nodeRef as { className?: unknown }).className === 'string'
      ? ((nodeRef as { className?: string }).className ?? '')
      : ''

  const classSet = new Set(initialValue.split(/\s+/).filter((token) => token.length > 0))
  for (const token of (className.add ?? '').split(/\s+/)) {
    if (token.length > 0) {
      classSet.add(token)
    }
  }

  for (const token of (className.remove ?? '').split(/\s+/)) {
    if (token.length > 0) {
      classSet.delete(token)
    }
  }

  const finalClassName = [...classSet].join(' ')
  if (isDomElement(nodeRef)) {
    nodeRef.className = finalClassName
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).className = finalClassName
  }
}

/**
 * Applies style patch values on one runtime node.
 */
export function applyStylePatch(
  nodeRef: unknown,
  patch: Record<string, unknown> | undefined,
  options: {
    skipTransitionValues?: boolean
  } = {}
): void {
  if (patch === undefined) {
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

    for (const [key, rawValue] of Object.entries(patch)) {
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

      const value = String(finalValue)
      if (key.includes('-') && styleWithSetProperty.setProperty) {
        styleWithSetProperty.setProperty(key, value)
        continue
      }

      style[key] = value
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

  for (const [key, rawValue] of Object.entries(patch)) {
    if (options.skipTransitionValues && isTransitionStyleValue(rawValue)) {
      continue
    }

    currentStyle[key] = resolveFinalValue(rawValue)
  }

  mutableNode.style = currentStyle
}

/**
 * Applies attributes patch values on one runtime node.
 */
export function applyAttrPatch(nodeRef: unknown, patch: Record<string, unknown> | undefined): void {
  if (patch === undefined) {
    return
  }

  if (isDomElement(nodeRef)) {
    for (const [key, rawValue] of Object.entries(patch)) {
      if (rawValue === undefined || rawValue === null || rawValue === false) {
        nodeRef.removeAttribute(key)
        continue
      }

      nodeRef.setAttribute(key, String(rawValue))
    }
    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const mutableNode = nodeRef as Record<string, unknown>
  const attributes =
    typeof mutableNode.attributes === 'object' && mutableNode.attributes !== null
      ? (mutableNode.attributes as Record<string, unknown>)
      : {}

  for (const [key, rawValue] of Object.entries(patch)) {
    if (rawValue === undefined || rawValue === null || rawValue === false) {
      delete attributes[key]
      continue
    }

    attributes[key] = rawValue
  }

  mutableNode.attributes = attributes
}

/**
 * Applies text content on one runtime node when supported.
 */
export function applyTextContent(nodeRef: unknown, content: string): void {
  if (isDomElement(nodeRef)) {
    nodeRef.textContent = content
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).textContent = content
  }
}

/**
 * Applies one image source url on one runtime media node.
 */
export function applyImageSource(nodeRef: unknown, src: string): void {
  if (
    isDomElement(nodeRef) &&
    typeof globalThis.HTMLImageElement !== 'undefined' &&
    nodeRef instanceof globalThis.HTMLImageElement
  ) {
    nodeRef.src = src
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).src = src
  }
}

/**
 * Applies one image alt text on one runtime media node.
 */
export function applyImageAlt(nodeRef: unknown, alt: string): void {
  if (
    isDomElement(nodeRef) &&
    typeof globalThis.HTMLImageElement !== 'undefined' &&
    nodeRef instanceof globalThis.HTMLImageElement
  ) {
    nodeRef.alt = alt
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).alt = alt
  }
}

/**
 * Applies one object-fit value on one runtime media node.
 */
export function applyObjectFit(nodeRef: unknown, objectFit: 'cover' | 'contain'): void {
  if (isDomElement(nodeRef)) {
    ;(nodeRef as HTMLElement).style.objectFit = objectFit
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    const mutableNode = nodeRef as Record<string, unknown>
    const style =
      typeof mutableNode.style === 'object' && mutableNode.style !== null
        ? (mutableNode.style as Record<string, unknown>)
        : {}

    style.objectFit = objectFit
    mutableNode.style = style
  }
}

/**
 * Appends one child node when both parent and child are DOM nodes.
 */
export function appendDomChild(parentNode: unknown, childNode: unknown): void {
  if (isDomNode(parentNode) && isDomNode(childNode)) {
    parentNode.appendChild(childNode)
  }
}

/**
 * Removes one child node when both parent and child are DOM nodes.
 */
export function removeDomChild(parentNode: unknown, childNode: unknown): void {
  if (isDomNode(parentNode) && isDomNode(childNode)) {
    parentNode.removeChild(childNode)
  }
}

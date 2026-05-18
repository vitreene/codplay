import type { RuntimeComponentClassInput } from '../types'
import {
  appendDomChild,
  applyAttrPatch,
  applyClassNamePatch,
  applyImageAlt,
  applyImageSource,
  applyNodeId,
  applyObjectFit,
  createRuntimeNode,
  isDomElement,
  resetRuntimeNodeState,
  resolveFinalValue
} from '../dom-component-adapter'

export type ClassNameProps = string | { add?: string; remove?: string }
export type AttrProps = Record<string, unknown>
export type StyleProps = Record<string, unknown>
export type StylePropsOptions = {
  skipTransitionValues?: boolean
}
export type ImageFitMode = 'wallpaper' | 'sprite'

/**
 * Checks whether one style entry uses one transition-like payload.
 */
function isTransitionStyleValue(rawValue: unknown): rawValue is { to: unknown } {
  return typeof rawValue === 'object' && rawValue !== null && 'to' in rawValue
}

/**
 * Resolves one image fit mode into the corresponding object-fit value.
 */
function resolveImageObjectFit(fitMode: ImageFitMode): 'cover' | 'contain' {
  return fitMode === 'sprite' ? 'contain' : 'cover'
}

/**
 * Creates one component root using the shared runtime node factory.
 */
export function createComponentRoot(
  item: RuntimeComponentClassInput['item'],
  tagName: string,
  createElementOptions: RuntimeComponentClassInput['createElementOptions']
): unknown {
  return createRuntimeNode(item, tagName, createElementOptions)
}

/**
 * Resets one component root before reapplying authored state.
 */
export function resetComponentRoot(nodeRef: unknown): void {
  resetRuntimeNodeState(nodeRef)
}

/**
 * Applies one stable runtime id on the component root.
 */
export function setComponentRootId(nodeRef: unknown, itemId: string, authoredId: unknown): void {
  applyNodeId(nodeRef, typeof authoredId === 'string' ? authoredId : itemId)
}

/**
 * Applies one className payload on one node-like target.
 */
export function applyClassNameProps(
  nodeRef: unknown | null | undefined,
  className: ClassNameProps | undefined
): void {
  if (nodeRef === null || nodeRef === undefined) {
    return
  }

  applyClassNamePatch(nodeRef, className)
}

/**
 * Applies one attribute prop map on one node-like target.
 */
export function applyAttrProps(nodeRef: unknown | null | undefined, attr: AttrProps | undefined): void {
  if (nodeRef === null || nodeRef === undefined) {
    return
  }

  applyAttrPatch(nodeRef, attr)
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
 * Applies one text content value on one node-like target.
 */
export function setTextContent(nodeRef: unknown, content: string): void {
  if (isDomElement(nodeRef)) {
    nodeRef.textContent = content
    return
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    ;(nodeRef as Record<string, unknown>).textContent = content
  }
}

/**
 * Creates or reuses one image part attached to one root node.
 */
export function ensureImagePart(rootNode: unknown, currentNode: unknown | null): unknown {
  if (isDomElement(rootNode)) {
    const existingNode = currentNode ?? rootNode.querySelector('img') ?? globalThis.document.createElement('img')
    appendDomChild(rootNode, existingNode)
    return existingNode
  }

  return currentNode ?? {
    tagName: 'IMG',
    style: {},
    attributes: {}
  }
}

/**
 * Resets one image part before reapplying authored media props.
 */
export function resetImagePart(nodeRef: unknown): void {
  resetRuntimeNodeState(nodeRef)
}

/**
 * Applies one image source url on one image part.
 */
export function setImageSource(nodeRef: unknown, src: string): void {
  applyImageSource(nodeRef, src)
}

/**
 * Applies one image alternative text on one image part.
 */
export function setImageAlt(nodeRef: unknown, alt: string): void {
  applyImageAlt(nodeRef, alt)
}

/**
 * Applies one image fit mode on one image part.
 */
export function setImageFitMode(nodeRef: unknown, fitMode: ImageFitMode): void {
  applyObjectFit(nodeRef, resolveImageObjectFit(fitMode))
}

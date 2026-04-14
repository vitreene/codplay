import { createListPlugin } from './list-plugin/create-list-plugin'
import type { ItemDoc, RuntimeElement, RuntimeNode, RuntimeNodeFactory } from './types'

export type CreateElementOptions = {
  nodeFactory?: RuntimeNodeFactory
}

/**
 * Checks whether a runtime node reference is a browser Element.
 */
function isDomElement(nodeRef: unknown): nodeRef is Element {
  if (typeof globalThis.Element === 'undefined') {
    return false
  }

  return nodeRef instanceof globalThis.Element
}

/**
 * Applies style entries directly on one DOM element style declaration.
 */
function applyDomStyleEntries(nodeRef: Element, styleEntries: Record<string, unknown>): void {
  const style = (nodeRef as unknown as { style?: Record<string, unknown> }).style
  if (style === undefined || style === null) {
    return
  }

  const styleWithSetProperty = style as Record<string, unknown> & {
    setProperty?: (propertyName: string, value: string) => void
    removeProperty?: (propertyName: string) => void
  }

  for (const [property, rawValue] of Object.entries(styleEntries)) {
    if (rawValue === undefined || rawValue === null) {
      if (property.includes('-')) {
        styleWithSetProperty.removeProperty?.(property)
      } else {
        style[property] = ''
      }
      continue
    }

    const value = String(rawValue)
    if (property.includes('-') && styleWithSetProperty.setProperty) {
      styleWithSetProperty.setProperty(property, value)
      continue
    }

    style[property] = value
  }
}

/**
 * Creates a default runtime node object when no browser DOM is available.
 */
function createDefaultRuntimeNode(tagName: string): RuntimeNode {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

/**
 * Resolves the initial tag name according to item type and state.
 */
function resolveTagName(item: ItemDoc): string {
  if (item.initial.tag) {
    return item.initial.tag
  }

  if (item.type === 'text') {
    return 'p'
  }

  if (item.type === 'img') {
    return 'img'
  }

  return 'div'
}

/**
 * Creates a browser DOM element when the environment supports it.
 */
function createDomElementIfPossible(tagName: string): Element | null {
  if (typeof globalThis.document === 'undefined') {
    return null
  }

  return globalThis.document.createElement(tagName)
}

/**
 * Clears one DOM element mutable state before applying item initial values.
 */
function resetDomNodeState(nodeRef: Element): void {
  const attributeNames =
    typeof nodeRef.getAttributeNames === 'function'
      ? nodeRef.getAttributeNames()
      : []

  for (const attributeName of attributeNames) {
    nodeRef.removeAttribute(attributeName)
  }

  nodeRef.textContent = ''

  const nodeWithSource = nodeRef as unknown as { src?: unknown }
  if (typeof nodeWithSource.src === 'string') {
    nodeWithSource.src = ''
  }
}

/**
 * Clears one non-DOM runtime node mutable state before applying initials.
 */
function resetObjectNodeState(nodeRef: Record<string, unknown>): void {
  nodeRef.id = undefined
  nodeRef.className = ''
  nodeRef.textContent = undefined
  nodeRef.src = undefined
  nodeRef.style = {}
  nodeRef.attributes = {}

  if ('parentId' in nodeRef) {
    delete nodeRef.parentId
  }
}

/**
 * Applies initial item properties onto a runtime node reference.
 */
function applyInitialState(nodeRef: unknown, item: ItemDoc): void {
  const state = item.initial

  if (nodeRef && typeof nodeRef === 'object') {
    if (isDomElement(nodeRef)) {
      resetDomNodeState(nodeRef)
    }

    const mutableNode = nodeRef as Record<string, unknown>
    if (!isDomElement(nodeRef)) {
      resetObjectNodeState(mutableNode)
    }

    if (state.id !== undefined) {
      mutableNode.id = state.id
    }

    if (state.className !== undefined) {
      mutableNode.className = state.className
    }

    if (state.content !== undefined) {
      mutableNode.textContent = state.content
    }

    if (state.src !== undefined) {
      mutableNode.src = state.src
    }

    if (state.style !== undefined) {
      if (isDomElement(nodeRef)) {
        applyDomStyleEntries(nodeRef, state.style)
      } else {
        mutableNode.style = { ...state.style }
      }
    }

    if (state.attr !== undefined) {
      if (isDomElement(nodeRef)) {
        for (const [key, rawValue] of Object.entries(state.attr)) {
          if (rawValue === undefined || rawValue === null || rawValue === false) {
            nodeRef.removeAttribute(key)
            continue
          }

          nodeRef.setAttribute(key, String(rawValue))
        }

        return
      }

      mutableNode.attributes = { ...state.attr }
    }

    if (state.move !== undefined) {
      mutableNode.parentId = state.move
    }
  }
}

/**
 * Creates one runtime element for one item document.
 */
export function createElement(item: ItemDoc, options: CreateElementOptions = {}): RuntimeElement {
  const tagName = resolveTagName(item)
  const customNode = options.nodeFactory?.(item)
  const domNode = customNode === undefined ? createDomElementIfPossible(tagName) : null
  const nodeRef = customNode ?? domNode ?? createDefaultRuntimeNode(tagName)

  applyInitialState(nodeRef, item)

  const plugins = item.type === 'list'
    ? [
        createListPlugin({
          runtimeListId: item.id,
          nodeRef,
          autoAnimate: item.list?.autoAnimate,
          perf: item.list?.perf
        })
      ]
    : undefined

  return {
    runtimeItemId: item.id,
    nodeRef,
    plugins
  }
}

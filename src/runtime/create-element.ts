import { createListPlugin } from './list-plugin/create-list-plugin'
import type { ItemDoc, RuntimeElement, RuntimeNode, RuntimeNodeFactory } from './types'

export type CreateElementOptions = {
  nodeFactory?: RuntimeNodeFactory
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
 * Applies initial item properties onto a runtime node reference.
 */
function applyInitialState(nodeRef: unknown, item: ItemDoc): void {
  const state = item.initial

  if (nodeRef && typeof nodeRef === 'object') {
    const mutableNode = nodeRef as Record<string, unknown>

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
      const style = (mutableNode.style as Record<string, unknown> | undefined) ?? {}
      Object.assign(style, state.style)
      mutableNode.style = style
    }

    if (state.attr !== undefined) {
      const attributes = (mutableNode.attributes as Record<string, unknown> | undefined) ?? {}
      Object.assign(attributes, state.attr)
      mutableNode.attributes = attributes
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

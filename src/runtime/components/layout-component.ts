import { BaseComponent } from './lib/base-component'
import {
  applyAttrProps,
  applyClassNameProps,
  applyStyleProps,
  bindComponentEmitDeclarations
} from './lib/dom'
import { applyNodeId, isDomElement } from './lib/dom-component-adapter'
import type { RuntimeComponentUpdateInput, RuntimeLayoutComponent, RuntimeLayoutOutletSnapshot } from './types'
import type { LayoutFormat } from '../types'

type LayoutState = {
  markup?: unknown
  format?: unknown
  outlets?: unknown
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

type LayoutParsedTree = {
  rootNode: unknown
  nodeById: Map<string, unknown>
}

const DEFAULT_LAYOUT_FORMAT: LayoutFormat = 'html'
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/**
 * Resolves one authored layout format into the runtime domain.
 */
function resolveLayoutFormat(value: unknown): LayoutFormat | null {
  if (value === undefined || value === null) {
    return DEFAULT_LAYOUT_FORMAT
  }

  if (value === 'html' || value === 'svg') {
    return value
  }

  return null
}

/**
 * Checks whether one value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Reads one stable id from one runtime node when available.
 */
function readNodeId(nodeRef: unknown): string | null {
  if (isDomElement(nodeRef)) {
    return nodeRef.id || null
  }

  if (typeof nodeRef === 'object' && nodeRef !== null) {
    const nodeId = (nodeRef as Record<string, unknown>).id
    return typeof nodeId === 'string' && nodeId.length > 0 ? nodeId : null
  }

  return null
}

/**
 * Traverses one runtime node tree and collects ids.
 */
function collectNodeIds(nodeRef: unknown, nodeById: Map<string, unknown>): void {
  const nodeId = readNodeId(nodeRef)
  if (nodeId && !nodeById.has(nodeId)) {
    nodeById.set(nodeId, nodeRef)
  }

  if (isDomElement(nodeRef)) {
    for (const childNode of Array.from(nodeRef.children)) {
      collectNodeIds(childNode, nodeById)
    }

    return
  }

  if (typeof nodeRef !== 'object' || nodeRef === null) {
    return
  }

  const objectNode = nodeRef as { children?: unknown[] }
  for (const childNode of objectNode.children ?? []) {
    collectNodeIds(childNode, nodeById)
  }
}

/**
 * Appends one child into one DOM or object parent.
 */
function appendNodeToParent(parentNode: unknown, childNode: unknown): void {
  if (isDomElement(parentNode) && isDomElement(childNode)) {
    parentNode.appendChild(childNode)
    return
  }

  if (typeof parentNode !== 'object' || parentNode === null || typeof childNode !== 'object' || childNode === null) {
    return
  }

  const mutableParent = parentNode as { children?: unknown[] }
  const mutableChild = childNode as { parentNode?: unknown | null }
  const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : []
  mutableParent.children = currentChildren.filter((candidate) => candidate !== childNode).concat([childNode])
  mutableChild.parentNode = parentNode
}

/**
 * Creates one wrapper node when multiple top-level nodes are authored.
 */
function createLayoutWrapper(format: LayoutFormat): unknown {
  if (typeof globalThis.document === 'undefined') {
    return null
  }

  if (format === 'svg' && typeof globalThis.document.createElementNS === 'function') {
    return globalThis.document.createElementNS(SVG_NAMESPACE, 'svg')
  }

  return globalThis.document.createElement(format === 'svg' ? 'svg' : 'div')
}

/**
 * Parses one layout fragment using browser DOM primitives.
 */
function parseLayoutMarkup(markup: string, format: LayoutFormat): LayoutParsedTree {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('LayoutComponent requires a DOM environment')
  }

  if (format === 'svg' && typeof globalThis.DOMParser !== 'undefined') {
    const parser = new globalThis.DOMParser()
    const document = parser.parseFromString(`<svg xmlns="${SVG_NAMESPACE}">${markup}</svg>`, 'image/svg+xml')
    const wrapperNode = document.documentElement
    const childNodes = Array.from(wrapperNode.childNodes).filter((childNode) => {
      return !(childNode.nodeType === Node.TEXT_NODE && childNode.textContent?.trim().length === 0)
    })

    const rootNode = childNodes.length === 1 ? childNodes[0] : wrapperNode
    const nodeById = new Map<string, unknown>()
    collectNodeIds(rootNode, nodeById)
    return { rootNode, nodeById }
  }

  const template = globalThis.document.createElement('template')
  template.innerHTML = markup
  const childNodes = Array.from(template.content.childNodes).filter((childNode) => {
    return !(childNode.nodeType === Node.TEXT_NODE && childNode.textContent?.trim().length === 0)
  })

  const rootNode = childNodes.length === 1 ? childNodes[0] : createLayoutWrapper(format)
  if (childNodes.length > 1 && rootNode !== null) {
    for (const childNode of childNodes) {
      appendNodeToParent(rootNode, childNode)
    }
  }

  const nodeById = new Map<string, unknown>()
  collectNodeIds(rootNode, nodeById)
  return { rootNode, nodeById }
}

/**
 * Implements the static layout runtime with declarative outlets.
 */
export class LayoutComponent extends BaseComponent implements RuntimeLayoutComponent {
  private outletIds: string[] = []

  /**
   * Creates the parsed layout tree and registers declarative outlets.
   */
  init(initial: Record<string, unknown>): void {
    const state = initial as LayoutState
    const format = resolveLayoutFormat(state.format)
    if (format === null) {
      this.warn('AUTHOR_LAYOUT_FORMAT_INVALID', 'Layout format must be html or svg', {
        format: state.format
      })
    }

    const resolvedFormat = format ?? DEFAULT_LAYOUT_FORMAT
    const markup = isNonEmptyString(state.markup) ? state.markup : ''
    if (markup.length === 0) {
      this.warn('AUTHOR_LAYOUT_MARKUP_INVALID', 'Layout markup must be a non-empty string')
    }

    this.clearParts()
    this.outletIds = []

    const parsedTree = parseLayoutMarkup(markup, resolvedFormat)
    const rootNode = parsedTree.rootNode

    if (readNodeId(rootNode) === null) {
      applyNodeId(rootNode, this.item.id)
    }

    for (const [nodeId, nodeRef] of parsedTree.nodeById) {
      this.setPart(nodeId, nodeRef)
    }

    this.registerOutlets(state.outlets, parsedTree.nodeById)

    applyClassNameProps(rootNode, state.className)
    applyStyleProps(rootNode, state.style)
    applyAttrProps(rootNode, state.attr)

    this.setRoot(rootNode)

    bindComponentEmitDeclarations({
      item: this.item,
      createElementOptions: this.createElementOptions,
      resolveRef: (ref) => this.resolveRef(ref),
      warn: (warning) => {
        this.warn(warning.code, warning.message, warning.details)
      }
    })
  }

  /**
   * Applies one resolved runtime action on the root layout node.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.warn('RUNTIME_LAYOUT_NOT_INITIALIZED', 'Layout component update rejected because init is missing', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    const state = input.action as LayoutState
    applyStyleProps(this.rootNode, state.style, {
      skipTransitionValues: true
    })
    applyClassNameProps(this.rootNode, state.className)
    applyAttrProps(this.rootNode, state.attr)
  }

  /**
   * Returns one snapshot of the registered outlet nodes.
   */
  getOutletsSnapshot(): RuntimeLayoutOutletSnapshot[] {
    return this.outletIds.map((outletId) => ({
      outletId,
      nodeRef: this.resolveRef(outletId)
    }))
  }

  /**
   * Registers every declared outlet present in the parsed markup tree.
   */
  private registerOutlets(outlets: unknown, nodeById: Map<string, unknown>): void {
    if (!Array.isArray(outlets)) {
      return
    }

    const seenOutletIds = new Set<string>()
    for (const outlet of outlets) {
      const outletId = typeof outlet === 'object' && outlet !== null ? (outlet as { id?: unknown }).id : undefined
      if (!isNonEmptyString(outletId)) {
        this.warn('AUTHOR_LAYOUT_OUTLET_INVALID', 'Layout outlet id must be a non-empty string', {
          outlet
        })
        continue
      }

      if (seenOutletIds.has(outletId)) {
        this.warn('AUTHOR_LAYOUT_OUTLET_DUPLICATE', 'Layout outlet ids must be unique', {
          outletId
        })
        continue
      }

      const outletNode = nodeById.get(outletId)
      if (outletNode === undefined) {
        this.warn('AUTHOR_LAYOUT_OUTLET_NOT_FOUND', 'Layout outlet id must exist in markup', {
          outletId
        })
        continue
      }

      seenOutletIds.add(outletId)
      this.outletIds.push(outletId)
      this.setPart(outletId, outletNode)
    }
  }
}

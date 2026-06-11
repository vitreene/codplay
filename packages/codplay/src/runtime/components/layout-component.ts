import { BaseComponent } from './lib/base-component'
import { bindComponentEmitDeclarations } from './lib/dom'
import { applyNodeId, collectDataParts, isDomElement } from './lib/dom-component-adapter'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput, RuntimeLayoutComponent, RuntimeLayoutOutletSnapshot } from './types'
import type { LayoutFormat } from '../types'

type LayoutState = {
  markup?: unknown
  format?: unknown
}

type LayoutParsedTree = {
  rootNode: unknown
  nodeByPart: Map<string, unknown>
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
      return !(childNode.nodeType === 3 && childNode.textContent?.trim().length === 0)
    })

    const rootNode = childNodes.length === 1 ? childNodes[0] : wrapperNode
    const nodeByPart = new Map<string, unknown>()
    collectDataParts(rootNode, nodeByPart)
    return { rootNode, nodeByPart }
  }

  const template = globalThis.document.createElement('template')
  template.innerHTML = markup
  const childNodes = Array.from(template.content.childNodes).filter((childNode) => {
    return !(childNode.nodeType === 3 && childNode.textContent?.trim().length === 0)
  })

  const rootNode = childNodes.length === 1 ? childNodes[0] : createLayoutWrapper(format)
  if (childNodes.length > 1 && rootNode !== null) {
    for (const childNode of childNodes) {
      appendNodeToParent(rootNode, childNode)
    }
  }

  const nodeByPart = new Map<string, unknown>()
  collectDataParts(rootNode, nodeByPart)
  return { rootNode, nodeByPart }
}

/**
 * Implements the static layout runtime with data-part anchors.
 */
export class LayoutComponent extends BaseComponent implements RuntimeLayoutComponent {
  private partIds: string[] = []

  /**
   * Declares services used for className, style and attr patches.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  /**
   * Binds authored emit declarations once the root node is available.
   */
  init(): void {
    bindComponentEmitDeclarations({
      perso: this.perso,
      createElementOptions: this.createElementOptions,
      resolveRef: (ref) => this.resolveRef(ref),
      report: (warning) => {
        this.report(warning.code, warning.message, warning.details)
      }
    })
  }

  /**
   * Returns one snapshot of all data-part nodes registered in the current markup.
   */
  getOutletsSnapshot(): RuntimeLayoutOutletSnapshot[] {
    return this.partIds.map((partId) => ({
      outletId: partId,
      nodeRef: this.resolveRef(partId)
    }))
  }

  /**
   * Applies one resolved runtime action on the root layout node.
   */
  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
  }

  /**
   * Creates the parsed layout tree and registers all data-part nodes.
   */
  render(): ComponentRenderResult {
    const state = this.perso.initial as LayoutState
    const format = resolveLayoutFormat(state.format)
    if (format === null) {
      this.report('AUTHOR_LAYOUT_FORMAT_INVALID', 'Layout format must be html or svg', { format: state.format })
    }

    const resolvedFormat = format ?? DEFAULT_LAYOUT_FORMAT
    const markup = isNonEmptyString(state.markup) ? state.markup : ''
    if (markup.length === 0) {
      this.report('AUTHOR_LAYOUT_MARKUP_INVALID', 'Layout markup must be a non-empty string')
    }

    this.clearParts()
    this.partIds = []

    const parsedTree = parseLayoutMarkup(markup, resolvedFormat)
    const rootNode = parsedTree.rootNode

    if (readNodeId(rootNode) === null) {
      applyNodeId(rootNode, this.perso.id)
    }

    for (const [partId, partRef] of parsedTree.nodeByPart) {
      this.setPart(partId, partRef)
      this.partIds.push(partId)
    }

    this.services.apply(rootNode, this.perso.initial)

    return rootNode as Node
  }
}

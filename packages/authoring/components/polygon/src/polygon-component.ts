import { BaseComponent } from 'codplay/runtime/components/lib/base-component'
import { applyNodeId, isDomElement } from 'codplay/runtime/components/lib/dom-component-adapter'
import type { RuntimeComponentClassInput } from 'codplay/runtime/components/types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from 'codplay/runtime/components/types'
import { normalizePolygonShapeState, resolveMorphPointsString, resolvePolygonPointsString, type PolygonShapeState } from './polygon-geometry.js'
import type { PolygonAction, PolygonInitial, PolygonMorphState } from './polygon-types.js'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/** Checks whether one value is a DOM SVG element. */
function isSvgElement(node: unknown): node is SVGElement {
  return typeof globalThis.SVGElement !== 'undefined' && node instanceof globalThis.SVGElement
}

/** Checks whether one morph payload is well-formed enough to resolve geometry. */
function isPolygonMorphState(value: unknown): value is PolygonMorphState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.from === 'object' && candidate.from !== null && typeof candidate.to === 'object' && candidate.to !== null && typeof candidate.progress === 'number'
}

/** Creates one SVG element in DOM or one plain fallback object in tests/non-DOM environments. */
function createSvgElement<T extends keyof SVGElementTagNameMap>(tagName: T): SVGElementTagNameMap[T] | Record<string, unknown> {
  if (typeof globalThis.document !== 'undefined' && typeof globalThis.document.createElementNS === 'function') {
    return globalThis.document.createElementNS(SVG_NAMESPACE, tagName)
  }
  return {
    tagName,
    namespaceURI: SVG_NAMESPACE,
    style: {},
    attributes: {},
    childNodes: [],
    appendChild(child: unknown) {
      ;(this.childNodes as unknown[]).push(child)
      return child
    },
    setAttribute(name: string, value: string) {
      ;(this.attributes as Record<string, unknown>)[name] = value
    },
  }
}

export class PolygonComponent extends BaseComponent {
  private shapeNode: unknown | null = null
  private textNode: unknown | null = null
  private currentShapeState = normalizePolygonShapeState({})
  private authoredAttrs: Map<string, Map<string, string>> | null = null

  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['style', 'attr'])
  }

  /** Applies one className payload on the SVG root with SVG-safe semantics. */
  private applyRootClassName(value: unknown): void {
    if (value === undefined || this.node === null) {
      return
    }

    const readCurrentClassName = (): string => {
      if (isSvgElement(this.node)) {
        return this.node.getAttribute('class') ?? ''
      }

      if (isDomElement(this.node)) {
        return this.node.className
      }

      if (typeof this.node === 'object' && this.node !== null && typeof (this.node as { className?: unknown }).className === 'string') {
        return (this.node as { className: string }).className
      }

      return ''
    }

    const writeClassName = (className: string): void => {
      if (isSvgElement(this.node)) {
        if (className.length === 0) {
          this.node.removeAttribute('class')
          return
        }
        this.node.setAttribute('class', className)
        return
      }

      if (isDomElement(this.node)) {
        this.node.className = className
        return
      }

      if (typeof this.node === 'object' && this.node !== null) {
        ;(this.node as Record<string, unknown>).className = className
      }
    }

    if (typeof value === 'string') {
      writeClassName(value)
      return
    }

    if (typeof value !== 'object' || value === null) {
      return
    }

    const classNamePatch = value as { add?: unknown; remove?: unknown }
    const classSet = new Set(readCurrentClassName().split(/\s+/).filter((token) => token.length > 0))

    for (const token of (typeof classNamePatch.add === 'string' ? classNamePatch.add : '').split(/\s+/)) {
      if (token.length > 0) {
        classSet.add(token)
      }
    }

    for (const token of (typeof classNamePatch.remove === 'string' ? classNamePatch.remove : '').split(/\s+/)) {
      if (token.length > 0) {
        classSet.delete(token)
      }
    }

    writeClassName([...classSet].join(' '))
  }

  /** Applies one text value in the centered SVG label. */
  private applyContent(value: unknown): void {
    if (this.textNode === null) return
    const content = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    if (typeof globalThis.Element !== 'undefined' && this.textNode instanceof globalThis.Element) {
      this.textNode.textContent = content
      return
    }
    if (typeof this.textNode === 'object' && this.textNode !== null) {
      ;(this.textNode as Record<string, unknown>).textContent = content
    }
  }

  /** Applies one polygon points string on the internal shape node. */
  private applyPoints(points: string): void {
    if (this.shapeNode === null) return
    if (isSvgElement(this.shapeNode)) {
      this.shapeNode.setAttribute('points', points)
      return
    }
    if (typeof this.shapeNode === 'object' && this.shapeNode !== null) {
      ;(this.shapeNode as Record<string, unknown>).points = points
    }
  }

  /** Applies the current static shape state. */
  private applyStaticShape(): void {
    this.applyPoints(resolvePolygonPointsString(this.currentShapeState))
  }

  /** Applies one morph-interpolated polygon shape. */
  private applyMorph(morph: PolygonMorphState): void {
    this.applyPoints(resolveMorphPointsString(morph))
  }

  /** Captures one DOM node's authored attribute baseline under one local key. */
  private captureAuthoredAttrs(nodeRef: unknown, key: string): void {
    if (this.authoredAttrs === null || !isDomElement(nodeRef)) {
      return
    }

    const attrs = new Map<string, string>()
    for (const attributeName of nodeRef.getAttributeNames()) {
      attrs.set(attributeName, nodeRef.getAttribute(attributeName) ?? '')
    }
    this.authoredAttrs.set(key, attrs)
  }

  /** Restores one DOM node to its captured authored baseline. */
  private restoreAuthoredAttrs(nodeRef: unknown, key: string): void {
    if (this.authoredAttrs === null || !isDomElement(nodeRef)) {
      return
    }

    const baseline = this.authoredAttrs.get(key)
    if (baseline === undefined) {
      return
    }

    for (const attributeName of nodeRef.getAttributeNames()) {
      nodeRef.removeAttribute(attributeName)
    }
    for (const [attributeName, value] of baseline) {
      nodeRef.setAttribute(attributeName, value)
    }
  }

  /** Builds one DOM-backed SVG root and restores it in place on refresh. */
  private renderDomSvg(initial: PolygonInitial): ComponentRenderResult {
    if (this.node !== null && this.authoredAttrs !== null) {
      this.restoreAuthoredAttrs(this.node, 'root')
      this.restoreAuthoredAttrs(this.shapeNode, 'shape')
      this.restoreAuthoredAttrs(this.textNode, 'text')
      this.currentShapeState = normalizePolygonShapeState(initial)
      this.applyStaticShape()
      this.applyContent(initial.content)
      this.services.apply(this.node, initial as Record<string, unknown>)
      this.applyRootClassName(initial.className)
      return this.node as Node
    }

    const rootNode = createSvgElement('svg')
    const shapeNode = createSvgElement('polygon')
    const textNode = createSvgElement('text')

    if (!isSvgElement(rootNode) || !isSvgElement(shapeNode) || !isSvgElement(textNode)) {
      throw new Error('[polygon] expected SVG DOM nodes in DOM mode')
    }

    applyNodeId(rootNode, this.perso.id)
    rootNode.setAttribute('viewBox', '0 0 100 100')
    rootNode.setAttribute('xmlns', SVG_NAMESPACE)
    rootNode.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    rootNode.setAttribute('aria-hidden', 'true')
    rootNode.style.display = 'block'
    rootNode.style.overflow = 'visible'

    shapeNode.setAttribute('fill', 'currentColor')
    shapeNode.setAttribute('stroke', 'currentColor')
    shapeNode.setAttribute('stroke-width', '1.5')
    shapeNode.setAttribute('vector-effect', 'non-scaling-stroke')

    textNode.setAttribute('x', '50')
    textNode.setAttribute('y', '50')
    textNode.setAttribute('text-anchor', 'middle')
    textNode.setAttribute('dominant-baseline', 'middle')
    textNode.setAttribute('fill', 'var(--polygon-label-color, currentColor)')
    textNode.style.pointerEvents = 'none'

    rootNode.appendChild(shapeNode)
    rootNode.appendChild(textNode)

    this.authoredAttrs = new Map<string, Map<string, string>>()
    this.captureAuthoredAttrs(rootNode, 'root')
    this.captureAuthoredAttrs(shapeNode, 'shape')
    this.captureAuthoredAttrs(textNode, 'text')

    this.shapeNode = shapeNode
    this.textNode = textNode
    this.currentShapeState = normalizePolygonShapeState(initial)
    this.applyStaticShape()
    this.applyContent(initial.content)
    this.services.apply(rootNode, initial as Record<string, unknown>)
    this.node = rootNode
    this.applyRootClassName(initial.className)
    this.node = null
    return rootNode as Node
  }

  /** Builds one plain fallback SVG tree when no DOM implementation is available. */
  private renderFallbackSvg(initial: PolygonInitial): ComponentRenderResult {
    if (this.node !== null) return this.node as ComponentRenderResult

    const rootNode = createSvgElement('svg')
    const shapeNode = createSvgElement('polygon')
    const textNode = createSvgElement('text')

    if (isSvgElement(rootNode)) {
      rootNode.setAttribute('viewBox', '0 0 100 100')
      rootNode.setAttribute('xmlns', SVG_NAMESPACE)
      rootNode.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      rootNode.setAttribute('aria-hidden', 'true')
      rootNode.style.display = 'block'
      rootNode.style.overflow = 'visible'
    }

    if (isSvgElement(shapeNode)) {
      shapeNode.setAttribute('fill', 'currentColor')
      shapeNode.setAttribute('stroke', 'currentColor')
      shapeNode.setAttribute('stroke-width', '1.5')
      shapeNode.setAttribute('vector-effect', 'non-scaling-stroke')
    }

    if (isSvgElement(textNode)) {
      textNode.setAttribute('x', '50')
      textNode.setAttribute('y', '50')
      textNode.setAttribute('text-anchor', 'middle')
      textNode.setAttribute('dominant-baseline', 'middle')
      textNode.setAttribute('fill', 'var(--polygon-label-color, currentColor)')
      textNode.style.pointerEvents = 'none'
    }

    ;(rootNode as { appendChild?: (child: unknown) => unknown }).appendChild?.(shapeNode)
    ;(rootNode as { appendChild?: (child: unknown) => unknown }).appendChild?.(textNode)

    this.shapeNode = shapeNode
    this.textNode = textNode
    this.currentShapeState = normalizePolygonShapeState(initial)
    this.applyStaticShape()
    this.applyContent(initial.content)
    this.services.apply(rootNode, initial as Record<string, unknown>)
    this.node = rootNode
    this.applyRootClassName(initial.className)
    this.node = null

    return rootNode as Node
  }

  /** Builds the SVG root and its internal polygon/text nodes once. */
  render(): ComponentRenderResult {
    const initial = this.perso.initial as PolygonInitial
    if (typeof globalThis.document !== 'undefined') {
      return this.renderDomSvg(initial)
    }

    return this.renderFallbackSvg(initial)
  }

  /** Applies one static or morphing polygon update. */
  update(input: RuntimeComponentUpdateInput): void {
    const action = input.action as PolygonAction
    this.services.apply(this.node, input.action)
    this.applyRootClassName(action.className)

    if (action.content !== undefined) {
      this.applyContent(action.content)
    }

    if (isPolygonMorphState(action.morph)) {
      this.applyMorph(action.morph)
      if (action.morph.progress >= 1) {
        this.currentShapeState = normalizePolygonShapeState(action.morph.to)
      }
      return
    }

    const hasShapeKey = action.sides !== undefined || action.inner !== undefined || action.outer !== undefined || action.rotationDeg !== undefined
    if (!hasShapeKey) return

    const nextShapeState: PolygonShapeState = { ...this.currentShapeState }
    if ('sides' in action) nextShapeState.sides = action.sides
    if ('inner' in action) nextShapeState.inner = action.inner
    if ('outer' in action) nextShapeState.outer = action.outer
    if ('rotationDeg' in action) nextShapeState.rotationDeg = action.rotationDeg

    this.currentShapeState = normalizePolygonShapeState(nextShapeState)
    this.applyStaticShape()
  }
}

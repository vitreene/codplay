import { BaseComponent } from './lib/base-component'
import { bindComponentEmitDeclarations } from './lib/dom'
import type { ComponentRenderResult, RuntimeComponentClassInput, RuntimeComponentUpdateInput } from './types'
import { resolvePolygonPathString, type PolygonShapeState } from './polygon-geometry'
import type { PolygonAction, PolygonInitial, PolygonMorphOptions } from './polygon-types'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const DEFAULT_MORPH_DURATION_MS = 700

/** Creates one SVG element for the polygon component tree. */
function createSvgElement<T extends keyof SVGElementTagNameMap>(tagName: T): SVGElementTagNameMap[T] {
  return document.createElementNS(SVG_NAMESPACE, tagName)
}

/** Checks whether one action changes any polygon geometry field. */
function hasShapeKey(action: PolygonAction): boolean {
  return action.sides !== undefined || action.inner !== undefined || action.outer !== undefined || action.rotationDeg !== undefined || action.inflexion !== undefined
}

/** Resolves the next logical polygon shape from one patch action. */
function resolveNextShapeState(current: PolygonShapeState, action: PolygonAction): PolygonShapeState {
  const nextShapeState: PolygonShapeState = { ...current }
  if ('sides' in action) nextShapeState.sides = action.sides
  if ('inner' in action) nextShapeState.inner = action.inner
  if ('outer' in action) nextShapeState.outer = action.outer
  if ('rotationDeg' in action) nextShapeState.rotationDeg = action.rotationDeg
  if ('inflexion' in action) nextShapeState.inflexion = action.inflexion
  return nextShapeState
}

/** Normalizes the morph timing options authored on a polygon action. */
function normalizeMorphOptions(morph: PolygonMorphOptions): Exclude<PolygonMorphOptions, boolean> {
  return typeof morph === 'object' && morph !== null ? morph : {}
}

export class PolygonComponent extends BaseComponent {
  private shapeNode: SVGPathElement | null = null
  private textNode: SVGTextElement | null = null
  private currentShapeState: PolygonShapeState = {}
  private authoredAttrs: Map<string, Map<string, string>> | null = null

  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.services.declare(['className', 'style', 'attr'])
  }

  /** Binds authored emit declarations once the SVG root is available. */
  init(): void {
    bindComponentEmitDeclarations({
      perso: this.perso,
      createElementOptions: this.createElementOptions,
      resolveRef: (ref) => this.resolveRef(ref),
      report: (warning) => {
        this.report(warning.code, warning.message, warning.details)
      },
    })
  }

  /** Applies one static or morphing polygon update. */
  update(input: RuntimeComponentUpdateInput): void {
    const action = input.action as PolygonAction
    this.services.apply(this.node, input.action, input.serviceContext)

    if (action.content !== undefined) {
      this.applyContent(action.content)
    }

    if (action.morph !== undefined) {
      const nextShapeState = resolveNextShapeState(this.currentShapeState, action)
      this.applyMorph(nextShapeState, action.morph, input)
      this.currentShapeState = nextShapeState
      return
    }

    if (!hasShapeKey(action)) return

    this.currentShapeState = resolveNextShapeState(this.currentShapeState, action)
    this.applyStaticShape()
  }

  /** Applies one text value in the centered SVG label. */
  private applyContent(value: unknown): void {
    if (this.textNode === null) return
    this.textNode.textContent = typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }

  /** Applies one SVG path `d` string on the internal shape node. */
  private applyPath(d: string): void {
    this.shapeNode?.setAttribute('d', d)
  }

  /** Applies the current static shape state. */
  private applyStaticShape(): void {
    this.applyPath(resolvePolygonPathString(this.currentShapeState))
  }

  /** Emits one Anime SVG morph operation for the internal shape node. */
  private applyMorph(nextShapeState: PolygonShapeState, morph: PolygonMorphOptions, input: RuntimeComponentUpdateInput): void {
    if (this.shapeNode === null) return

    const targetPath = resolvePolygonPathString(nextShapeState)
    const toNode = createSvgElement('path')
    toNode.setAttribute('d', targetPath)
    const options = normalizeMorphOptions(morph)
    const animeSvg = this.services.animeSvg

    if (animeSvg === undefined || input.serviceContext === undefined) {
      this.applyPath(targetPath)
      return
    }

    animeSvg.morphTo({
      target: this.shapeNode,
      to: toNode,
      property: 'd',
      duration: typeof options.duration === 'number' ? options.duration : DEFAULT_MORPH_DURATION_MS,
      delayMs: options.delayMs,
      ease: options.ease,
      easing: options.easing,
      precision: options.precision,
      finalValue: targetPath,
    }, input.serviceContext)
  }

  /** Captures one DOM node's authored attribute baseline under one local key. */
  private captureAuthoredAttrs(nodeRef: Element, key: string): void {
    if (this.authoredAttrs === null) {
      return
    }

    const attrs = new Map<string, string>()
    for (const attributeName of nodeRef.getAttributeNames()) {
      attrs.set(attributeName, nodeRef.getAttribute(attributeName) ?? '')
    }
    this.authoredAttrs.set(key, attrs)
  }

  /** Restores one DOM node to its captured authored baseline. */
  private restoreAuthoredAttrs(nodeRef: Element | null, key: string): void {
    if (nodeRef === null || this.authoredAttrs === null) {
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

  /** Creates the SVG root and its internal path/text nodes. */
  private createSvgRoot(): SVGSVGElement {
    const rootNode = createSvgElement('svg')
    const shapeNode = createSvgElement('path')
    const textNode = createSvgElement('text')

    rootNode.id = this.perso.id
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

    this.shapeNode = shapeNode
    this.textNode = textNode

    return rootNode
  }

  /** Builds the SVG root and restores it in place on refresh. */
  render(): ComponentRenderResult {
    const initial = this.perso.initial as PolygonInitial
    if (this.node !== null && this.authoredAttrs !== null) {
      this.restoreAuthoredAttrs(this.node as SVGSVGElement, 'root')
      this.restoreAuthoredAttrs(this.shapeNode, 'shape')
      this.restoreAuthoredAttrs(this.textNode, 'text')
      this.currentShapeState = initial
      this.applyStaticShape()
      this.applyContent(initial.content)
      this.services.apply(this.node, initial as Record<string, unknown>)
      return this.node as Node
    }

    const rootNode = this.createSvgRoot()

    this.authoredAttrs = new Map<string, Map<string, string>>()
    this.captureAuthoredAttrs(rootNode, 'root')
    this.captureAuthoredAttrs(this.shapeNode as SVGPathElement, 'shape')
    this.captureAuthoredAttrs(this.textNode as SVGTextElement, 'text')

    this.currentShapeState = initial
    this.applyStaticShape()
    this.applyContent(initial.content)
    this.services.apply(rootNode, initial as Record<string, unknown>)

    return rootNode
  }
}

import {
  BaseHTMLComponent,
  type ComponentInput,
  type ComponentUpdateInput,
  type RuntimeComponentDefinition,
  type ValidationFunction,
} from 'codplay'
import {
  isComponentRecord,
  reportInvalidComponentValue,
} from 'codplay/runtime/components/component-validation'
import {
  isStoredStroke,
  setStrokePathAreaOrigin,
  type StoredStroke,
} from './stroke-path-state'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const LIVE_PART_ID = 'stroke-path-layer:live'
const COMMITTED_PART_ID = 'stroke-path-layer:committed'
const HIT_AREA_PART_ID = 'stroke-path-layer:hit-area'

type LiveStroke = Readonly<{ d: string; color: string }>

type StrokePathLayerInitial = Record<string, unknown>

type StrokePathLayerState = Record<string, unknown> & Readonly<{
  liveStroke?: unknown
  resetLive?: unknown
  strokes?: unknown
}>

/** Component used only by the non-normative Stroke Path stress fixture. */
export class StrokePathLayerComponent extends BaseHTMLComponent<StrokePathLayerInitial> {
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  private readonly pathById = new Map<string, SVGPathElement>()
  private livePath: SVGPathElement | undefined
  private committedGroup: SVGGElement | undefined
  private areaRoot: SVGSVGElement | undefined
  private lastStrokeSnapshot = ''
  private lastStartEventKey: string | undefined
  private lastFeedbackEventKey: string | undefined
  private resizeListener: (() => void) | undefined
  private feedbackTimer: number | undefined
  private nextPathNodeId = 0

  /** Declares the services still handled by the shared HTML materializer. */
  constructor(input: ComponentInput<StrokePathLayerInitial>) {
    super(input)
    this.services.declare(StrokePathLayerComponent.declaredServices)
  }

  /** Returns the static SVG host; dynamic path children are fixture-local. */
  render(): string {
    return `
      <svg id="stroke-path-canvas" class="stroke-path-canvas" width="100%" height="100%" xmlns="${SVG_NAMESPACE}">
        <rect id="stroke-path-hit-area" data-part="${HIT_AREA_PART_ID}" class="stroke-path-canvas__hit-area" x="0" y="0" width="100%" height="100%" />
        <g id="stroke-path-committed" data-part="${COMMITTED_PART_ID}"></g>
        <path id="stroke-path-live" data-part="${LIVE_PART_ID}" d="" fill="none" stroke="#22d3ee" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `
  }

  /** Resolves stable SVG parts and installs the fixture-owned resize listener. */
  initialize(): void {
    if (!(this.node instanceof SVGSVGElement)) {
      throw new Error('Stroke Path layer did not materialize as an SVG root.')
    }
    this.areaRoot = this.node
    this.livePath = this.getPart(LIVE_PART_ID) as SVGPathElement | undefined
    this.committedGroup = this.getPart(COMMITTED_PART_ID) as SVGGElement | undefined
    if (!this.livePath || !this.committedGroup) {
      throw new Error('Stroke Path layer is missing its declared SVG parts.')
    }

    this.resizeListener = () => this.measureArea()
    globalThis.window?.addEventListener('resize', this.resizeListener)
  }

  /** Applies real runtime updates while locally reconciling the stress-test paths. */
  update(input: ComponentUpdateInput<StrokePathLayerState>): void {
    if (this.node === null) throw new Error('Stroke Path layer is not materialized.')
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })

    const startOccurrence = [...(input.activeActions ?? [])]
      .reverse()
      .find((occurrence) => occurrence.name === 'stroke:start')
    if (startOccurrence !== undefined) {
      const eventKey = startOccurrence.eventId ?? `${startOccurrence.name}:${startOccurrence.startAt}`
      if (eventKey !== this.lastStartEventKey) {
        this.lastStartEventKey = eventKey
        this.measureArea()
      }
    }

    this.updateLiveStroke(input.state.liveStroke, input.state.resetLive === true)
    this.updateCommittedStrokes(input.state.strokes)
    this.showSaveFeedback(input.activeActions)
  }

  /** Removes fixture-owned DOM children and browser callbacks at teardown. */
  destroy(): void {
    if (this.resizeListener !== undefined) {
      globalThis.window?.removeEventListener('resize', this.resizeListener)
      this.resizeListener = undefined
    }
    if (this.feedbackTimer !== undefined) {
      globalThis.window?.clearTimeout(this.feedbackTimer)
      this.feedbackTimer = undefined
    }
    this.clearStrokes()
    this.areaRoot?.classList.remove('stroke-path-canvas--saved')
    this.areaRoot = undefined
    this.livePath = undefined
    this.committedGroup = undefined
  }

  /** Measures the attached SVG root for the next pointer capture. */
  private measureArea(): void {
    const root = this.areaRoot
    if (!root?.isConnected) return
    const bounds = root.getBoundingClientRect()
    setStrokePathAreaOrigin(bounds.left, bounds.top)
  }

  /** Projects one transient capture sample onto the predeclared live path. */
  private updateLiveStroke(value: unknown, reset: boolean): void {
    const liveStroke = readLiveStroke(value)
    if (liveStroke !== undefined) {
      this.applyPath(this.livePath, liveStroke.d, liveStroke.color)
      return
    }
    if (reset || this.livePath?.getAttribute('d') !== '') {
      this.applyPath(this.livePath, '', '#22d3ee')
    }
  }

  /** Replaces committed SVG children only when the resolved snapshot changes. */
  private updateCommittedStrokes(value: unknown): void {
    const strokes = readStrokeArray(value)
    const snapshot = JSON.stringify(strokes)
    if (snapshot === this.lastStrokeSnapshot) return
    this.lastStrokeSnapshot = snapshot
    this.clearStrokes()
    for (const stroke of strokes) this.addStroke(stroke)
  }

  /** Adds or updates one committed path idempotently within this fixture. */
  private addStroke(stroke: StoredStroke): void {
    const existing = this.pathById.get(stroke.id)
    if (existing !== undefined) {
      this.applyPath(existing, stroke.d, stroke.color)
      return
    }

    const path = globalThis.document.createElementNS(SVG_NAMESPACE, 'path')
    path.id = `stroke-path-committed-${this.nextPathNodeId++}`
    this.applyPath(path, stroke.d, stroke.color)
    this.committedGroup?.appendChild(path)
    this.pathById.set(stroke.id, path)
  }

  /** Applies SVG path attributes through the existing HTML materializer services. */
  private applyPath(path: SVGPathElement | undefined, d: string, color: string): void {
    if (path === undefined) return
    this.services.apply(path, {
      attr: {
        d,
        fill: 'none',
        stroke: color,
        'stroke-width': '4',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    })
  }

  /** Removes every fixture-owned committed SVG child and its path index. */
  private clearStrokes(): void {
    const group = this.committedGroup
    for (const path of this.pathById.values()) {
      if (path.parentNode === group) group?.removeChild(path)
    }
    this.pathById.clear()
  }

  /** Flashes the border once for each committed save or clear event. */
  private showSaveFeedback(
    actions: ComponentUpdateInput['activeActions'],
  ): void {
    const occurrence = [...(actions ?? [])]
      .reverse()
      .find((candidate) => candidate.name === 'stroke:save:done')
    if (occurrence === undefined) return
    const eventKey = occurrence.eventId ?? `${occurrence.name}:${occurrence.startAt}`
    if (eventKey === this.lastFeedbackEventKey) return
    this.lastFeedbackEventKey = eventKey

    const root = this.areaRoot
    if (!root) return
    root.classList.add('stroke-path-canvas--saved')
    if (this.feedbackTimer !== undefined) globalThis.window?.clearTimeout(this.feedbackTimer)
    this.feedbackTimer = globalThis.window?.setTimeout(() => {
      root.classList.remove('stroke-path-canvas--saved')
      this.feedbackTimer = undefined
    }, 1000)
  }
}

/** Validates the empty, stable configuration of this demo-local layer. */
const validateStrokePathInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_STROKE_PATH_INITIAL_INVALID', 'Stroke Path initial state must be a plain object.')
  }
}

/** Validates action records while leaving their fixture-local payloads open. */
const validateStrokePathAction: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_STROKE_PATH_ACTION_INVALID', 'Stroke Path action must be a plain object.')
  }
}

/** Declares the non-normative component used by the V2 Stroke Path fixture. */
export const STROKE_PATH_COMPONENT_DEFINITION: RuntimeComponentDefinition = {
  type: 'stroke-path-layer',
  component: StrokePathLayerComponent,
  modules: [],
  validateInitial: validateStrokePathInitial,
  validateAction: validateStrokePathAction,
}

/** Narrows one transient live-stroke payload to the path fields used here. */
function readLiveStroke(value: unknown): LiveStroke | undefined {
  if (!isComponentRecord(value)) return undefined
  if (typeof value.d !== 'string' || typeof value.color !== 'string') return undefined
  return { d: value.d, color: value.color }
}

/** Keeps only valid SVG strokes from the story state snapshot. */
function readStrokeArray(value: unknown): readonly StoredStroke[] {
  if (!Array.isArray(value)) return []
  return value.filter(isStoredStroke)
}

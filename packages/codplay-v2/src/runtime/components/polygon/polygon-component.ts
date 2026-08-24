import { parseEase } from '../../../ace'
import { isPlainRecord } from '../../../shared'
import type { ValidationFunction } from '../../../services'
import { reportInvalidComponentValue, isComponentRecord } from '../component-validation'
import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentActionOccurrence, ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import {
  resolveMorphPathString,
  resolvePolygonPathString,
  type PolygonShapeState,
} from './polygon-geometry'
import type { PolygonInitial, PolygonMorphOptions, PolygonState } from './polygon-types'

/** Polygon part identifiers retained by the SVG materializer. */
const PART = { path: 'path', content: 'content' } as const
const DEFAULT_MORPH_DURATION_MS = 700
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/** Validates the shape and SVG-facing fields of one polygon initial payload. */
export const validatePolygonInitial: ValidationFunction = (value, context) => {
  if (!isComponentRecord(value)) {
    reportInvalidComponentValue(context, 'AUTHOR_POLYGON_INITIAL_INVALID', 'polygon initial state must be a plain object.')
    return
  }
  validatePolygonFields(value, context)
}

/** Validates one polygon action payload. */
export const validatePolygonAction: ValidationFunction = (value, context) => {
  if (!isPlainRecord(value)) return
  validatePolygonFields(value, context)
}

/** One time-addressed morph projection retained between component updates. */
type ActiveMorph = Readonly<{
  from: PolygonShapeState
  to: PolygonShapeState
  startAt: number
  duration: number
  delayMs: number
  ease: (progress: number) => number
  sampleCount?: number
  key: string
}>

/** V2 polygon component projected through an SVG-capable DOM materializer. */
export class PolygonComponent extends BaseHTMLComponent<PolygonInitial> {
  /** Last logical shape selected by the resolved state. */
  private logicalShapeState: PolygonShapeState | null = null
  /** Current deterministic morph operation, if one is active. */
  private activeMorph: ActiveMorph | null = null

  /** Creates one polygon component with root/part service bindings. */
  constructor(input: HTMLComponentInput<PolygonInitial>) {
    super(input)
  }

  /** Returns the complete SVG representation consumed by SvgComponentMaterializer. */
  render(): string {
    return `
      <svg viewBox="0 0 100 100" xmlns="${SVG_NAMESPACE}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path data-part="${PART.path}" fill="currentColor" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"></path>
        <text data-part="${PART.content}" x="50" y="50" text-anchor="middle" dominant-baseline="middle" fill="var(--polygon-label-color, currentColor)" style="pointer-events:none"></text>
      </svg>
    `
  }

  /** Applies root state, text and deterministic shape projection at absolute time. */
  update(input: ComponentUpdateInput<PolygonState>): void {
    if (this.node === null) throw new Error(`Polygon component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
    this.services.apply(this.getPart(PART.content), {
      content: isStringOrNumber(input.state.content) ? String(input.state.content) : '',
    })

    const nextShape = resolveShapeState(input.state)
    const previousShape = this.logicalShapeState ?? resolveShapeState(this.perso.initial)
    const shapeChanged = !sameShape(previousShape, nextShape)
    const morphRequest = resolveMorphRequest(input.activeActions, input.state.morph, input.timeMs)
    if (shapeChanged && morphRequest !== undefined) {
      this.activeMorph = createActiveMorph(previousShape, nextShape, morphRequest, input.timeMs)
    } else if (shapeChanged) {
      this.activeMorph = null
    } else if (this.activeMorph === null && morphRequest !== undefined) {
      this.activeMorph = createActiveMorph(previousShape, nextShape, morphRequest, input.timeMs)
    }
    this.logicalShapeState = nextShape

    const path = this.activeMorph === null
      ? resolvePolygonPathString(nextShape)
      : resolveMorphAt(this.activeMorph, input.timeMs)
    this.services.apply(this.getPart(PART.path), { attr: { d: path } })
  }
}

/** Resolves the current shape fields from a complete component state. */
function resolveShapeState(state: PolygonShapeState): PolygonShapeState {
  return {
    sides: state.sides,
    inner: state.inner,
    outer: state.outer,
    rotationDeg: state.rotationDeg,
    inflexion: state.inflexion,
  }
}

/** Finds the latest shape-changing morph occurrence or a direct morph fallback. */
function resolveMorphRequest(
  activeActions: readonly ComponentActionOccurrence[] | undefined,
  fallback: PolygonMorphOptions | undefined,
  timeMs: number,
): { options: PolygonMorphOptions; startAt: number; key: string } | undefined {
  const occurrence = [...(activeActions ?? [])]
    .reverse()
    .find((candidate) => candidate.action.morph !== undefined && hasShapeKey(candidate.action))
  if (occurrence !== undefined) {
    return {
      options: occurrence.action.morph as PolygonMorphOptions,
      startAt: occurrence.startAt,
      key: occurrence.eventId ?? `${occurrence.name}:${occurrence.startAt}`,
    }
  }
  return fallback === undefined ? undefined : { options: fallback, startAt: timeMs, key: `direct:${timeMs}` }
}

/** Creates one deterministic morph operation from an authored request. */
function createActiveMorph(
  from: PolygonShapeState,
  to: PolygonShapeState,
  request: { options: PolygonMorphOptions; startAt: number; key: string },
  timeMs: number,
): ActiveMorph {
  const options = normalizeMorphOptions(request.options)
  const duration = finiteNumber(options.duration) ?? DEFAULT_MORPH_DURATION_MS
  const delayMs = finiteNumber(options.delayMs) ?? 0
  const easeName = typeof options.ease === 'string' ? options.ease : options.easing
  return {
    from,
    to,
    startAt: request.startAt,
    duration: Math.max(0, duration),
    delayMs: Math.max(0, delayMs),
    ease: easeName === undefined ? (progress) => progress : parseEase(easeName),
    sampleCount: finiteNumber(options.sampleCount) ?? undefined,
    key: request.key || `morph:${timeMs}`,
  }
}

/** Resolves one morph path at the component's absolute logical time. */
function resolveMorphAt(morph: ActiveMorph, timeMs: number): string {
  const elapsed = timeMs - morph.startAt - morph.delayMs
  const rawProgress = morph.duration === 0 ? 1 : Math.max(0, Math.min(1, elapsed / morph.duration))
  if (rawProgress <= 0) return resolvePolygonPathString(morph.from)
  if (rawProgress >= 1) return resolvePolygonPathString(morph.to)
  return resolveMorphPathString({
    from: morph.from,
    to: morph.to,
    progress: morph.ease(rawProgress),
    sampleCount: morph.sampleCount,
  })
}

/** Checks whether an action changes at least one polygon shape field. */
function hasShapeKey(action: Record<string, unknown>): boolean {
  return action.sides !== undefined
    || action.inner !== undefined
    || action.outer !== undefined
    || action.rotationDeg !== undefined
    || action.inflexion !== undefined
}

/** Normalizes boolean and object morph forms into one options record. */
function normalizeMorphOptions(value: PolygonMorphOptions): Exclude<PolygonMorphOptions, boolean> {
  return typeof value === 'object' && value !== null ? value : {}
}

/** Compares two shape states without serializing runtime values. */
function sameShape(left: PolygonShapeState, right: PolygonShapeState): boolean {
  return sameValue(left.sides, right.sides)
    && sameValue(left.inner, right.inner)
    && sameValue(left.outer, right.outer)
    && sameValue(left.rotationDeg, right.rotationDeg)
    && sameValue(left.inflexion, right.inflexion)
}

/** Compares nested authored values used by polygon shape fields. */
function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => sameValue(value, right[index]))
  }
  return false
}

/** Validates the scalar, content and morph fields of one polygon payload. */
function validatePolygonFields(value: Record<string, unknown>, context: Parameters<ValidationFunction>[1]): void {
  if (value.content !== undefined && !isStringOrNumber(value.content)) {
    reportInvalidComponentValue(context, 'AUTHOR_POLYGON_CONTENT_INVALID', 'polygon.content must be a string or number.', 'content')
  }
  if (value.morph !== undefined && typeof value.morph !== 'boolean' && !isPlainRecord(value.morph)) {
    reportInvalidComponentValue(context, 'AUTHOR_POLYGON_MORPH_INVALID', 'polygon.morph must be a boolean or plain object.', 'morph')
  }
}

/** Checks a scalar accepted by SVG text and author content fields. */
function isStringOrNumber(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/** Converts only finite numeric morph options. */
function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

import { parseEase } from 'ace'
import { BaseHTMLComponent } from '../base-html-component'
import type { ComponentActionOccurrence, ComponentUpdateInput, HTMLComponentInput } from '../component-types'
import {
  resolveMorphPathString,
  resolvePolygonPathString,
  samePolygonShape,
} from './polygon-geometry'
import {
  hasPolygonShapeChange,
  type PolygonCompiledMorphOptions,
  type PolygonInitial,
  type PolygonShapeState,
  type PolygonState,
} from './polygon-types'

/** Polygon part identifiers retained by the HTML materializer. */
const PART = { path: 'path', content: 'content' } as const
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

/** One time-addressed morph projection retained between component updates. */
type ActiveMorph = Readonly<{
  from: PolygonShapeState
  to: PolygonShapeState
  startAt: number
  duration: number
  delayMs: number
  ease: (progress: number) => number
  sampleCount: number
  key: string
}>

/** V2 polygon component projected to SVG nodes by the HTML materializer. */
export class PolygonComponent extends BaseHTMLComponent<PolygonInitial> {
  /** Services declared by the component author, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr', 'content'] as const

  /** Last logical shape selected by the resolved state. */
  private logicalShapeState: PolygonShapeState | null = null
  /** Current deterministic morph operation, if one is active. */
  private activeMorph: ActiveMorph | null = null

  /** Creates one polygon component with root/part service bindings. */
  constructor(input: HTMLComponentInput<PolygonInitial>) {
    super(input)
    this.services.declare(PolygonComponent.declaredServices)
  }

  /** Returns the complete SVG markup consumed by the HTML materializer. */
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
      content: input.state.content === undefined ? '' : String(input.state.content),
    })

    const nextShape: PolygonShapeState = input.state
    // SceneBuilder guarantees this profile is complete before the component is created.
    const compiledInitial = this.perso.initial as unknown as PolygonShapeState
    const previousShape: PolygonShapeState = this.logicalShapeState ?? compiledInitial
    const shapeChanged = !samePolygonShape(previousShape, nextShape)
    const morphRequest = resolveMorphRequest(input.activeActions, input.state.morph, input.timeMs)
    if (shapeChanged && morphRequest !== undefined) {
      this.activeMorph = createActiveMorph(previousShape, nextShape, morphRequest)
    } else if (shapeChanged) {
      this.activeMorph = null
    } else if (this.activeMorph === null && morphRequest !== undefined) {
      this.activeMorph = createActiveMorph(previousShape, nextShape, morphRequest)
    }
    this.logicalShapeState = nextShape

    const path = this.activeMorph === null
      ? resolvePolygonPathString(nextShape)
      : resolveMorphAt(this.activeMorph, input.timeMs)
    this.services.apply(this.getPart(PART.path), { attr: { d: path } })
  }
}

/** Finds the latest shape-changing morph occurrence or a direct morph fallback. */
function resolveMorphRequest(
  activeActions: readonly ComponentActionOccurrence[] | undefined,
  fallback: PolygonCompiledMorphOptions | undefined,
  timeMs: number,
): { options: PolygonCompiledMorphOptions; startAt: number; key: string } | undefined {
  const occurrence = [...(activeActions ?? [])]
    .reverse()
    .find((candidate) => candidate.action.morph !== undefined && hasPolygonShapeChange(candidate.action))
  if (occurrence !== undefined) {
    return {
      options: occurrence.action.morph as PolygonCompiledMorphOptions,
      startAt: occurrence.startAt,
      key: occurrence.eventId ?? `${occurrence.name}:${occurrence.startAt}`,
    }
  }
  return fallback === undefined ? undefined : { options: fallback, startAt: timeMs, key: `direct:${timeMs}` }
}

/** Creates one deterministic morph operation from a compile-sanitized request. */
function createActiveMorph(
  from: PolygonShapeState,
  to: PolygonShapeState,
  request: { options: PolygonCompiledMorphOptions; startAt: number; key: string },
): ActiveMorph {
  return {
    from,
    to,
    startAt: request.startAt,
    duration: request.options.duration,
    delayMs: request.options.delayMs,
    ease: parseEase(request.options.ease),
    sampleCount: request.options.sampleCount,
    key: request.key,
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

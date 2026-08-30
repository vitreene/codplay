import { parseEase } from 'ace'
import { isPlainRecord } from '../../../shared'
import { BaseHTMLComponent } from '../base-html-component'
import type {
  ComponentActionOccurrence,
  ComponentAnimation,
  ComponentUpdateInput,
  HTMLComponentInput,
} from '../component-types'
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
const POLYGON_VALUE_PROPERTIES = new Set(['sides', 'inner', 'outer', 'inflexion', 'diameter'])

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
    const projected = resolvePolygonActionState(
      input.state as unknown as Readonly<Record<string, unknown>>,
      input.activeActions,
    )
    const state = projected.state
    const initial = this.perso.initial as unknown as Readonly<Record<string, unknown>>
    const initialShape = resolvePolygonShapeState(initial)
    const previousShape = this.logicalShapeState ?? initialShape
    const nextShape = resolvePolygonShapeState(state, previousShape)
    const diameter = resolveDiameter(state.diameter, resolveDiameter(initial.diameter, undefined))
    this.services.apply(this.node, {
      className: input.state.className,
      style: resolvePolygonStyle(input.state.style, diameter),
      attr: input.state.attr,
    })
    this.services.apply(this.getPart(PART.content), {
      content: projected.deriveSidesContent
        ? String(nextShape.sides)
        : state.content === undefined ? '' : String(state.content),
    })

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

    const pathPart = this.getPart(PART.path)
    if (input.registerAnimation !== undefined && this.activeMorph !== null) {
      const morph = this.activeMorph
      const animation: ComponentAnimation = {
        id: `polygon-morph:${morph.key}`,
        startAt: morph.startAt,
        endAt: morph.startAt + morph.delayMs + morph.duration,
        sample: (timeMs) => {
          const path = resolveMorphAt(morph, timeMs)
          return {
            value: path,
            apply: () => this.services.apply(pathPart, { attr: { d: path } }),
          }
        },
      }
      input.registerAnimation(animation)
      return
    }
    const path = this.activeMorph === null
      ? resolvePolygonPathString(nextShape)
      : resolveMorphAt(this.activeMorph, input.timeMs)
    this.services.apply(pathPart, { attr: { d: path } })
  }
}

type PolygonValueProperty = 'sides' | 'inner' | 'outer' | 'inflexion' | 'diameter'

type PolygonActionProjection = Readonly<{
  state: Readonly<Record<string, unknown>>
  deriveSidesContent: boolean
}>

/** Projects generic event values onto the polygon property named by each action. */
function resolvePolygonActionState(
  value: Readonly<Record<string, unknown>>,
  activeActions: readonly ComponentActionOccurrence[] | undefined,
): PolygonActionProjection {
  const state = { ...value }
  let deriveSidesContent = false
  for (const occurrence of activeActions ?? []) {
    const property = resolvePolygonValueProperty(occurrence.name)
    if (property === undefined || occurrence.action.value === undefined) continue
    state[property] = occurrence.action.value
    if (property !== 'sides') continue
    if (occurrence.action.content === undefined) {
      deriveSidesContent = true
    } else {
      state.content = occurrence.action.content
      deriveSidesContent = false
    }
  }
  return { state, deriveSidesContent }
}

/** Extracts one component property from the polygon semantic action name. */
function resolvePolygonValueProperty(actionName: string): PolygonValueProperty | undefined {
  const property = actionName.startsWith('polygon:') ? actionName.slice('polygon:'.length) : ''
  return POLYGON_VALUE_PROPERTIES.has(property) ? property as PolygonValueProperty : undefined
}

const DEFAULT_POLYGON_SHAPE: PolygonShapeState = {
  sides: 3,
  inner: null,
  outer: 40,
  rotationDeg: -90,
  inflexion: 0,
}

/** Resolves authored and live polygon values into the numeric shape used by geometry. */
function resolvePolygonShapeState(
  value: Readonly<Record<string, unknown>>,
  fallback: PolygonShapeState = DEFAULT_POLYGON_SHAPE,
): PolygonShapeState {
  const outer = Math.max(1, resolveNumber(value.outer, fallback.outer))
  const sides = Math.max(3, Math.round(resolveNumber(value.sides, fallback.sides)))
  const inner = resolveInner(value.inner, fallback.inner, outer)
  const rotationDeg = resolveNumber(value.rotationDeg, fallback.rotationDeg)
  const inflexion = resolveInflexion(value.inflexion, fallback.inflexion)
  return { sides, inner, outer, rotationDeg, inflexion }
}

/** Resolves one polygon numeric value while preserving the previous valid value. */
function resolveNumber(value: unknown, fallback: number): number {
  return readFiniteNumber(value) ?? fallback
}

/** Resolves the V1-compatible inner radius form, where zero means no inner radius. */
function resolveInner(value: unknown, fallback: number | null, outer: number): number | null {
  if (value === undefined || value === null) return value === null ? null : fallback
  const numeric = readFiniteNumber(value)
  if (numeric === undefined) return fallback
  const rounded = Math.round(numeric)
  return rounded <= 0 ? null : Math.min(outer, rounded)
}

/** Resolves scalar and list inflexion values without exposing raw DOM strings to geometry. */
function resolveInflexion(
  value: unknown,
  fallback: number | readonly number[],
): number | readonly number[] {
  if (value === undefined) return fallback
  if (!Array.isArray(value)) return resolveNumber(value, typeof fallback === 'number' ? fallback : 0)
  const fallbackAt = (index: number): number => typeof fallback === 'number'
    ? fallback
    : fallback[index] ?? 0
  return value.map((entry, index) => resolveNumber(entry, fallbackAt(index)))
}

/** Resolves the component-owned diameter and keeps invalid live values from reaching CSS. */
function resolveDiameter(value: unknown, fallback: number | undefined): number | undefined {
  if (value === undefined) return fallback
  const numeric = readFiniteNumber(value)
  return numeric === undefined ? fallback : Math.max(0, numeric)
}

/** Adds the component-owned width and height derived from diameter to authored styles. */
function resolvePolygonStyle(value: unknown, diameter: number | undefined): Readonly<Record<string, unknown>> | undefined {
  const style = isPlainRecord(value) ? { ...value } : {}
  if (diameter !== undefined) {
    style.width = `${diameter}px`
    style.height = `${diameter}px`
  }
  return Object.keys(style).length === 0 ? undefined : style
}

/** Reads a finite numeric value from authored numbers or live native input strings. */
function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
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

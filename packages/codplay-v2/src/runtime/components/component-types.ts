import type { RuntimePreloadResourceMetadata } from '../preload'

/** Authoring data and services supplied to one V2 component instance. */
export type ComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  perso: Readonly<{
    id: string
    storyId: string
    initial: Initial
    /** Complete compiled actions are author data required by source-backed components. */
    actions?: Readonly<Record<string, unknown>>
  }>
  /** Metadata prepared by the external preload boundary for source-backed components. */
  resourceMetadata?: ReadonlyMap<string, RuntimePreloadResourceMetadata>
}>

/** Input extension used by the current HTML/SVG component family. */
export type HTMLComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> =
  ComponentInput<Initial> & Readonly<{
    services: HTMLComponentServices
  }>

/** One internal part discovered while materializing a component template. */
export type MaterializedPart = Readonly<{
  partId: string
  nodeRef: unknown
}>

/** One state update delivered by the V2 player to a component. */
export type ComponentUpdateInput<State extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  state: State
  timeMs: number
  /** Active authored occurrences available to components with deterministic temporal behavior. */
  activeActions?: readonly ComponentActionOccurrence[]
}>

/** Minimal occurrence metadata needed by a component-specific time projection. */
export type ComponentActionOccurrence = Readonly<{
  name: string
  startAt: number
  elapsedMs: number
  action: Record<string, unknown>
  eventId?: string
}>

/** Services that project HTML/SVG properties onto materialized nodes. */
export type HTMLComponentServices = Readonly<{
  apply(node: unknown, patch: Record<string, unknown>): void
}>

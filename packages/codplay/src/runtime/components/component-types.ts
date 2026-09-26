import type {
  RuntimePreloadMediaHandle,
  RuntimePreloadResourceMetadata,
} from '../preload'
import type { RuntimeCaptureSourcePort } from '../capture'

/** One component-scoped service implementation supplied by a materializer. */
export type ComponentService = Readonly<{
  apply: (node: unknown, value: unknown) => void
}>

/**
 * Services available to one component instance.
 *
 * The component declares the names it consumes. The runtime catalog only
 * resolves those names against the selected materializer.
 */
export type ComponentServices = Readonly<{
  declare: (names: readonly string[]) => void
  get: (name: string) => ComponentService
  apply: (node: unknown, patch: Record<string, unknown>) => void
}>

/**
 * Engine-owned runtime dependencies made available to one component class.
 *
 * The component declares the library ID in its runtime definition. The
 * engine prepares that library and injects its opaque value here; components
 * never load a library or reach into a global runtime registry themselves.
 */
export type ComponentRuntimeContext = Readonly<{
  getLibrary: <Runtime = unknown>(id: string) => Runtime
}>

/** Authoring data and services supplied to one V2 component instance. */
export type ComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  services: ComponentServices
  /** Player-scoped access to compiled capture rules for a component-owned source. */
  captureSources?: RuntimeCaptureSourcePort
  /** Engine-prepared dependencies required by non-HTML component classes. */
  runtime?: ComponentRuntimeContext
  perso: Readonly<{
    id: string
    storyId: string
    initial: Initial
    /** Complete compiled actions are author data required by source-backed components. */
    actions?: Readonly<Record<string, unknown>>
  }>
  /** Metadata prepared by the external preload boundary for source-backed components. */
  resourceMetadata?: ReadonlyMap<string, RuntimePreloadResourceMetadata>
  /** Native media handoffs prepared by the external preload boundary. */
  resourceMedia?: ReadonlyMap<string, RuntimePreloadMediaHandle>
}>

/** Input extension used by the current HTML/SVG component family. */
export type HTMLComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> =
  ComponentInput<Initial>

/** One kind of author part discovered while materializing a component template. */
export type MaterializedPartKind = 'outlet' | 'anchor'

/** One internal part discovered while materializing a component template. */
export type MaterializedPart = Readonly<{
  partId: string
  nodeRef: unknown
  kind: MaterializedPartKind
}>

/** One component-owned presentation sample produced by a temporal update. */
export type ComponentAnimationFrame = Readonly<{
  value: unknown
  apply: () => void
}>

/** Orders component presentation streams within one logical frame. */
export type ComponentAnimationPresentationPhase = 'content' | 'commit'

/** One player-clocked presentation stream registered by a component update. */
export type ComponentAnimation = Readonly<{
  id: string
  startAt: number
  endAt: number
  /** Commit streams run after content streams, typically to paint the final host output. */
  presentationPhase?: ComponentAnimationPresentationPhase
  sample: (timeMs: number) => ComponentAnimationFrame | undefined
}>

/** One state update delivered by the V2 player to a component. */
export type ComponentUpdateInput<State extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  state: State
  timeMs: number
  /** Opaque target resolved from the perso's immutable relation, when available. */
  target?: unknown
  /** Active authored occurrences available to components with deterministic temporal behavior. */
  activeActions?: readonly ComponentActionOccurrence[]
  /** Registers component-owned presentation streams for this logical update. */
  registerAnimation?: (animation: ComponentAnimation) => void
}>

/** Minimal occurrence metadata needed by a component-specific time projection. */
export type ComponentActionOccurrence = Readonly<{
  name: string
  startAt: number
  elapsedMs: number
  action: Record<string, unknown>
  eventId?: string
}>

/** Compatibility name for the current HTML/SVG component family. */
export type HTMLComponentServices = ComponentServices

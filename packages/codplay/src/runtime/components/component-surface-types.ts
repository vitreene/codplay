import type { BaseComponent } from './base-component'
import type { RuntimeComponentIdentity } from '../catalog/runtime-capability-catalog'
import type { RuntimeMaterializer } from '../materializer/materializer-types'

/** Author-declared media property transition applied by the media-sync module. */
export type MediaTransition = Readonly<{
  from?: Readonly<Record<string, unknown>>
  to?: Readonly<Record<string, unknown>>
  duration?: number
}>

/** Operations a runtime module may use without depending on a media component class. */
export type MediaComponentSurface = Readonly<{
  seekTo: (mediaMs: number) => void
  play: () => void
  pause: () => void
  stopAt: (mediaMs: number) => void
  getCurrentTimeMs: () => number
  getDurationMs: () => number | null
  isPaused: () => boolean
  setPlaybackWindow?: (startMs: number, endMs: number | null) => void
  applyTransition?: (transition: MediaTransition, progress: number) => void
  setRate?: (rate: number) => void
}>

/** Presentation-only value surface exposed by a mounted input component. */
export type InputComponentSurface = Readonly<{
  /** Projects one live scalar value without changing the logical scene state. */
  setValue: (value: string | number) => void
}>

/** Named presentation profiles supported by the shared replace capability. */
export type ReplaceTransition = 'fade' | 'fade-in'

/** Attaches and detaches opaque foreign roots inside one materialized host. */
export type ForeignContentSurface = Readonly<{
  attach: (roots: readonly unknown[], referenceRoot?: unknown) => void
  detach: () => void
}>

/** One temporary presentation session used by the shared replace capability. */
export type ReplacePresentationSession = Readonly<{
  /** Creates the incoming transient representation after the logical update. */
  start: () => void
  /** Applies one normalized progress to the outgoing and incoming snapshots. */
  sample: (progress: number) => void
  /** Removes both snapshots and reveals the updated persistent root. */
  finish: () => void
  /** Removes both snapshots and restores the root when the transition is cancelled. */
  cancel: () => void
}>

/** Presentation-only surface; it never owns or controls foreign resources. */
export type ReplaceComponentSurface = Readonly<{
  /** Captures the current host representation before a component update. */
  begin: (transition?: ReplaceTransition) => ReplacePresentationSession | undefined
}>

/** Type map of substrate-neutral surfaces, extensible by future runtime families. */
export interface RuntimeComponentSurfaceMap {
  readonly media: MediaComponentSurface
  readonly input: InputComponentSurface
  readonly foreignContent: ForeignContentSurface
  readonly replace: ReplaceComponentSurface
}

/** Module-facing component surface identifier retained for resolver compatibility. */
export type RuntimeComponentSurfaceId = 'media'

/** All surfaces that can be published by a component/materializer boundary. */
export type RuntimeComponentSurfaceKey = keyof RuntimeComponentSurfaceMap

/** Publishes typed operations exposed by one component instance and materializer. */
export type RuntimeComponentSurfaceProvider = (
  component: BaseComponent<Record<string, unknown>>,
  identity?: RuntimeComponentIdentity,
  materializer?: RuntimeMaterializer,
) => Partial<RuntimeComponentSurfaceMap>

/** Resolves typed operations for one player-local mounted component. */
export type RuntimeComponentSurfaceResolver = Readonly<{
  getSurface: <SurfaceId extends RuntimeComponentSurfaceId>(
    runtimeItemId: string,
    surfaceId: SurfaceId,
  ) => RuntimeComponentSurfaceMap[SurfaceId] | undefined
  /** Resolves the live value surface of a mounted input component. */
  getInputSurface?: (runtimeItemId: string) => InputComponentSurface | undefined
  /** Resolves the foreign-content attachment surface without widening media modules. */
  getForeignContentSurface?: (runtimeItemId: string) => ForeignContentSurface | undefined
  /** Resolves the presentation-only surface used by the shared replace module. */
  getReplaceSurface?: (runtimeItemId: string) => ReplaceComponentSurface | undefined
}>

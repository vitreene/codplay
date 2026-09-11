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

/** Attaches and detaches opaque foreign roots inside one materialized host. */
export type ForeignContentSurface = Readonly<{
  attach: (roots: readonly unknown[], referenceRoot?: unknown) => void
  detach: () => void
}>

/** One temporary presentation session used by the shared replace capability. */
export type ReplacePresentationSession = Readonly<{
  /** Makes the persistent root visible as the incoming representation. */
  start: () => void
  /** Applies one normalized fade progress to the outgoing snapshot and root. */
  sample: (progress: number) => void
  /** Removes the snapshot and restores the incoming root after completion. */
  finish: () => void
  /** Removes the snapshot and restores the root when the transition is cancelled. */
  cancel: () => void
}>

/** Presentation-only surface; it never owns or controls foreign resources. */
export type ReplaceComponentSurface = Readonly<{
  /** Captures the current host representation before a component update. */
  begin: () => ReplacePresentationSession | undefined
}>

/** Type map of substrate-neutral surfaces, extensible by future runtime families. */
export interface RuntimeComponentSurfaceMap {
  readonly media: MediaComponentSurface
  readonly foreignContent: ForeignContentSurface
  readonly replace: ReplaceComponentSurface
}

/** Existing module-facing surface identifier retained for resolver compatibility. */
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
  /** Resolves the foreign-content attachment surface without widening media modules. */
  getForeignContentSurface?: (runtimeItemId: string) => ForeignContentSurface | undefined
  /** Resolves the presentation-only surface used by the shared replace module. */
  getReplaceSurface?: (runtimeItemId: string) => ReplaceComponentSurface | undefined
}>

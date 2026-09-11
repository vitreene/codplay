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

/** Type map of substrate-neutral surfaces, extensible by future runtime families. */
export interface RuntimeComponentSurfaceMap {
  readonly media: MediaComponentSurface
  readonly foreignContent: ForeignContentSurface
}

/** Existing module-facing surface identifier retained for resolver compatibility. */
export type RuntimeComponentSurfaceId = 'media'

/** All surfaces that can be requested by an internal CodPlay adapter. */
export type RuntimeComponentSurfaceKey = keyof RuntimeComponentSurfaceMap

/** Adapts one component instance to the surfaces declared by its runtime type. */
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
}>

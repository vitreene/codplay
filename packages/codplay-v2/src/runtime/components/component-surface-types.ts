import type { BaseComponent } from './base-component'

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

/** Type map of substrate-neutral surfaces, extensible by future runtime families. */
export interface RuntimeComponentSurfaceMap {
  readonly media: MediaComponentSurface
}

/** Surface identifiers accepted by the player-local resolver. */
export type RuntimeComponentSurfaceId = keyof RuntimeComponentSurfaceMap

/** Adapts one component instance to the surfaces declared by its runtime type. */
export type RuntimeComponentSurfaceProvider = (
  component: BaseComponent<Record<string, unknown>>,
) => Partial<RuntimeComponentSurfaceMap>

/** Resolves typed operations for one player-local mounted component. */
export type RuntimeComponentSurfaceResolver = Readonly<{
  getSurface: <SurfaceId extends RuntimeComponentSurfaceId>(
    runtimeItemId: string,
    surfaceId: SurfaceId,
  ) => RuntimeComponentSurfaceMap[SurfaceId] | undefined
}>

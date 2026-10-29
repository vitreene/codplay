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
  /** Reports which persistent native media kind currently owns the component root. */
  getMediaTag?: () => 'audio' | 'video' | undefined
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

/** Simple transition profiles retained by the image replacement module. */
export type ReplaceTransition = 'fade' | 'fade-in'

/** Mask shapes available to the slot-only presentation profiles. */
export type SlotReplaceShape = 'circle' | 'star' | 'diamond' | Readonly<{
  path: string
  viewBox: string
}>

/** Presentation profiles that operate on one slot rectangle and its two views. */
export type SlotReplaceTransition = ReplaceTransition
  | 'mask-reveal'
  | 'curtain'
  | 'wipe'
  | 'slide-over'
  | 'stack'

/** Named propagation patterns supported by a replace cell grid. */
export type ReplaceStaggerPattern = 'manhattan' | 'row-wave' | 'column-wave'

/** Shared cell-grid settings for repeated SVG masks. */
export type ReplaceCellGridSettings = Readonly<{
  stagger?: number
  staggerPattern?: ReplaceStaggerPattern
  direction?: 'left' | 'right' | 'top' | 'bottom' | 'left-top' | 'right-top' | 'left-bottom' | 'right-bottom' | 'center' | 'edges'
  /** Responsive repeated-mask size, as a percentage of the presentation width. */
  cellSize?: number
  cellX?: number
  cellY?: number
}>

/** Normalized profile passed to the HTML slot presentation surface. */
export type SlotReplaceProfile = Readonly<{
  transition: SlotReplaceTransition
  duration?: number
  shape?: SlotReplaceShape
  /** Legacy text split values remain inert; `cells` activates the shared SVG grid. */
  split?: 'letter' | 'word' | 'line' | 'cells'
}> & ReplaceCellGridSettings

/** Media-only CSS profile that can also be propagated across a fixed cell grid. */
export type ReplaceMediaPresentationProfile = SlotReplaceProfile & Readonly<{
  split?: 'cells'
  /** Requests fixed image/video frames inside presentation snapshots. */
  freezeMedia: true
}>

/** Numeric temporary poses compiled from one JSON replace preset definition. */
export type ReplaceMotionProperties = Readonly<Record<string, Readonly<{
  from?: number
  to: number
}>>>

/** Complete per-view trajectory passed to a component's presentation surface. */
export type ReplaceMotionProfile = Readonly<{
  transition: string
  shape?: SlotReplaceShape
  duration: number
  ease?: string
  intro: ReplaceMotionProperties
  outro: ReplaceMotionProperties
  mode: 'intro' | 'outro' | 'replace'
  split?: 'letter' | 'word' | 'line' | 'cells'
  skipUnchanged?: boolean
  slot?: Readonly<{ axis: 'up' | 'down'; bounce?: number; chroma?: boolean }>
  freezeMedia?: boolean
}> & ReplaceCellGridSettings

/** Attaches and detaches opaque foreign roots inside one materialized host. */
export type ForeignContentSurface = Readonly<{
  attach: (roots: readonly unknown[], referenceRoot?: unknown) => void
  detach: () => void
}>

/** One temporary presentation session used by the shared replace capability. */
export type ReplacePresentationSession = Readonly<{
  /** Creates the incoming transient representation after the logical update. */
  start: () => void
  /** Reports whether a media-backed presentation started or finished synchronously. */
  tryStart?: () => boolean
  /** Waits for the current image/video frame without changing the persistent media node. */
  waitForIncomingFrame?: (onReady: (state: 'ready' | 'error') => void) => () => void
  /** Applies one normalized progress to the outgoing and incoming snapshots. */
  sample: (progress: number) => void
  /** Removes both snapshots and reveals the updated persistent root. */
  finish: () => void
  /** Removes both snapshots and restores the root when the transition is cancelled. */
  cancel: () => void
  /** Returns the duration after layout dependent split units are measured. */
  getDuration?: () => number
  /** Recomputes split geometry after resize without restarting the session. */
  reflow?: () => void
  /** Captures the current visible presentation as a detached starting view. */
  captureCurrent?: () => unknown
}>

/** Presentation-only surface; it never owns or controls foreign resources. */
export type ReplaceComponentSurface = Readonly<{
  /** Captures the current host representation before a component update. */
  begin: (
    profile?: ReplaceTransition | SlotReplaceProfile | ReplaceMediaPresentationProfile | ReplaceMotionProfile,
    sourceSnapshot?: unknown,
  ) => ReplacePresentationSession | undefined
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

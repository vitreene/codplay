import type { Path } from '../../ace'
import type { DiagnosticOutput, DiagnosticReport } from '../../diagnostics'

/** Affine matrix supplied by the host HTML pose implementation. */
export type HtmlMatrix = Readonly<{
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}>

/** Numeric HTML pose captured by the host container. */
export type HtmlPose = Readonly<{
  rect: Readonly<{ left: number; top: number; width: number; height: number }>
  /** World-space origin of the captured local box before its linear matrix. */
  origin: Readonly<{ x: number; y: number }>
  matrix: HtmlMatrix
  parentMatrix: HtmlMatrix
  /** Immediate-parent layout offset, when the pose comes from a live HTML node. */
  layoutOffset?: Readonly<{ x: number; y: number }>
  rotationMatrix: HtmlMatrix
  scaleX: number
  scaleY: number
  localWidth: number
  localHeight: number
  frameWidth: number
  frameHeight: number
}>

/** FLIP strategy selected by an HTML consumer. */
export type HtmlFlipMode = 'local' | 'overlay-world'

/** Ancestor regime used by the hierarchical pose resolver. */
export type FlipAncestorRegime = 'stable' | 'composited' | 'layout'

/** One item supplied by a FLIP consumer for one shared transaction. */
export type FlipEntry = Readonly<{
  itemId: string
  ancestorIds: readonly string[]
  mode?: HtmlFlipMode
  path?: Path
}>

/** One ancestor supplied by the host hierarchy for one FLIP transaction. */
export type FlipAncestorEntry = Readonly<{
  ancestorId: string
  parentId?: string
  regime: FlipAncestorRegime
}>

/** Generic mutation request submitted by an HTML consumer. */
export type FlipCaptureRequest = Readonly<{
  captureId: string
  hostContextId: string
  projectionEpoch: number
  startAt: number
  duration: number
  ease?: string
  entries: readonly FlipEntry[]
  ancestors?: readonly FlipAncestorEntry[]
  mutate: () => void
}>

/** Stable schedule identity supplied when a historical capture is requested. */
export type FlipCaptureDescriptor = Readonly<{
  captureId: string
  startAt: number
  endAt: number
}>

/** DOM-free result of one synchronous HTML FIRST/LAST presentation transaction. */
export type HtmlMeasurementTree = Readonly<{
  hostContextId: string
  projectionEpoch: number
  logicalTimeMs: number
  items: readonly Readonly<{
    itemId: string
    ancestorIds: readonly string[]
    mode: HtmlFlipMode
    first: HtmlPose
    last: HtmlPose
    path?: Path
  }>[]
  ancestors: readonly Readonly<{
    ancestorId: string
    parentId?: string
    regime: FlipAncestorRegime
    first: HtmlPose
    last: HtmlPose
  }>[]
}>

/** Timing and identity metadata attached to a measured transaction. */
export type FlipCaptureMetadata = Readonly<{
  captureId: string
  startAt: number
  duration: number
  ease?: string
}>

/** One persisted item capture with no host handle or DOM reference. */
export type FlipItemCapture = Readonly<{
  itemId: string
  ancestorIds: readonly string[]
  mode: HtmlFlipMode
  startAt: number
  endAt: number
  duration: number
  ease: string
  from: HtmlPose
  to: HtmlPose
  path?: Path
}>

/** One persisted ancestor capture used by the pose graph. */
export type FlipAncestorCapture = Readonly<{
  ancestorId: string
  parentId?: string
  regime: FlipAncestorRegime
  from: HtmlPose
  to: HtmlPose
}>

/** Persist-only FLIP capture readable by exact seek. */
export type FlipCapture = Readonly<{
  captureId: string
  hostContextId: string
  projectionEpoch: number
  startAt: number
  endAt: number
  duration: number
  ease: string
  entries: readonly FlipItemCapture[]
  ancestors: readonly FlipAncestorCapture[]
}>

/** Consumer-owned cold-seek hook that realizes an existing capture identity. */
export type FlipCaptureResolver = (input: Readonly<{
  hostContextId: string
  projectionEpoch: number
  timeMs: number
  captures: readonly FlipCaptureDescriptor[]
}>) => FlipCapture | readonly FlipCapture[] | undefined

/** Result returned by a public HTML FLIP runtime operation. */
export type FlipOperationResult<T> = Readonly<
  | { ok: true; value: T; diagnostics: DiagnosticReport }
  | { ok: false; diagnostics: DiagnosticReport }
>

/** Application-owned diagnostic output for the HTML FLIP boundary. */
export type HtmlFlipRuntimeOptions = Readonly<{
  diagnosticOutput?: DiagnosticOutput
  getActiveCaptureDescriptors?: (timeMs: number) => readonly FlipCaptureDescriptor[]
}>

/** A pose resolved for one item at one timeline instant. */
export type ResolvedFlipPose = Readonly<{
  itemId: string
  mode: HtmlFlipMode
  pose: HtmlPose
  progress: number
  captureId: string
}>

/** Exact host operations required by the HTML FLIP runtime. */
export type HtmlFlipProjection = Readonly<{
  getHostContextId: () => string
  getProjectionEpoch: () => number
  resolveHandle: (itemId: string) => unknown
  capturePose: (handle: unknown) => HtmlPose
  captureOverlayPose?: (handle: unknown) => HtmlPose
  /**
   * Realizes one ancestor at a historical instant, captures its pose, and
   * restores the host's current state before returning.
   */
  captureHistoricalPose: (input: Readonly<{
    ancestorId: string
    timeMs: number
    capture: FlipAncestorCapture
  }>) => HtmlPose
  applyLocalPose: (handle: unknown, pose: ResolvedFlipPose) => void
  finishLocalPose: (handle: unknown, captureId: string) => void
  cancelLocalPose: (handle: unknown, captureId: string) => void
  beginOverlay: (handle: unknown, first: HtmlPose, last: HtmlPose) => unknown
  /** Removes one independently projected descendant from active parent ghosts. */
  excludeOverlayItem?: (itemId: string) => void
  /** Restores one descendant clone after its independent overlay ends. */
  restoreOverlayItem?: (itemId: string) => void
  applyOverlayPose: (overlayHandle: unknown, pose: ResolvedFlipPose) => void
  finishOverlay: (overlayHandle: unknown) => void
  flush: () => void
}>

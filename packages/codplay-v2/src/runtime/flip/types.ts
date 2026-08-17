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
  matrix: HtmlMatrix
  parentMatrix: HtmlMatrix
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
  easing?: string
  entries: readonly FlipEntry[]
  ancestors?: readonly FlipAncestorEntry[]
  mutate: () => void
}>

/** One persisted item capture with no host handle or DOM reference. */
export type FlipItemCapture = Readonly<{
  itemId: string
  ancestorIds: readonly string[]
  mode: HtmlFlipMode
  startAt: number
  endAt: number
  duration: number
  easing: string
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
  easing: string
  entries: readonly FlipItemCapture[]
  ancestors: readonly FlipAncestorCapture[]
}>

/** Consumer-owned cold-seek hook that realizes an existing capture identity. */
export type FlipCaptureResolver = (input: Readonly<{
  hostContextId: string
  projectionEpoch: number
  timeMs: number
}>) => FlipCapture | undefined

/** Result returned by a public HTML FLIP runtime operation. */
export type FlipOperationResult<T> = Readonly<
  | { ok: true; value: T; diagnostics: DiagnosticReport }
  | { ok: false; diagnostics: DiagnosticReport }
>

/** Application-owned diagnostic output for the HTML FLIP boundary. */
export type HtmlFlipRuntimeOptions = Readonly<{
  diagnosticOutput?: DiagnosticOutput
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
  captureHistoricalPose?: (input: Readonly<{
    ancestorId: string
    timeMs: number
    capture: FlipAncestorCapture
  }>) => HtmlPose
  applyLocalPose: (handle: unknown, pose: ResolvedFlipPose) => void
  finishLocalPose: (handle: unknown, captureId: string) => void
  cancelLocalPose: (handle: unknown, captureId: string) => void
  beginOverlay: (handle: unknown, first: HtmlPose, last: HtmlPose) => unknown
  applyOverlayPose: (overlayHandle: unknown, pose: ResolvedFlipPose) => void
  finishOverlay: (overlayHandle: unknown) => void
  flush: () => void
}>

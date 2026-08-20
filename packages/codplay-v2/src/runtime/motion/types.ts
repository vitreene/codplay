import type { Path } from '../../ace'
import type { HtmlMatrix, HtmlPose } from './html-types'

/** Host presentation selected after one structural movement is classified. */
export type MotionPresentationMode = 'local' | 'reparent'

/** One pose expressed in the affine coordinate system of an attachment parent. */
export type RelativeMotionPose = Readonly<{
  origin: readonly [number, number]
  matrix: HtmlMatrix
  width: number
  height: number
}>

/** One measured item in a complete immutable layout snapshot. */
export type LayoutItemSnapshot = Readonly<{
  itemId: string
  parentItemId?: string
  targetId: string
  localPose: RelativeMotionPose
  rootPose: HtmlPose
}>

/** Complete layout state measured without transient movement presentations. */
export type LayoutSnapshot = Readonly<{
  timeMs: number
  revision: string
  items: ReadonlyMap<string, LayoutItemSnapshot>
}>

/** One direct movement intent declared at a structural boundary. */
export type MotionIntent = Readonly<{
  id: string
  itemId: string
  startAt: number
  duration: number
  ease: string
  presentationMode: MotionPresentationMode
  path?: Path
}>

/** The before/after layout pair caused directly by one event boundary. */
export type MotionBoundary = Readonly<{
  id: string
  timeMs: number
  before: LayoutSnapshot
  after: LayoutSnapshot
  intents: readonly MotionIntent[]
}>

/** One source or destination relation retained by an item segment. */
export type MotionAttachment = Readonly<{
  parentItemId?: string
  targetId: string
  localPose: RelativeMotionPose
  /** Root-relative fallback used only if the historical parent is unavailable. */
  fallbackRootPose: RelativeMotionPose
}>

/** One destination retarget applied at an exact boundary without restarting phase. */
export type MotionRetarget = Readonly<{
  at: number
  from: MotionAttachment
  to: MotionAttachment
}>

/** One sovereign temporal segment belonging to exactly one item. */
export type MotionSegment = Readonly<{
  id: string
  itemId: string
  startAt: number
  endAt: number
  duration: number
  ease: string
  presentationMode: MotionPresentationMode
  path?: Path
  direct: boolean
  from: MotionAttachment
  to: MotionAttachment
  retargets?: readonly MotionRetarget[]
  boundaryId: string
}>

/** Complete ordered placement trajectory of one item. */
export type ItemMotionTrack = Readonly<{
  itemId: string
  segments: readonly MotionSegment[]
}>

/** Immutable timeline graph resolved identically by Play and Seek. */
export type MotionGraph = Readonly<{
  revision: string
  tracksByItem: ReadonlyMap<string, ItemMotionTrack>
}>

/** One fully resolved item representation at one logical time. */
export type ItemPresentation = Readonly<{
  itemId: string
  parentItemId?: string
  pose: HtmlPose
  representation: 'source' | MotionPresentationMode
  activeSegmentId?: string
  progress: number
}>

/** Complete visual output consumed atomically by one presentation host. */
export type PresentationFrame = Readonly<{
  timeMs: number
  graphRevision: string
  layoutRevision: string
  items: ReadonlyMap<string, ItemPresentation>
}>

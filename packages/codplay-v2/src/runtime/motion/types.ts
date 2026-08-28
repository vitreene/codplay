import type { Path, Tween } from '../../ace'
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
  /** Zero-based order in the solved placement graph for this target. */
  targetOrder: number
  localPose: RelativeMotionPose
  rootPose: HtmlPose
}>

/** Complete layout state measured without transient movement presentations. */
export type LayoutSnapshot = Readonly<{
  timeMs: number
  revision: string
  items: ReadonlyMap<string, LayoutItemSnapshot>
  /** Root pose captured with the same transaction, when the host exposes one. */
  rootPose?: HtmlPose
}>

/** One direct movement intent declared at a structural boundary. */
export type MotionIntent = Readonly<{
  id: string
  itemId: string
  startAt: number
  duration: number
  delay?: number
  ease: string
  presentationMode: MotionPresentationMode
  path?: Path
  /** Whether this intent changes the target layout and may reflow its siblings. */
  targetReflow?: boolean
}>

/** The before/after geometry retained for one event transition. */
export type MotionBoundary = Readonly<{
  id: string
  timeMs: number
  before: LayoutSnapshot
  /** Natural layout immediately after the boundary, before later eventimes. */
  afterStart?: LayoutSnapshot
  /** Natural layout at the transition endpoint, including active ancestors. */
  after: LayoutSnapshot
  intents: readonly MotionIntent[]
}>

/** One source or destination relation retained by an item segment. */
export type MotionAttachment = Readonly<{
  parentItemId?: string
  targetId: string
  /** Structural sibling order carried with the attachment. */
  targetOrder: number
  localPose: RelativeMotionPose
  /** Root-relative fallback used only if the historical parent is unavailable. */
  fallbackRootPose: RelativeMotionPose
  /** FIRST/LAST item and ancestor poses captured for this attachment. */
  context?: ReadonlyMap<string, LayoutItemSnapshot>
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
  delay: number
  ease: string
  presentationMode: MotionPresentationMode
  path?: Path
  /** The segment owns a structural destination and must use its LAST pose. */
  targetReflow: boolean
  direct: boolean
  from: MotionAttachment
  to: MotionAttachment
  /** ACE easing prepared once when the graph is built, never during RAF. */
  tween: Tween
  /**
   * The component/materializer already writes this pose into its source node.
   * The graph still exposes it for descendant composition, but the HTML host
   * must not apply a second local presentation transform to the same item.
   */
  materializerOwned: boolean
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
  /** Prepared sovereign trajectory owners; unrelated layout items are never visited per frame. */
  presentationItemIds: readonly string[]
}>

/**
 * Structural data used only to order independent reparent overlays.
 *
 * The natural parent remains the geometry parent of the presented item. A
 * reparented item is instead anchored at its destination for comparisons with
 * unrelated overlays, while both endpoint parents must stay below it.
 */
export type OverlayStackingContext = Readonly<{
  sourceParentItemId?: string
  targetParentItemId?: string
  /** Complete FIRST ancestry, nearest endpoint parent first. */
  sourceAncestorItemIds: readonly string[]
  /** Complete LAST ancestry, nearest endpoint parent first. */
  targetAncestorItemIds: readonly string[]
  targetId: string
  targetOrder: number
}>

/** One fully resolved item representation at one logical time. */
export type ItemPresentation = Readonly<{
  itemId: string
  parentItemId?: string
  targetId: string
  /** Structural sibling order of the item's natural geometry relation. */
  targetOrder: number
  /** Extra endpoint relation used by the reparent overlay stacking graph. */
  overlayStacking?: OverlayStackingContext
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
  /** Only items with a trajectory requiring a materializer presentation. */
  items: ReadonlyMap<string, ItemPresentation>
}>

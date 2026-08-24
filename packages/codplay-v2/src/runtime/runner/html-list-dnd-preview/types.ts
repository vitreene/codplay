import type { RuntimeCaptureSample, RuntimeCaptureState } from '../../capture'
import type { HtmlTransientRect } from '../html-transient-flip'

/** Resolves one mounted HTML perso root owned by the runner. */
export type HtmlListDndNodeResolver = (persoKey: string) => unknown

/** Resolves the canonical child order exposed by one mounted list target. */
export type HtmlListDndListItemResolver = (
  storyId: string,
  listId: string,
) => readonly unknown[] | undefined

/** Dependencies needed by the HTML list preview, without exposing runner internals. */
export type HtmlListDndPreviewOptions = Readonly<{
  resolveNode: HtmlListDndNodeResolver
  resolveListNode: (storyId: string, listId: string) => unknown
  resolveListItemNodes?: HtmlListDndListItemResolver
  resolveAuthorId?: (persoKey: string) => string
  ghostClassName?: string
}>

/** Logical list slot used by the temporary drag preview. */
export type DropTarget = Readonly<{
  listId: string
  index: number
}>

/** Drop target enriched with the measured sibling set used by FLIP. */
export type ResolvedDropTarget = DropTarget & Readonly<{
  children: readonly HTMLElement[]
  childrenRects: ReadonlyMap<HTMLElement, HtmlTransientRect>
}>

/** Rectangle expressed in one list's local coordinate system. */
export type LocalBox = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

/** Mutable resources for one active pointer preview. */
export type ActivePreview = {
  captureId?: string
  origin?: DropTarget
  target?: ResolvedDropTarget
  targetResolved?: boolean
  ghost?: HTMLElement
  sourceList?: HTMLElement
  sourceIndex?: number
  sourceRectsBeforeFloat?: ReadonlyMap<HTMLElement, HtmlTransientRect>
  flipCleanups?: Map<HTMLElement, () => void>
  lastClientX?: number
  lastClientY?: number
  offsetX?: number
  offsetY?: number
  width?: number
  height?: number
}

/** Identifies the geometry inputs consumed by one target resolution. */
export type DndPointerSample = Readonly<{
  sample: RuntimeCaptureSample
  captureState: RuntimeCaptureState
}>

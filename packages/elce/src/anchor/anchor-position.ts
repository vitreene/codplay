import { ANCHOR, DEFAULT_PRESET_ID, STATISTICAL_GRAPH_LAYOUT_IDS, STATISTICAL_GRAPH_RENDERING } from '../config/document-config'
import type { StatisticalGraphContent } from '../domain/statistical-graph/statistical-graph-types'

/** Returns the CSS anchor name shared by one Elcé insertion point and its bdc. */
export function anchorNameFor(partId: string): string {
  const normalized = partId.replace(/[^a-zA-Z0-9_-]/g, '-')
  return `--anchor-${normalized || 'point'}`
}

/** Adds the configured bdc top margin to the flow reservation without measuring the DOM. */
export function anchorReservationFor(paddingBottom: string): string {
  return `calc(${paddingBottom} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`
}

/** Reserves the natural insertion line, the media and both margins in the editor. */
export function anchorEditorReservationFor(paddingBottom: string, layoutId: string = DEFAULT_PRESET_ID.PHOTO): string {
  return `calc(${anchorIllustrationBlockSizeFor(layoutId, paddingBottom)} + ${ANCHOR.EDITOR_LINE_BLOCK_SIZE} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP} + ${ANCHOR.DEFAULT_BDC_MARGIN_BOTTOM})`
}

/** Positions the edited bdc below the complete insertion line and its top margin. */
export function anchorEditorBlockPositionFor(): string {
  return `calc(anchor(top) + ${ANCHOR.EDITOR_LINE_BLOCK_SIZE} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`
}

/** Reserves the media height and both visual margins after its text line. */
export function anchorFlowBlockSizeFor(paddingBottom: string, layoutId: string = DEFAULT_PRESET_ID.PHOTO): string {
  return `calc(${anchorIllustrationBlockSizeFor(layoutId, paddingBottom)} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP} + ${ANCHOR.DEFAULT_BDC_MARGIN_BOTTOM})`
}

/** Uses the reserved illustration ratio for Photos and Graphs, and a fixed size for text Cards. */
export function anchorIllustrationBlockSizeFor(layoutId: string, paddingBottom: string): string {
  return layoutId === DEFAULT_PRESET_ID.PHOTO || STATISTICAL_GRAPH_LAYOUT_IDS.includes(layoutId as typeof STATISTICAL_GRAPH_LAYOUT_IDS[number])
    ? paddingBottom
    : ANCHOR.TEXT_CARD_BLOCK_SIZE
}

/** Matches a Graph anchor reservation to its authored rendering mode. */
export function statisticalGraphAnchorPaddingBottom(rendering: StatisticalGraphContent['rendering']): string {
  return rendering === STATISTICAL_GRAPH_RENDERING.TABLE ? '100%' : '56.25%'
}

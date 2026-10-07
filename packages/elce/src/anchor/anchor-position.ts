import { ANCHOR, DEFAULT_PRESET_ID } from '../config/document-config'

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
  return `calc(${anchorCardBlockSizeFor(layoutId, paddingBottom)} + ${ANCHOR.EDITOR_LINE_BLOCK_SIZE} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP} + ${ANCHOR.DEFAULT_BDC_MARGIN_BOTTOM})`
}

/** Positions the edited bdc below the complete insertion line and its top margin. */
export function anchorEditorBlockPositionFor(): string {
  return `calc(anchor(top) + ${ANCHOR.EDITOR_LINE_BLOCK_SIZE} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`
}

/** Reserves the media height and both visual margins after its text line. */
export function anchorFlowBlockSizeFor(paddingBottom: string, layoutId: string = DEFAULT_PRESET_ID.PHOTO): string {
  return `calc(${anchorCardBlockSizeFor(layoutId, paddingBottom)} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP} + ${ANCHOR.DEFAULT_BDC_MARGIN_BOTTOM})`
}

/** Uses a media ratio for Photo and the configured fixed block size for text layouts. */
export function anchorCardBlockSizeFor(layoutId: string, paddingBottom: string): string {
  return layoutId === DEFAULT_PRESET_ID.PHOTO ? paddingBottom : ANCHOR.TEXT_CARD_BLOCK_SIZE
}

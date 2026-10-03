import { ANCHOR } from '../config/document-config'

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
export function anchorEditorReservationFor(paddingBottom: string): string {
  return `calc(${paddingBottom} + ${ANCHOR.EDITOR_LINE_BLOCK_SIZE} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP} + ${ANCHOR.DEFAULT_BDC_MARGIN_BOTTOM})`
}

/** Positions the edited bdc below the complete insertion line and its top margin. */
export function anchorEditorBlockPositionFor(): string {
  return `calc(anchor(top) + ${ANCHOR.EDITOR_LINE_BLOCK_SIZE} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`
}

/** Reserves the media height and both visual margins after its text line. */
export function anchorFlowBlockSizeFor(paddingBottom: string): string {
  return `calc(${paddingBottom} + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP} + ${ANCHOR.DEFAULT_BDC_MARGIN_BOTTOM})`
}

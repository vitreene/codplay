import type { EditorPanelName, EditorPanelVisibility } from './editor-frame'

export type EditorResponsivePanel = EditorPanelName | null

/** Returns the shared default panel visibility for the current editor width. */
export function initialEditorPanelVisibility(width: number): EditorPanelVisibility {
  if (width <= 800) return { outline: false, properties: false }
  if (width <= 1200) return { outline: true, properties: false }
  return { outline: true, properties: true }
}

/** Resolves the visible panel from the exclusive narrow-screen panel state. */
export function editorPanelVisibilityFromResponsiveState(
  panel: EditorResponsivePanel,
  width: number,
): EditorPanelVisibility {
  if (width <= 800) return { outline: panel === 'outline', properties: panel === 'properties' }
  if (width <= 1200) return { outline: true, properties: panel === 'properties' }
  return { outline: true, properties: true }
}

/** Applies the shared panel defaults when the viewport crosses a breakpoint. */
export function resizedEditorPanelVisibility(
  current: EditorPanelVisibility,
  previousWidth: number,
  nextWidth: number,
): EditorPanelVisibility {
  const previousBand = viewportBand(previousWidth)
  const nextBand = viewportBand(nextWidth)
  if (previousBand === nextBand) return current
  if (nextBand === 'narrow') return { outline: false, properties: false }
  if (nextBand === 'medium') {
    return previousBand === 'narrow'
      ? { outline: true, properties: false }
      : { ...current, properties: false }
  }
  return previousBand === 'narrow'
    ? { outline: true, properties: true }
    : { ...current, properties: true }
}

/** Groups editor widths by the shared panel breakpoints. */
function viewportBand(width: number): 'narrow' | 'medium' | 'wide' {
  if (width <= 800) return 'narrow'
  if (width <= 1200) return 'medium'
  return 'wide'
}

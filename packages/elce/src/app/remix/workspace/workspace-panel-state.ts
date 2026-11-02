import type { ResponsivePanel, WorkspacePanelVisibility } from './editor-workspace-types'

/** Returns the default panel visibility for the current editor width. */
export function initialWorkspacePanelVisibility(width: number): WorkspacePanelVisibility {
  if (width <= 800) return { outline: false, properties: false }
  if (width <= 1200) return { outline: true, properties: false }
  return { outline: true, properties: true }
}

/** Adapts the former exclusive panel state for workspace render fixtures. */
export function workspacePanelVisibilityFromResponsiveState(
  responsivePanel: ResponsivePanel,
  width: number,
): WorkspacePanelVisibility {
  if (width <= 800) {
    return { outline: responsivePanel === 'outline', properties: responsivePanel === 'properties' }
  }
  if (width <= 1200) return { outline: true, properties: responsivePanel === 'properties' }
  return { outline: true, properties: true }
}

/** Applies the established panel defaults when the viewport crosses a breakpoint. */
export function resizedWorkspacePanelVisibility(
  current: WorkspacePanelVisibility,
  previousWidth: number,
  nextWidth: number,
): WorkspacePanelVisibility {
  const previousBand = workspaceViewportBand(previousWidth)
  const nextBand = workspaceViewportBand(nextWidth)
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

/** Groups editor widths by their established responsive breakpoints. */
function workspaceViewportBand(width: number): 'narrow' | 'medium' | 'wide' {
  if (width <= 800) return 'narrow'
  if (width <= 1200) return 'medium'
  return 'wide'
}

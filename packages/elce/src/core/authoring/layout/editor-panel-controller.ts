import type { EditorPanelName, EditorPanelVisibility } from './editor-frame'
import {
  editorPanelVisibilityFromResponsiveState,
  initialEditorPanelVisibility,
  resizedEditorPanelVisibility,
} from './editor-panel-state'

interface EditorPanelControllerOptions {
  readonly initialWidth: number
  readonly getWidth: () => number
  readonly update: () => Promise<unknown>
}

/** Owns shared panel visibility, resize transitions, Escape state, and focus return. */
export function createEditorPanelController(options: EditorPanelControllerOptions) {
  let visibility: EditorPanelVisibility = initialEditorPanelVisibility(options.initialWidth)
  let responsivePanel: EditorPanelName | null = null
  let previousWidth = options.initialWidth
  let returnFocusId: string | null = null

  /** Renders a panel transition and returns focus after a close. */
  const updateAndRestoreFocus = (isOpening: boolean, focusId: string | null): void => {
    void options.update().then(() => {
      if (isOpening || focusId === null) return
      document.getElementById(focusId)?.focus()
    })
  }

  /** Sets one panel while preserving the exclusive narrow-screen rule. */
  const setPanelVisibility = (panel: EditorPanelName, isOpen: boolean, triggerId?: string): void => {
    const width = options.getWidth()
    if (isOpen) returnFocusId = triggerId ?? returnFocusId
    const focusId = isOpen ? null : returnFocusId
    visibility = isOpen && width <= 800
      ? { outline: panel === 'outline', properties: panel === 'properties' }
      : { ...visibility, [panel]: isOpen }
    if (width <= 800) responsivePanel = isOpen ? panel : null
    if (!isOpen) returnFocusId = null
    updateAndRestoreFocus(isOpen, focusId)
  }

  /** Selects the exclusive responsive panel and its default visibility. */
  const setResponsivePanel = (panel: EditorPanelName | null, triggerId?: string): void => {
    if (panel !== null) returnFocusId = triggerId ?? returnFocusId
    const focusId = panel === null ? returnFocusId : null
    responsivePanel = panel
    visibility = editorPanelVisibilityFromResponsiveState(panel, options.getWidth())
    if (panel === null) returnFocusId = null
    updateAndRestoreFocus(panel !== null, focusId)
  }

  /** Applies the shared visibility defaults when crossing a width breakpoint. */
  const resize = (nextWidth: number): void => {
    visibility = resizedEditorPanelVisibility(visibility, previousWidth, nextWidth)
    previousWidth = nextWidth
    if (nextWidth > 800) responsivePanel = null
  }

  return {
    get visibility() { return visibility },
    get responsivePanel() { return responsivePanel },
    setPanelVisibility,
    setResponsivePanel,
    resize,
  }
}

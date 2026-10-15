import type { EditorViewModel } from '../../selectors/editor-view-model'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { ResponsivePanel } from './editor-workspace-types'

export interface ContentCatalogPanelProps {
  readonly view: EditorViewModel
  readonly actions: EditorActionsFacade
  readonly responsivePanel: ResponsivePanel
  readonly profileTokenTargetId: string | null
  readonly dropTarget: string | null
  readonly onSetDropTarget: (targetId: string | null) => void
}

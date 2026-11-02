import type { EditorViewModel } from '../../selectors/editor-view-model'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { ResponsivePanel, WorkspacePanelName } from './editor-workspace-types'
import type { AppearanceTarget } from '../../../domain/commands/document-command-types'
import type { SidePanelTab } from './editor-workspace-types'
import type { InlineTextLabelSelection } from '../../editor/profile/profile-token-events'

export interface ContentCatalogPanelProps {
  readonly view: EditorViewModel
  readonly actions: EditorActionsFacade
  readonly responsivePanel: ResponsivePanel
  readonly panelOpen?: boolean
  readonly onSetPanelVisibility?: (panel: WorkspacePanelName, open: boolean) => void
  readonly onSetResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly sidePanelTab: SidePanelTab
  readonly appearanceTarget: AppearanceTarget
  readonly onSetSidePanelTab: (tab: SidePanelTab) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly profileTokenTargetId: string | null
  readonly selectedInlineLabel: InlineTextLabelSelection | null
  readonly dropTarget: string | null
  readonly onSetDropTarget: (targetId: string | null) => void
}

import type { EditorViewModel } from './learning-authoring-service'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { ResponsivePanel } from './learning-workspace-types'
import type { AppearanceTarget } from '../commands/learning-document-command-types'
import type { SidePanelTab } from './learning-workspace-types'
import type { WorkspacePanelName } from './learning-workspace-types'
import type { InlineTextLabelSelection } from '../profile/authoring/profile-token-events'

export interface LearningContentCatalogPanelProps {
  readonly view: EditorViewModel
  readonly actions: LearningEditorFacade
  readonly responsivePanel: ResponsivePanel
  readonly panelOpen?: boolean
  readonly onSetPanelVisibility?: (panel: WorkspacePanelName, open: boolean) => void
  readonly onSetResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly sidePanelTab: SidePanelTab
  readonly appearanceTarget: AppearanceTarget
  readonly onSetSidePanelTab: (tab: SidePanelTab) => void
  readonly profileTokenTargetId: string | null
  readonly selectedInlineLabel: InlineTextLabelSelection | null
}

import type { EditorViewModel } from './learning-authoring-service'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { ResponsivePanel } from './learning-workspace-types'
import type { AppearanceTarget } from '../commands/learning-document-command-types'
import type { SidePanelTab } from './learning-workspace-types'

export interface LearningContentCatalogPanelProps {
  readonly view: EditorViewModel
  readonly actions: LearningEditorFacade
  readonly responsivePanel: ResponsivePanel
  readonly sidePanelTab: SidePanelTab
  readonly appearanceTarget: AppearanceTarget
  readonly onSetSidePanelTab: (tab: SidePanelTab) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly profileTokenTargetId: string | null
  readonly dropTarget: string | null
  readonly onSetDropTarget: (targetId: string | null) => void
}

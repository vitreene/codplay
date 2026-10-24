import type { EditorViewModel } from '../../selectors/editor-view-model'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { ResponsivePanel } from './editor-workspace-types'
import type { AppearanceTarget } from '../../../domain/commands/document-command-types'
import type { SidePanelTab } from './editor-workspace-types'

export interface ContentCatalogPanelProps {
  readonly view: EditorViewModel
  readonly actions: EditorActionsFacade
  readonly responsivePanel: ResponsivePanel
  readonly sidePanelTab: SidePanelTab
  readonly appearanceTarget: AppearanceTarget
  readonly onSetSidePanelTab: (tab: SidePanelTab) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly profileTokenTargetId: string | null
  readonly dropTarget: string | null
  readonly onSetDropTarget: (targetId: string | null) => void
}

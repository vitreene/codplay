import type { RemixNode } from 'remix/ui'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { EditorViewModel } from './learning-authoring-service'
import type { ChapterId, PageId } from '../../../core/document/content-document-types'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import type { PagePlacement } from '../organization/learning-page-placement'

export type ResponsivePanel = 'outline' | 'properties' | null
export type SidePanelTab = 'contents' | 'style'
export type DraggedScenarioEntry = ScenarioEntry | null

export interface EditorWorkspaceViewProps {
  readonly view: EditorViewModel
  readonly actions: LearningEditorFacade
  readonly pageEditorHost: RemixNode
  readonly responsivePanel: ResponsivePanel
  readonly sidePanelTab: SidePanelTab
  readonly appearanceTarget: AppearanceTarget
  readonly summarySettingsOpen: boolean
  readonly profileTokenTargetId: string | null
  readonly authoringError: string | null
  readonly dropTarget: string | null
  readonly visible: boolean
  readonly editable?: boolean
  readonly onSetResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly onSetSidePanelTab: (tab: SidePanelTab) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly onSetSummarySettingsOpen: (open: boolean) => void
  readonly onSetAuthoringError: (error: string | null) => void
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly onSetDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onPreview: () => void
  readonly previewError: string | null
  readonly exportBusy: boolean
  readonly exportKind?: 'sighty' | 'scorm' | null
  readonly exportError: string | null
  readonly exportNotice: string | null
  readonly onMovePage: (pageId: PageId, placement: PagePlacement) => void
  readonly onMoveChapter: (chapterId: ChapterId, index: number) => void
}

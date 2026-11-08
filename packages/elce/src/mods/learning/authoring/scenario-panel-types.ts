import type { PageId, ChapterId } from '../../../core/document/content-document-types'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { ScenarioEntryPlacement } from '../organization/learning-scenario-entry-types'
import type { DraggedScenarioEntry } from './learning-workspace-types'
import type { EditorViewModel } from './learning-authoring-service'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import type { WorkspacePanelName, WorkspacePanelVisibility } from './learning-workspace-types'

export type LearningResponsivePanel = 'outline' | 'properties' | null

export interface LearningScenarioWorkspaceProps {
  readonly view: EditorViewModel
  readonly actions: Pick<LearningEditorFacade,
    'createChapter' | 'createEvaluationChapter' | 'createPage' | 'selectPage' | 'deletePage' | 'selectChapter' | 'deleteChapter' | 'movePage'
  >
  readonly responsivePanel: LearningResponsivePanel
  readonly panelVisibility?: WorkspacePanelVisibility
  readonly summarySettingsOpen: boolean
  readonly dropTarget: string | null
  readonly onSetSummarySettingsOpen: (open: boolean) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly onSetResponsivePanel: (panel: LearningResponsivePanel, triggerId?: string) => void
  readonly onSetPanelVisibility?: (panel: WorkspacePanelName, open: boolean) => void
}

export interface ScenarioPanelProps {
  readonly workspace: LearningScenarioWorkspaceProps
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly onDragStartPage: (event: DragEvent, pageId: PageId) => void
  readonly onDragStartChapter: (event: DragEvent, chapterId: ChapterId) => void
  readonly onDragEnd: () => void
  readonly onDragOverPage: (event: DragEvent, targetId: string) => void
  readonly onDragOverScenarioEntry: (event: DragEvent, targetId: string) => void
  readonly onDropScenarioEntry: (event: DragEvent, placement: ScenarioEntryPlacement) => void
  readonly onDropPage: (event: DragEvent, placement: PagePlacement) => void
  readonly onDragLeave: (event: DragEvent) => void
}

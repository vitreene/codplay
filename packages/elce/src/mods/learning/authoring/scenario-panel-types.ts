import type { PageId, ChapterId } from '../../../core/document/content-document-types'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { EditorViewModel } from './learning-authoring-service'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import type { WorkspacePanelName, WorkspacePanelVisibility } from './learning-workspace-types'

export type LearningResponsivePanel = 'outline' | 'properties' | null

export interface LearningScenarioWorkspaceProps {
  readonly view: EditorViewModel
  readonly actions: Pick<LearningEditorFacade,
    'createChapter' | 'createEvaluationChapter' | 'createPage' | 'selectPage' | 'deletePage' | 'selectChapter' | 'deleteChapter'
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
  readonly onDragStartPage: (event: DragEvent, pageId: PageId) => void
  readonly onDragStartChapter: (event: DragEvent, chapterId: ChapterId) => void
  readonly onDragEnd: () => void
  readonly onDragOverRoot: (event: DragEvent, targetId: string) => void
  readonly onDragOverPage: (event: DragEvent, targetId: string) => void
  readonly onDropRoot: (event: DragEvent, placement: PagePlacement) => void
  readonly onDropPage: (event: DragEvent, placement: PagePlacement) => void
  readonly onDragLeave: (event: DragEvent) => void
}

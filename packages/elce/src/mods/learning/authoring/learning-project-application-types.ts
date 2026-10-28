import type { AppearanceTarget } from '../commands/learning-document-command-types'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { ScormVersion } from '../../../scorm/scorm-types'
import type { EditorViewModel } from './learning-authoring-service'
import type { LearningAppContext } from './learning-controller-types'
import type { DraggedScenarioEntry, ResponsivePanel, SidePanelTab } from './learning-workspace-types'

export type ProjectApplicationView = Pick<
  LearningAppContext,
  'projects' | 'activeProject' | 'projectStatus' | 'projectError' | 'accessRecoveryAvailable' | 'recoverableLocalCopy' | 'editAccess' | 'document' | 'syncStatus' | 'history'
> & Readonly<{ editor: EditorViewModel; importPending: boolean }>

export interface ProjectApplicationWorkspaceState {
  readonly responsivePanel: ResponsivePanel
  readonly sidePanelTab: SidePanelTab
  readonly appearanceTarget: AppearanceTarget
  readonly summarySettingsOpen: boolean
  readonly profileTokenTargetId: string | null
  readonly authoringError: string | null
  readonly dropTarget: string | null
  readonly visible: boolean
  readonly setResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly setSidePanelTab: (tab: SidePanelTab) => void
  readonly openAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly setSummarySettingsOpen: (open: boolean) => void
  readonly setAuthoringError: (error: string | null) => void
  readonly setDropTarget: (targetId: string | null) => void
  readonly setDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onPreview: () => void
  readonly previewError: string | null
  readonly onExport: () => void
  readonly onCloseExportDialog: () => void
  readonly onExportSighty: () => void
  readonly onExportScorm: (version: ScormVersion, monoSco: boolean) => void
  readonly exportBusy: boolean
  readonly exportKind: 'sighty' | 'scorm' | null
  readonly exportError: string | null
  readonly exportNotice: string | null
  readonly movePage: (pageId: string, placement: PagePlacement) => void
  readonly moveChapter: (chapterId: string, index: number) => void
}

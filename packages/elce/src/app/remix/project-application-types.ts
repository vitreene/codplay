import type { PagePlacement } from '../../domain/commands/document-command-types'
import type { EditorViewModel } from '../selectors/editor-view-model'
import type { ElceAppContext } from '../controller/controller-types'
import type { DraggedScenarioEntry, ResponsivePanel } from './workspace/editor-workspace-types'

export type ProjectApplicationView = Pick<
  ElceAppContext,
  'projects' | 'activeProject' | 'projectStatus' | 'projectError' | 'editAccess' | 'document' | 'syncStatus'
> & Readonly<{ editor: EditorViewModel }>

export interface ProjectApplicationWorkspaceState {
  readonly responsivePanel: ResponsivePanel
  readonly dropTarget: string | null
  readonly visible: boolean
  readonly setResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly setDropTarget: (targetId: string | null) => void
  readonly setDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onPreview: () => void
  readonly previewError: string | null
  readonly movePage: (pageId: string, placement: PagePlacement) => void
  readonly moveChapter: (chapterId: string, index: number) => void
}

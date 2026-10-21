import type { RemixNode } from 'remix/ui'
import type { ScenarioEntry } from '../../../domain/scenario/scenario-entry-types'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import type { ChapterId, PageId } from '../../../domain/document/document-types'
import type { PagePlacement } from '../../../domain/commands/document-command-types'

export type ResponsivePanel = 'outline' | 'properties' | null
export type DraggedScenarioEntry = ScenarioEntry | null

export interface EditorWorkspaceViewProps {
  readonly view: EditorViewModel
  readonly actions: EditorActionsFacade
  readonly pageEditorHost: RemixNode
  readonly responsivePanel: ResponsivePanel
  readonly summarySettingsOpen: boolean
  readonly profileTokenTargetId: string | null
  readonly authoringError: string | null
  readonly dropTarget: string | null
  readonly visible: boolean
  readonly editable?: boolean
  readonly onSetResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly onSetSummarySettingsOpen: (open: boolean) => void
  readonly onSetAuthoringError: (error: string | null) => void
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly onSetDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onPreview: () => void
  readonly previewError: string | null
  readonly onExport: () => void
  readonly exportBusy: boolean
  readonly exportError: string | null
  readonly exportNotice: string | null
  readonly onMovePage: (pageId: PageId, placement: PagePlacement) => void
  readonly onMoveChapter: (chapterId: ChapterId, index: number) => void
}

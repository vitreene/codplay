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
  readonly dropTarget: string | null
  readonly visible: boolean
  readonly onSetResponsivePanel: (panel: ResponsivePanel, triggerId?: string) => void
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly onSetDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onPreview: () => void
  readonly previewError: string | null
  readonly onMovePage: (pageId: PageId, placement: PagePlacement) => void
  readonly onMoveChapter: (chapterId: ChapterId, index: number) => void
}

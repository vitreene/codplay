import type { EditorWorkspaceViewProps } from './editor-workspace-types'
import type { PagePlacement } from '../../../domain/commands/document-command-types'
import type { PageId, ChapterId } from '../../../domain/document/document-types'

export interface ScenarioPanelProps {
  readonly workspace: EditorWorkspaceViewProps
  readonly onDragStartPage: (event: DragEvent, pageId: PageId) => void
  readonly onDragStartChapter: (event: DragEvent, chapterId: ChapterId) => void
  readonly onDragEnd: () => void
  readonly onDragOverRoot: (event: DragEvent, targetId: string) => void
  readonly onDragOverPage: (event: DragEvent, targetId: string) => void
  readonly onDropRoot: (event: DragEvent, placement: PagePlacement) => void
  readonly onDropPage: (event: DragEvent, placement: PagePlacement) => void
  readonly onDragLeave: (event: DragEvent) => void
}

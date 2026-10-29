import type { Chapter } from '../../../domain/document/document-types'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'

export interface RemixChapterSettingsProps {
  readonly chapter: Chapter
  readonly actions: EditorActionsFacade
}

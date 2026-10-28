import type { LearningChapter } from '../document/learning-document-types'
import type { LearningEditorFacade } from './learning-editor-facade'

export interface RemixChapterSettingsProps {
  readonly chapter: LearningChapter
  readonly actions: Pick<LearningEditorFacade, 'renameChapter' | 'updateEvaluationChapterSettings'>
}

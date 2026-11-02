import type { LearningChapter } from '../document/learning-document-types'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { ResourceTextFieldFeature } from '../../../core/authoring/resource-text-field-feature'

export interface RemixChapterSettingsProps {
  readonly chapter: LearningChapter
  readonly textFieldFeature: ResourceTextFieldFeature
  readonly actions: Pick<LearningEditorFacade, 'renameChapter' | 'updateEvaluationChapterSettings'>
}

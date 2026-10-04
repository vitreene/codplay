import type { ElceQuestionEditorActions } from '../../domain/question-facade-types'
import type { MediaMetadata } from '../../domain/document-types'
import type { QuestionContent } from '../../domain/question-types'

export interface QuestionEditorProps {
  readonly bdcId: string
  readonly question: QuestionContent
  readonly media: MediaMetadata | null
  readonly mediaSource: string | null
  readonly actions: ElceQuestionEditorActions
  readonly onCatalogReference: (value: string) => void
}

import type { ElceQuestionEditorActions } from '../../facades/question/question-facade-types'
import type { MediaMetadata } from '../../../domain/document/document-types'
import type { QuestionContent } from '../../../domain/question/question-types'
import type { SupportedMediaType } from '../../../domain/media/media-resource-service'

export interface QuestionEditorProps {
  readonly bdcId: string
  readonly question: QuestionContent
  readonly media: MediaMetadata | null
  readonly mediaType: SupportedMediaType | null
  readonly mediaSource: string | null
  readonly actions: ElceQuestionEditorActions
  readonly onCatalogReference: (value: string) => void
}

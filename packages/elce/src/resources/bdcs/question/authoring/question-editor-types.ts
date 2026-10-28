import type { ElceQuestionEditorActions } from './question-facade-types'
import type { AppearanceTarget } from '../../../../domain/appearance/appearance-target-types'
import type { MediaMetadata } from '../../../../core/document/content-document-types'
import type { QuestionContent } from '../domain/question-types'
import type { SupportedMediaType } from '../../../../domain/media/media-resource-service'

export interface QuestionEditorProps {
  readonly bdcId: string
  readonly question: QuestionContent
  readonly media: MediaMetadata | null
  readonly mediaType: SupportedMediaType | null
  readonly mediaSource: string | null
  readonly actions: ElceQuestionEditorActions
  readonly textFieldAttributes?: Readonly<Record<string, string>>
  readonly onCatalogReference: (value: string) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
}

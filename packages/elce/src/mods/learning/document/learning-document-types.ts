import type { BdcId, ChapterId, ContentChapter, ContentPage, MediaId, MediaMetadata, PageId } from '../../../core/document/content-document-types'
import type { EvaluationRetryScope } from '../evaluation/learning-evaluation-config'
import type { ChapterType } from '../organization/learning-organization-config'
import type { BdcType, PageType } from '../learning-definition'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import type { EvaluationResultContent } from '../evaluation/domain/learning-evaluation-result-types'
import type { ResourceBdc, ResourceDocumentData } from '../../../resources/document/resource-document-types'
import type { ProfileDefinition, SummarySettings } from '../profile/domain/learning-profile-types'
import type { RevelationTransitionDefaults } from '../../../resources/revelation/revelation-types'

export type { BdcId, ChapterId, MediaId, MediaMetadata, PageId }

export interface LearningChapter extends ContentChapter {
  readonly type: ChapterType
  readonly evaluationThreshold?: number
  readonly evaluationAttemptLimit?: number | null
  readonly evaluationRetryScope?: EvaluationRetryScope
}

export interface LearningPage extends ContentPage {
  readonly type: PageType
}

export interface LearningBdc extends ResourceBdc {
  readonly type: BdcType
  readonly evaluationResult?: EvaluationResultContent | null
}

export interface LearningDocumentData extends ResourceDocumentData {
  readonly id: string
  readonly version: 7
  readonly name: string
  readonly revelationDefaults: RevelationTransitionDefaults
  readonly summary: SummarySettings
  readonly profile: ProfileDefinition
  readonly chapters: readonly LearningChapter[]
  readonly pages: readonly LearningPage[]
  readonly scenarioEntries: readonly ScenarioEntry[]
  readonly bdcs: readonly LearningBdc[]
}

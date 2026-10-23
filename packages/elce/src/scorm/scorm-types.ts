import type { EvaluationMachineState } from '../domain/evaluation/evaluation-machine-types'
import type { QuestionType } from '../domain/question/question-types'
import type { ProjectTestState } from '../domain/summary-profile/test-state-types'

export type { ScormVersion } from '@codplay/sighty-scorm'

/** Names the optional application adapter supplied through Sighty's runtime context. */
export const ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY = 'elceScormProgressSink'

/** Identifies the chapter whose pages belong to the currently launched SCO. */
export const ELCE_SCORM_CHAPTER_CONTEXT_KEY = 'elceScormChapterId'

/** Maps each packaged Elcé chapter to its stable LMS manifest item identifier. */
export const ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY = 'elceScormChapterScoIdentifiers'

/** Describes the Elcé reader data restored from one SCO session. */
export interface ScormReaderState {
  readonly schemaVersion: 1
  readonly currentPageId: string | null
  readonly projectTestState: ProjectTestState
}

/** Carries one validated chapter result to the LMS session. */
export interface ScormEvaluationResult {
  readonly chapterId: string
  readonly evaluationState: EvaluationMachineState
}

/** Carries one answered Elcé Question to its immediate or deferred SCORM write. */
export interface ScormQuestionInteraction {
  readonly questionType: QuestionType
  readonly answerIds: readonly string[]
  readonly answerLabels: readonly string[]
  readonly selectedAnswerIds: readonly string[]
  readonly expectedAnswerIds: readonly string[]
  readonly description: string
  readonly isCorrect: boolean
  readonly latencyMs?: number
  readonly timestampMs?: number
}

/** Defines the narrow operations Sighty page actions may request from SCORM. */
export interface ElceScormProgressSink {
  saveReaderState(state: ProjectTestState, currentPageId?: string): Promise<void>
  getEvaluationThresholdOverride?(): number | undefined
  navigateToChapter?(chapterId: string): Promise<boolean>
  recordQuestionInteraction?(state: ProjectTestState, currentPageId: string, interaction: ScormQuestionInteraction): Promise<void>
  recordEvaluationResult(
    state: ProjectTestState,
    currentPageId: string,
    result: ScormEvaluationResult,
  ): Promise<void>
}

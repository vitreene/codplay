import type { EvaluationRetryScope } from '../../config/document-config-types'
import type { QuestionType } from '../question/question-types'

export { EVALUATION_RETRY_SCOPE } from '../../config/document-config'
export type { EvaluationRetryScope } from '../../config/document-config-types'

export type EvaluationMachineValue = 'ready' | 'attempting' | 'success' | 'failure' | 'reviewing'

export interface EvaluationSettings {
  readonly threshold: number
  /** Maximum attempts including the first; null allows unlimited attempts. */
  readonly attemptLimit: number | null
  readonly retryScope: EvaluationRetryScope
}

export interface EvaluationAnswer {
  readonly questionId: string
  readonly answerIds: readonly string[]
  readonly selectedAnswerIds: readonly string[]
  readonly expectedAnswerIds: readonly string[]
  readonly questionType?: QuestionType
  readonly answerLabels?: readonly string[]
  readonly description?: string
  readonly latencyMs?: number
  readonly timestampMs?: number
}

export interface EvaluationResult {
  readonly questionCount: number
  readonly correctCount: number
  readonly score: number | null
  readonly passed: boolean | null
}

export interface EvaluationMachineContext {
  readonly questionIds: readonly string[]
  readonly activeQuestionIds: readonly string[]
  readonly settings: EvaluationSettings
  readonly attempt: number
  readonly answers: Readonly<Record<string, EvaluationAnswer>>
  readonly result: EvaluationResult | null
}

/** The serializable portion of the XState snapshot stored by its host runtime. */
export interface EvaluationMachineState {
  readonly value: EvaluationMachineValue
  readonly context: EvaluationMachineContext
}

export type EvaluationMachineEvent =
  | Readonly<{ type: 'START' }>
  | Readonly<{ type: 'QUESTION.ANSWERED'; answer: EvaluationAnswer }>
  | Readonly<{ type: 'COMPLETE' }>
  | Readonly<{ type: 'SUCCESS.REPLAY' }>
  | Readonly<{ type: 'REPLAY.COMPLETE' }>
  | Readonly<{ type: 'RETRY' }>

export interface EvaluationMachineInput {
  readonly questionIds: readonly string[]
  readonly settings: EvaluationSettings
}

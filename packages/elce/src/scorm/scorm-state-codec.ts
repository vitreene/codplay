import { INITIAL_PROJECT_TEST_STATE } from '../mods/learning/reading/learning-test-state-types'
import type { ProjectTestState } from '../mods/learning/reading/learning-test-state-types'
import { EVALUATION_RETRY_SCOPE } from '../mods/learning/evaluation/learning-evaluation-config'
import { QUESTION_TYPE } from '../resources/bdcs/question/question-config'
import type { EvaluationMachineState } from '../mods/learning/evaluation/domain/learning-evaluation-machine-types'
import { suspendDataLimit } from '@codplay/sighty-scorm/limits'
import type { ScormVersion } from '@codplay/sighty-scorm'
import type { ScormReaderState } from './scorm-types'

export { suspendDataLimit } from '@codplay/sighty-scorm/limits'

/** Encodes the Elcé reader state as bounded JSON for cmi.suspend_data. */
export function encodeScormReaderState(state: ScormReaderState, version: ScormVersion): string {
  const encoded = JSON.stringify(state)
  const limit = suspendDataLimit(version)
  if (encoded.length > limit) {
    throw new RangeError(`L’état de lecture dépasse la limite SCORM ${version} (${limit} caractères).`)
  }
  return encoded
}

/** Decodes and validates a supported Elcé reader state from cmi.suspend_data. */
export function decodeScormReaderState(value: string): ScormReaderState | undefined {
  if (value.length === 0) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed) || parsed.schemaVersion !== 1) return undefined
    if (!(typeof parsed.currentPageId === 'string' || parsed.currentPageId === null)) return undefined
    if (!isProjectTestState(parsed.projectTestState)) return undefined
    return {
      schemaVersion: 1,
      currentPageId: parsed.currentPageId,
      projectTestState: parsed.projectTestState,
    }
  } catch {
    return undefined
  }
}

/** Returns a fresh initial reader state when suspend data is absent or invalid. */
export function initialScormReaderState(): ScormReaderState {
  return {
    schemaVersion: 1,
    currentPageId: null,
    projectTestState: INITIAL_PROJECT_TEST_STATE,
  }
}

/** Checks the stable serialized fields required by ProjectTestState. */
function isProjectTestState(value: unknown): value is ProjectTestState {
  if (!isRecord(value) || value.schemaVersion !== 1) return false
  if (typeof value.profileEnabled !== 'boolean' || typeof value.profileSubmitted !== 'boolean') return false
  if (!isRecord(value.profileValues) || !Array.isArray(value.finishedPageIds)) return false
  if (!value.finishedPageIds.every((pageId) => typeof pageId === 'string')) return false
  if (!Object.values(value.profileValues).every(isProfileValue)) return false
  if (!isRecord(value.questionAnswers) || !Object.values(value.questionAnswers).every(isQuestionAnswer)) return false
  return isRecord(value.evaluationStates) && Object.values(value.evaluationStates).every(isEvaluationState)
}

/** Checks the scalar and choice-array values supported by the profile model. */
function isProfileValue(value: unknown): boolean {
  return typeof value === 'string'
    || typeof value === 'number' && Number.isFinite(value)
    || isStringArray(value)
}

/** Checks one saved answer without trusting the suspend-data input. */
function isQuestionAnswer(value: unknown): boolean {
  return isRecord(value)
    && isStringArray(value.answerIds)
    && isStringArray(value.selectedAnswerIds)
    && isStringArray(value.expectedAnswerIds)
    && typeof value.isCorrect === 'boolean'
}

/** Checks the complete portable Evaluation state before restoring it. */
function isEvaluationState(value: unknown): value is EvaluationMachineState {
  if (!isRecord(value) || !isRecord(value.context)) return false
  const evaluationValue = value.value
  if (evaluationValue !== 'ready' && evaluationValue !== 'attempting' && evaluationValue !== 'success'
    && evaluationValue !== 'failure' && evaluationValue !== 'reviewing') return false
  const context = value.context
  if (!isStringArray(context.questionIds) || !isStringArray(context.activeQuestionIds)) return false
  if (!isRecord(context.settings) || !isRecord(context.answers)) return false
  if (typeof context.attempt !== 'number' || !Number.isFinite(context.attempt)) return false
  if (typeof context.settings.threshold !== 'number' || !Number.isFinite(context.settings.threshold)) return false
  if (!(context.settings.attemptLimit === null
    || typeof context.settings.attemptLimit === 'number' && Number.isFinite(context.settings.attemptLimit))) return false
  if (context.settings.retryScope !== EVALUATION_RETRY_SCOPE.ALL_QUESTIONS
    && context.settings.retryScope !== EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS) return false
  if (!Object.entries(context.answers).every(([questionId, answer]) => isEvaluationAnswer(questionId, answer))) return false
  return context.result === null || isEvaluationResult(context.result)
}

/** Checks one machine answer and its stable Question identity. */
function isEvaluationAnswer(questionId: string, value: unknown): boolean {
  return isRecord(value)
    && value.questionId === questionId
    && isStringArray(value.answerIds)
    && isStringArray(value.selectedAnswerIds)
    && isStringArray(value.expectedAnswerIds)
    && (value.questionType === undefined
      || value.questionType === QUESTION_TYPE.TRUE_FALSE
      || value.questionType === QUESTION_TYPE.CHOICE
      || value.questionType === QUESTION_TYPE.MULTIPLE_CHOICE)
    && (value.answerLabels === undefined
      || isStringArray(value.answerLabels) && value.answerLabels.length === value.answerIds.length)
    && (value.description === undefined || typeof value.description === 'string')
    && (value.latencyMs === undefined || typeof value.latencyMs === 'number' && Number.isFinite(value.latencyMs) && value.latencyMs >= 0)
    && (value.timestampMs === undefined || typeof value.timestampMs === 'number' && Number.isFinite(value.timestampMs) && value.timestampMs >= 0)
}

/** Checks the stored numeric result fields and nullable outcome. */
function isEvaluationResult(value: unknown): boolean {
  return isRecord(value)
    && typeof value.questionCount === 'number'
    && Number.isFinite(value.questionCount)
    && typeof value.correctCount === 'number'
    && Number.isFinite(value.correctCount)
    && (value.score === null || typeof value.score === 'number' && Number.isFinite(value.score))
    && (value.passed === null || typeof value.passed === 'boolean')
}

/** Checks whether a value is a string array. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/** Checks whether a value is a JSON object with string keys. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

import { BDC_TYPE, CHAPTER_TYPE, DEFAULT_EVALUATION_SETTINGS, DEFAULT_EVALUATION_THRESHOLD } from '../../config/document-config'
import type { ElceDocument } from '../document/document-model'
import type { EvaluationAnswer, EvaluationMachineState, EvaluationSettings } from '../evaluation/evaluation-machine-types'
import { ElceChapterEvaluation } from '../evaluation/chapter-evaluation'
import type { ProjectTestState, TestAnswerState } from './test-state-types'
import { validateProfileValues } from './profile-rules'

const chapterEvaluation = new ElceChapterEvaluation()

/** Drops only profile and Question results made incompatible by document edits. */
export function reconcileProjectTestState(
  document: ElceDocument,
  state: ProjectTestState,
): ProjectTestState {
  const profileValues = compatibleProfileValues(document, state.profileValues)
  const profileErrors = validateProfileValues(
    document.data.profile.properties,
    document.data.profile.fieldPropertyIds,
    profileValues,
  )
  const questionDefinitions = currentQuestions(document)
  const questionAnswers = Object.fromEntries(Object.entries(state.questionAnswers).flatMap(([pageId, answer]) => {
    const current = questionDefinitions.get(pageId)
    return current !== undefined && isQuestionAnswerCompatible(answer, current.answerIds, current.correctAnswerIds)
      ? [[pageId, answer]]
      : []
  }))
  const evaluationStates = reconcileEvaluations(document, state.evaluationStates, questionDefinitions)
  const profileSubmitted = state.profileSubmitted && profileErrors.length === 0
  if (JSON.stringify(profileValues) === JSON.stringify(state.profileValues)
    && JSON.stringify(questionAnswers) === JSON.stringify(state.questionAnswers)
    && evaluationStates === state.evaluationStates && profileSubmitted === state.profileSubmitted) return state
  return { ...state, profileValues, profileSubmitted, questionAnswers, evaluationStates }
}

/** Retains only values whose stable property and current type still agree. */
function compatibleProfileValues(
  document: ElceDocument,
  values: ProjectTestState['profileValues'],
): ProjectTestState['profileValues'] {
  const properties = new Map(document.data.profile.properties.map((property) => [property.id, property]))
  return Object.fromEntries(Object.entries(values).flatMap(([propertyId, value]) => {
    const property = properties.get(propertyId)
    if (property === undefined) return []
    const compatible = validateProfileValues([property], [propertyId], { [propertyId]: value }).length === 0
    return compatible ? [[propertyId, value]] : []
  }))
}

/** Describes the current answer identifiers and correct choices for each Question page. */
function currentQuestions(document: ElceDocument): Map<string, Readonly<{
  answerIds: readonly string[]
  correctAnswerIds: readonly string[]
}>> {
  const questions = new Map<string, Readonly<{ answerIds: readonly string[]; correctAnswerIds: readonly string[] }>>()
  for (const page of document.pages) {
    if (!document.scenarioPageIds.includes(page.id)) continue
    const bdc = page.bdcIds.flatMap((bdcId) => document.bdcs.find((entry) => entry.id === bdcId) ?? [])
      .find((entry) => entry.type === BDC_TYPE.QUESTION && entry.question !== null)
    if (bdc?.question == null) continue
    questions.set(page.id, {
      answerIds: bdc.question.answers.map((answer) => answer.id),
      correctAnswerIds: bdc.question.answers.filter((answer) => answer.correct).map((answer) => answer.id),
    })
  }
  return questions
}

/** Verifies that saved selection, choices, and correction still match the Question. */
function isQuestionAnswerCompatible(
  answer: TestAnswerState,
  answerIds: readonly string[],
  correctAnswerIds: readonly string[],
): boolean {
  return Array.isArray(answer.answerIds) && Array.isArray(answer.selectedAnswerIds)
    && Array.isArray(answer.expectedAnswerIds)
    && sameIdSet(answer.answerIds, answerIds)
    && sameIdSet(answer.expectedAnswerIds, correctAnswerIds)
    && answer.selectedAnswerIds.every((id) => answerIds.includes(id))
    && answer.isCorrect === sameIdSet(answer.selectedAnswerIds, correctAnswerIds)
}

/** Reconciles Evaluation attempts while preserving every still-compatible answer. */
function reconcileEvaluations(
  document: ElceDocument,
  saved: ProjectTestState['evaluationStates'],
  questions: ReadonlyMap<string, Readonly<{ answerIds: readonly string[]; correctAnswerIds: readonly string[] }>>,
): ProjectTestState['evaluationStates'] {
  let changed = false
  const result: Record<string, EvaluationMachineState> = {}
  for (const [chapterId, state] of Object.entries(saved)) {
    const chapter = document.chapters.find((entry) => entry.id === chapterId && entry.type === CHAPTER_TYPE.EVALUATION)
    if (chapter === undefined) {
      changed = true
      continue
    }
    const questionIds = chapter.pageIds.filter((pageId) => questions.has(pageId))
    const settings = evaluationSettings(chapter)
    const answers = Object.fromEntries(Object.entries(state.context.answers).flatMap(([pageId, answer]) => {
      const current = questions.get(pageId)
      return current !== undefined && isEvaluationAnswerCompatible(answer, pageId, current.answerIds, current.correctAnswerIds)
        ? [[pageId, answer]]
        : []
    }))
    const sameQuestions = sameIdSet(state.context.questionIds, questionIds)
    const sameAnswers = JSON.stringify(state.context.answers) === JSON.stringify(answers)
    const sameSettings = JSON.stringify(state.context.settings) === JSON.stringify(settings)
    if (sameQuestions && sameAnswers && sameSettings) {
      result[chapterId] = state
      continue
    }
    changed = true
    result[chapterId] = reconciledEvaluationState(state, questionIds, settings, answers)
  }
  return changed ? result : saved
}

/** Keeps an Evaluation attempt open for missing answers or recomputes its result. */
function reconciledEvaluationState(
  previous: EvaluationMachineState,
  questionIds: readonly string[],
  settings: EvaluationSettings,
  answers: Readonly<Record<string, EvaluationAnswer>>,
): EvaluationMachineState {
  const context = previous.context
  if (previous.value === 'ready' || context.attempt === 0) {
    return { value: 'ready', context: { ...context, questionIds, activeQuestionIds: [], settings, answers, result: null } }
  }
  const missing = questionIds.filter((pageId) => answers[pageId] === undefined)
  if (missing.length > 0) {
    return { value: 'attempting', context: { ...context, questionIds, activeQuestionIds: missing, settings, answers, result: null } }
  }
  const results = Object.fromEntries(questionIds.map((pageId) => {
    const answer = answers[pageId]
    return [pageId, answer !== undefined && sameIdSet(answer.selectedAnswerIds, answer.expectedAnswerIds)]
  }))
  const result = chapterEvaluation.evaluate(questionIds, results, settings.threshold)
  return {
    value: result.passed === true ? 'success' : 'failure',
    context: { ...context, questionIds, activeQuestionIds: [], settings, answers, result },
  }
}

/** Validates a saved Evaluation answer against the current stable identities. */
function isEvaluationAnswerCompatible(
  answer: EvaluationAnswer,
  questionId: string,
  answerIds: readonly string[],
  correctAnswerIds: readonly string[],
): boolean {
  return Array.isArray(answer.answerIds) && Array.isArray(answer.selectedAnswerIds)
    && Array.isArray(answer.expectedAnswerIds)
    && answer.questionId === questionId
    && sameIdSet(answer.answerIds, answerIds)
    && sameIdSet(answer.expectedAnswerIds, correctAnswerIds)
    && answer.selectedAnswerIds.every((id) => answerIds.includes(id))
}

/** Reads the current chapter's effective threshold and retry settings. */
function evaluationSettings(chapter: ElceDocument['chapters'][number]): EvaluationSettings {
  return {
    threshold: chapter.evaluationThreshold ?? DEFAULT_EVALUATION_THRESHOLD,
    attemptLimit: chapter.evaluationAttemptLimit === undefined
      ? DEFAULT_EVALUATION_SETTINGS.attemptLimit
      : chapter.evaluationAttemptLimit,
    retryScope: chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope,
  }
}

/** Compares two answer-id arrays as sets while rejecting duplicate identities. */
function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && new Set(left).size === left.length
    && new Set(right).size === right.length && left.every((id) => right.includes(id))
}

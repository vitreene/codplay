import { BDC_TYPE } from '../learning-definition'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import {
  DEFAULT_EVALUATION_SETTINGS,
  DEFAULT_EVALUATION_THRESHOLD,
} from '../evaluation/learning-evaluation-config'
import type { LearningDocument } from '../document/learning-document'
import type { EvaluationAnswer, EvaluationMachineState, EvaluationSettings } from '../evaluation/domain/learning-evaluation-machine-types'
import { ElceChapterEvaluation } from '../evaluation/domain/learning-chapter-evaluation'
import type { ProjectTestState } from './learning-test-state-types'
import { INITIAL_PROJECT_TEST_STATE } from './learning-test-state-types'
import type { QuestionAnswerState } from '../../../resources/bdcs/question/domain/question-types'
import { learningProfileService } from '../profile/domain/learning-profile-service'
import type { ProfileValue } from '../profile/domain/learning-profile-types'

const chapterEvaluation = new ElceChapterEvaluation()

export class LearningTestStateService {
  /** Validates the complete serialized state accepted by Learning's preview API. */
  public isValidProjectTestState(value: unknown): value is ProjectTestState {
    return isProjectTestState(value)
  }

  /** Reads completed page identifiers from the current Sighty context. */
  public readFinishedPages(context: Readonly<Record<string, unknown>>): readonly string[] {
    return (context as Readonly<{ finishedPages?: readonly string[] }>).finishedPages ?? []
  }

  /** Reads validated Question results without creating another state copy. */
  public readQuestionResults(context: Readonly<Record<string, unknown>>): Readonly<Record<string, boolean>> {
    const results = context.questionResults
    if (typeof results !== 'object' || results === null) return {}
    return Object.fromEntries(Object.entries(results).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'))
  }

  /** Reads serialized Evaluation states from the current Sighty context. */
  public readEvaluationStates(context: Readonly<Record<string, unknown>>): ProjectTestState['evaluationStates'] {
    const states = context.evaluationStates
    if (typeof states !== 'object' || states === null) return {}
    return states as ProjectTestState['evaluationStates']
  }

  /** Reads saved Question answers from the current Sighty context. */
  public readQuestionAnswers(context: Readonly<Record<string, unknown>>): ProjectTestState['questionAnswers'] {
    const answers = context.questionAnswers
    if (typeof answers !== 'object' || answers === null) return {}
    return answers as ProjectTestState['questionAnswers']
  }

  /** Accepts only serializable profile values supported by the test-state API. */
  public readProfileValues(value: unknown): ProjectTestState['profileValues'] {
    if (!this.isRecord(value)) return {}
    return Object.fromEntries(Object.entries(value).flatMap<[string, ProfileValue]>(([key, candidate]) => {
      if (typeof candidate === 'string' || typeof candidate === 'number' && Number.isFinite(candidate)) return [[key, candidate]]
      if (Array.isArray(candidate) && candidate.every((entry) => typeof entry === 'string')) return [[key, candidate]]
      return []
    }))
  }

  /** Reads a string identifier list from an untyped runtime event. */
  public readStringIds(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value) || !value.every((candidate): candidate is string => typeof candidate === 'string')) return undefined
    return value
  }

  /** Combines a Sighty context snapshot and one committed patch into persisted state. */
  public testStateFromScenarioContext(
    context: Readonly<Record<string, unknown>>,
    patch: Readonly<Record<string, unknown>> = {},
  ): ProjectTestState {
    const read = (key: string): unknown => Object.hasOwn(patch, key) ? patch[key] : context[key]
    const defaults = INITIAL_PROJECT_TEST_STATE
    return {
      ...defaults,
      profileEnabled: typeof read('profileEnabled') === 'boolean' ? read('profileEnabled') as boolean : defaults.profileEnabled,
      profileSubmitted: typeof read('profileSubmitted') === 'boolean' ? read('profileSubmitted') as boolean : defaults.profileSubmitted,
      profileValues: this.isRecord(read('profileValues')) ? this.readProfileValues(read('profileValues')) : defaults.profileValues,
      finishedPageIds: this.readStringIds(read('finishedPages')) ?? defaults.finishedPageIds,
      questionAnswers: this.isRecord(read('questionAnswers')) ? read('questionAnswers') as ProjectTestState['questionAnswers'] : defaults.questionAnswers,
      evaluationStates: this.isRecord(read('evaluationStates')) ? this.readEvaluationStates({ evaluationStates: read('evaluationStates') }) : defaults.evaluationStates,
    }
  }

  /** Maps persisted reader state onto the context consumed by Sighty actions. */
  public scenarioContextFromTestState(state: ProjectTestState): Readonly<Record<string, unknown>> {
    return {
      finishedPages: state.finishedPageIds,
      questionAnswers: state.questionAnswers,
      restorableQuestionPageIds: Object.keys(state.questionAnswers),
      questionResults: Object.fromEntries(Object.entries(state.questionAnswers).map(([pageId, answer]) => [pageId, answer.isCorrect])),
      evaluationStates: state.evaluationStates,
      profileEnabled: state.profileEnabled,
      profileSubmitted: state.profileSubmitted,
      profileValues: state.profileValues,
    }
  }

  /** Drops only profile and Question results made incompatible by document edits. */
  public reconcileProjectTestState(
    document: LearningDocument,
    state: ProjectTestState,
  ): ProjectTestState {
    const profileValues = this.compatibleProfileValues(document, state.profileValues)
    const profileErrors = learningProfileService.validateProfileValues(
      document.data.profile.properties,
      document.data.profile.fieldPropertyIds,
      profileValues,
    )
    const questionDefinitions = this.currentQuestions(document)
    const questionAnswers = Object.fromEntries(Object.entries(state.questionAnswers).flatMap(([pageId, answer]) => {
      const current = questionDefinitions.get(pageId)
      return current !== undefined && this.isQuestionAnswerCompatible(answer, current.answerIds, current.correctAnswerIds)
        ? [[pageId, answer]]
        : []
    }))
    const evaluationStates = this.reconcileEvaluations(document, state.evaluationStates, questionDefinitions)
    const profileSubmitted = state.profileSubmitted && profileErrors.length === 0
    if (JSON.stringify(profileValues) === JSON.stringify(state.profileValues)
      && JSON.stringify(questionAnswers) === JSON.stringify(state.questionAnswers)
      && evaluationStates === state.evaluationStates && profileSubmitted === state.profileSubmitted) return state
    return { ...state, profileValues, profileSubmitted, questionAnswers, evaluationStates }
  }

  /** Retains only values whose stable property and current type still agree. */
  private compatibleProfileValues(
    document: LearningDocument,
    values: ProjectTestState['profileValues'],
  ): ProjectTestState['profileValues'] {
    const properties = new Map(document.data.profile.properties.map((property) => [property.id, property]))
    return Object.fromEntries(Object.entries(values).flatMap(([propertyId, value]) => {
      const property = properties.get(propertyId)
      if (property === undefined) return []
      const compatible = learningProfileService.validateProfileValues([property], [propertyId], { [propertyId]: value }).length === 0
      return compatible ? [[propertyId, value]] : []
    }))
  }

  /** Describes the current answer identifiers and correct choices for each Question page. */
  private currentQuestions(document: LearningDocument): Map<string, Readonly<{
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
  private isQuestionAnswerCompatible(
    answer: QuestionAnswerState,
    answerIds: readonly string[],
    correctAnswerIds: readonly string[],
  ): boolean {
    return Array.isArray(answer.answerIds) && Array.isArray(answer.selectedAnswerIds)
      && Array.isArray(answer.expectedAnswerIds)
      && this.sameIdSet(answer.answerIds, answerIds)
      && this.sameIdSet(answer.expectedAnswerIds, correctAnswerIds)
      && answer.selectedAnswerIds.every((id) => answerIds.includes(id))
      && answer.isCorrect === this.sameIdSet(answer.selectedAnswerIds, correctAnswerIds)
  }

  /** Reconciles Evaluation attempts while preserving every still-compatible answer. */
  private reconcileEvaluations(
    document: LearningDocument,
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
      const settings = this.evaluationSettings(chapter)
      const answers = Object.fromEntries(Object.entries(state.context.answers).flatMap(([pageId, answer]) => {
        const current = questions.get(pageId)
        return current !== undefined && this.isEvaluationAnswerCompatible(answer, pageId, current.answerIds, current.correctAnswerIds)
          ? [[pageId, answer]]
          : []
      }))
      const sameQuestions = this.sameIdSet(state.context.questionIds, questionIds)
      const sameAnswers = JSON.stringify(state.context.answers) === JSON.stringify(answers)
      const sameSettings = JSON.stringify(state.context.settings) === JSON.stringify(settings)
      if (sameQuestions && sameAnswers && sameSettings) {
        result[chapterId] = state
        continue
      }
      changed = true
      result[chapterId] = this.reconciledEvaluationState(state, questionIds, settings, answers)
    }
    return changed ? result : saved
  }

  /** Keeps an Evaluation attempt open for missing answers or recomputes its result. */
  private reconciledEvaluationState(
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
      return [pageId, answer !== undefined && this.sameIdSet(answer.selectedAnswerIds, answer.expectedAnswerIds)]
    }))
    const result = chapterEvaluation.evaluate(questionIds, results, settings.threshold)
    return {
      value: result.passed === true ? 'success' : 'failure',
      context: { ...context, questionIds, activeQuestionIds: [], settings, answers, result },
    }
  }

  /** Validates a saved Evaluation answer against the current stable identities. */
  private isEvaluationAnswerCompatible(
    answer: EvaluationAnswer,
    questionId: string,
    answerIds: readonly string[],
    correctAnswerIds: readonly string[],
  ): boolean {
    return Array.isArray(answer.answerIds) && Array.isArray(answer.selectedAnswerIds)
      && Array.isArray(answer.expectedAnswerIds)
      && answer.questionId === questionId
      && this.sameIdSet(answer.answerIds, answerIds)
      && this.sameIdSet(answer.expectedAnswerIds, correctAnswerIds)
      && answer.selectedAnswerIds.every((id) => answerIds.includes(id))
  }

  /** Reads the current chapter's effective threshold and retry settings. */
  private evaluationSettings(chapter: LearningDocument['chapters'][number]): EvaluationSettings {
    return {
      threshold: chapter.evaluationThreshold ?? DEFAULT_EVALUATION_THRESHOLD,
      attemptLimit: chapter.evaluationAttemptLimit === undefined
        ? DEFAULT_EVALUATION_SETTINGS.attemptLimit
        : chapter.evaluationAttemptLimit,
      retryScope: chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope,
    }
  }

  /** Compares two answer-id arrays as sets while rejecting duplicate identities. */
  private sameIdSet(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && new Set(left).size === left.length
      && new Set(right).size === right.length && left.every((id) => right.includes(id))
  }

  /** Checks whether a context value is a non-array record. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  /** Returns string identifiers carried by a validated Question event. */
}

export const learningTestStateService = new LearningTestStateService()

/** Validates the versioned test-state shape before it reaches persistence. */
function isProjectTestState(value: unknown): value is ProjectTestState {
  if (!isRecordValue(value) || value.schemaVersion !== 1 || typeof value.profileEnabled !== 'boolean'
    || typeof value.profileSubmitted !== 'boolean') return false
  if (!isRecordValue(value.profileValues) || !isStringArray(value.finishedPageIds)) return false
  if (!isStringValueRecord(value.profileValues) || !isAnswerRecord(value.questionAnswers)) return false
  if (!isRecordValue(value.evaluationStates)) return false
  return Object.values(value.evaluationStates).every((entry) => isEvaluationState(entry))
}

/** Accepts profile strings, finite numbers and arrays of stable choice ids. */
function isStringValueRecord(value: Record<string, unknown>): boolean {
  return Object.values(value).every((entry) => typeof entry === 'string'
    || typeof entry === 'number' && Number.isFinite(entry)
    || isStringArray(entry))
}

/** Validates persisted Question selections and their current expected answers. */
function isAnswerRecord(value: unknown): boolean {
  return isRecordValue(value) && Object.values(value).every((entry) => isAnswerState(entry))
}

/** Validates one serialized answer result. */
function isAnswerState(value: unknown): boolean {
  return isRecordValue(value) && isStringArray(value.answerIds)
    && isStringArray(value.selectedAnswerIds)
    && isStringArray(value.expectedAnswerIds) && typeof value.isCorrect === 'boolean'
}

/** Validates one chapter evaluation snapshot. */
function isEvaluationState(value: unknown): boolean {
  if (!isRecordValue(value) || !['ready', 'attempting', 'success', 'failure', 'reviewing'].includes(String(value.value))
    || !isRecordValue(value.context)) return false
  const context = value.context
  if (!isStringArray(context.questionIds) || !isStringArray(context.activeQuestionIds)
    || !isRecordValue(context.settings) || !isEvaluationAnswerRecord(context.answers)) return false
  if (typeof context.attempt !== 'number' || !Number.isSafeInteger(context.attempt) || context.attempt < 0) return false
  const settings = context.settings
  if (typeof settings.threshold !== 'number' || !Number.isFinite(settings.threshold)
    || settings.attemptLimit !== null && (typeof settings.attemptLimit !== 'number' || !Number.isSafeInteger(settings.attemptLimit) || settings.attemptLimit < 1)
    || settings.retryScope !== 'all' && settings.retryScope !== 'incorrect') return false
  if (context.result === null) return true
  return isRecordValue(context.result)
    && typeof context.result.questionCount === 'number'
    && typeof context.result.correctCount === 'number'
    && (context.result.score === null || typeof context.result.score === 'number')
    && (context.result.passed === null || typeof context.result.passed === 'boolean')
}

/** Validates the machine's portable answer map independently from reader answers. */
function isEvaluationAnswerRecord(value: unknown): boolean {
  return isRecordValue(value) && Object.entries(value).every(([questionId, entry]) => isRecordValue(entry)
    && entry.questionId === questionId
    && isStringArray(entry.answerIds)
    && isStringArray(entry.selectedAnswerIds)
    && isStringArray(entry.expectedAnswerIds))
}

/** Checks whether an unknown object is a non-array JSON record. */
function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks whether every array member is a string. */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

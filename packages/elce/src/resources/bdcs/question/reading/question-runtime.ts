import type { StrapExecutionInput, StrapRuntimeOutput } from 'codplay/runtime/player'
import type { CompiledRecord } from 'codplay/scene/compiled'
import { QUESTION_EVENTS, QUESTION_TYPE } from '../question-config'
import type { QuestionType } from '../domain/question-types'
import { ElceQuestionService } from '../domain/question-service'

export const ELCE_QUESTION_RUNTIME_KEY = 'elceQuestionRuntime'
const questionService = new ElceQuestionService()

export type QuestionRuntimeConfiguration = Readonly<{
  pageId: string
  bdcId: string
  prefix: string
  questionType: QuestionType
  title: string
  prompt: string
  answerIds: readonly string[]
  answerLabels: readonly string[]
  correctAnswerIds: readonly string[]
  selection: 'single' | 'multiple'
  completionEventName?: string
  completionEventData?: CompiledRecord
}>

/** Selects an answer from the configuration carried by the current story state. */
export function selectQuestionAnswerStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readQuestionConfiguration(input.state)
  const answerId = input.event.data?.answerId
  if (configuration === undefined || input.state.submitted === true || typeof answerId !== 'string') return undefined
  const previous = readQuestionSelection(input.state.selectedAnswerIds)
  const selectedAnswerIds = questionService.selectAnswer(
    configuration.answerIds,
    configuration.selection,
    previous,
    answerId,
  )
  if (selectedAnswerIds === previous) return undefined
  const selected = new Set(selectedAnswerIds)
  return {
    update: { selectedAnswerIds },
    events: [
      { name: selectedAnswerIds.length > 0 ? `${configuration.prefix}:selection:available` : `${configuration.prefix}:selection:empty` },
      ...configuration.answerIds.map((id) => ({
        name: `${configuration.prefix}:answer:${id}:${selected.has(id) ? 'selected' : 'idle'}`,
      })),
    ],
  }
}

/** Validates the current answer and emits the page's public completion events. */
export function validateQuestionAnswerStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readQuestionConfiguration(input.state)
  const selectedAnswerIds = readQuestionSelection(input.state.selectedAnswerIds)
  if (configuration === undefined || input.state.submitted === true || selectedAnswerIds.length === 0) return undefined

  const answerState = questionService.validateAnswer(
    configuration.answerIds,
    configuration.correctAnswerIds,
    selectedAnswerIds,
  )
  const correctAnswerIds = answerState.expectedAnswerIds
  const isCorrect = answerState.isCorrect
  const selected = new Set(selectedAnswerIds)
  const correct = new Set(correctAnswerIds)
  return {
    update: { selectedAnswerIds, submitted: true },
    events: [
      {
        name: `${configuration.prefix}:feedback`,
        data: {
          content: isCorrect ? 'Bonne réponse.' : 'Réponse incorrecte.',
          attr: { hidden: false },
          className: `elce-question-feedback elce-question-feedback--${isCorrect ? 'correct' : 'incorrect'}`,
        },
      },
      { name: `${configuration.prefix}:resolved` },
      ...configuration.answerIds.map((id) => ({
        name: `${configuration.prefix}:answer:${id}:${selected.has(id)
          ? correct.has(id) ? 'revealed-correct' : 'revealed-incorrect'
          : correct.has(id) ? 'revealed-missed-correct' : 'locked'}`,
      })),
      {
        name: QUESTION_EVENTS.ANSWERED,
        data: {
          pageId: configuration.pageId,
          bdcId: configuration.bdcId,
          questionType: configuration.questionType,
          isCorrect,
          answerIds: configuration.answerIds,
          answerLabels: configuration.answerLabels,
          selectedAnswerIds,
          expectedAnswerIds: correctAnswerIds,
          description: [configuration.title, configuration.prompt]
            .filter((text) => text.trim().length > 0)
            .join(' '),
        },
        visibility: 'public',
      },
      ...(configuration.completionEventName === undefined ? [] : [{
        name: configuration.completionEventName,
        ...(configuration.completionEventData === undefined ? {} : { data: configuration.completionEventData }),
        visibility: 'public' as const,
      }]),
    ],
  }
}

/** Clears the current Question selection and correction using story state. */
export function resetQuestionStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readQuestionConfiguration(input.state)
  if (configuration === undefined) return undefined
  return {
    update: { selectedAnswerIds: [], submitted: false },
    events: [
      { name: `${configuration.prefix}:selection:empty` },
      ...configuration.answerIds.map((id) => ({ name: `${configuration.prefix}:answer:${id}:reset` })),
      { name: `${configuration.prefix}:feedback`, data: { content: '', attr: { hidden: true } } },
    ],
  }
}

/** Restores an already recorded answer without publishing another submission. */
export function restoreQuestionStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readQuestionConfiguration(input.state)
  const selectedAnswerIds = readQuestionSelection(input.event.data?.selectedAnswerIds)
  if (configuration === undefined || input.state.submitted === true || selectedAnswerIds.length === 0) return undefined
  const selected = new Set(selectedAnswerIds)
  const correct = new Set(configuration.correctAnswerIds)
  const isCorrect = questionService.sameAnswerSet(configuration.correctAnswerIds, selectedAnswerIds)
  return {
    update: { selectedAnswerIds, submitted: true },
    events: [
      {
        name: `${configuration.prefix}:feedback`,
        data: {
          content: isCorrect ? 'Bonne réponse.' : 'Réponse incorrecte.',
          attr: { hidden: false },
          className: `elce-question-feedback elce-question-feedback--${isCorrect ? 'correct' : 'incorrect'}`,
        },
      },
      { name: `${configuration.prefix}:resolved` },
      ...configuration.answerIds.map((id) => ({
        name: `${configuration.prefix}:answer:${id}:${selected.has(id)
          ? correct.has(id) ? 'revealed-correct' : 'revealed-incorrect'
          : correct.has(id) ? 'revealed-missed-correct' : 'locked'}`,
      })),
    ],
  }
}

/** Validates the compact Question parameters supplied by the builder in story state. */
function readQuestionConfiguration(state: Readonly<Record<string, unknown>>): QuestionRuntimeConfiguration | undefined {
  const value = state[ELCE_QUESTION_RUNTIME_KEY]
  if (!isRecord(value)
    || typeof value.pageId !== 'string'
    || typeof value.bdcId !== 'string'
    || typeof value.prefix !== 'string'
    || (value.questionType !== QUESTION_TYPE.TRUE_FALSE
      && value.questionType !== QUESTION_TYPE.CHOICE
      && value.questionType !== QUESTION_TYPE.MULTIPLE_CHOICE)
    || typeof value.title !== 'string'
    || typeof value.prompt !== 'string'
    || !isStringArray(value.answerIds)
    || !isStringArray(value.answerLabels)
    || value.answerLabels.length !== value.answerIds.length
    || !isStringArray(value.correctAnswerIds)
    || (value.selection !== 'single' && value.selection !== 'multiple')
    || (value.completionEventName !== undefined && typeof value.completionEventName !== 'string')
    || (value.completionEventData !== undefined && !isRecord(value.completionEventData))) {
    return undefined
  }
  return value as QuestionRuntimeConfiguration
}

/** Reads only string identifiers from one CodPlay state value. */
function readQuestionSelection(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

/** Compares answer sets without treating response order as correctness. */
/** Checks a non-array object received from serialized scene state. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks a string list received from serialized scene state. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS, QUESTION_DEFAULTS, QUESTION_TYPE_CONFIG } from '../config/document-config'
import type { Bdc } from '../domain/document-types'
import type { QuestionAnswer, QuestionContent } from '../domain/question-types'

type QuestionStoryState = Readonly<{
  readonly selectedAnswerIds: readonly string[]
  readonly submitted: boolean
}>

/** Builds the shared interactive CodPlay story for one Question BDC. */
export function buildQuestionBdcStory(
  pageId: string,
  bdc: Bdc,
  zones: Readonly<Record<string, string>>,
  completionEventName?: string,
  completionEventData?: Readonly<Record<string, unknown>>,
): StoryDoc<string> {
  const question = bdc.question
  if (question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
  const prefix = `${pageId}:${bdc.id}`
  const title = question.title.trim().length > 0
    ? [createQuestionTextPerso(`${prefix}:title`, 'h2', question.title, requireQuestionZone(zones, 'title', bdc.id))]
    : []
  const prompt = createQuestionTextPerso(`${prefix}:prompt`, 'span', question.prompt, requireQuestionZone(zones, 'question', bdc.id))
  const answersZone = requireQuestionZone(zones, 'answers', bdc.id)
  const instructions = createQuestionTextPerso(
    `${prefix}:instructions`,
    'p',
    QUESTION_TYPE_CONFIG[question.type].instruction,
    answersZone,
    'elce-question-instructions',
  )
  const resetEvent = `${prefix}:reset`
  const validationZone = requireQuestionZone(zones, 'validation', bdc.id)
  const answerPersos = question.answers.map((answer) => createQuestionAnswerPerso(pageId, bdc, prefix, answer, question, answersZone))
  return {
    id: `${pageId}-${bdc.id}`,
    state: { selectedAnswerIds: [], submitted: false } satisfies QuestionStoryState,
    straps: {
      [`${prefix}:select-answer`]: ({ event, state }) => selectQuestionAnswer(prefix, question, state, event.data),
      [`${prefix}:validate-answer`]: ({ state }) => validateQuestionAnswer(
        pageId,
        bdc,
        prefix,
        question,
        state,
        completionEventName,
        completionEventData,
      ),
      [`${prefix}:reset-question`]: ({ state }) => resetQuestion(prefix, question, state),
    },
    listen: [
      { on: `${prefix}:answer:select`, straps: [`${prefix}:select-answer`] },
      { on: `${prefix}:validate`, straps: [`${prefix}:validate-answer`] },
      { on: resetEvent, straps: [`${prefix}:reset-question`] },
    ],
    persos: [
      ...title,
      prompt,
      instructions,
      ...answerPersos,
      createQuestionValidatePerso(bdc.id, prefix, validationZone),
      createQuestionFeedbackPerso(bdc.id, prefix, validationZone),
    ],
  }
}

/** Creates a plain-text perso for one fixed Question card zone. */
function createQuestionTextPerso(id: string, tag: string, content: string, target: string, className?: string): PersoDoc<string> {
  return {
    id,
    type: 'tag',
    initial: {
      tag,
      content,
      ...(className === undefined ? {} : { className }),
      move: { target },
    },
  }
}

/** Resolves a fixed zone emitted by the selected Question card preset. */
function requireQuestionZone(zones: Readonly<Record<string, string>>, zoneName: string, bdcId: string): string {
  const zoneId = zones[zoneName]
  if (zoneId === undefined) throw new Error(`La zone ${zoneName} manque au preset du bdc Question ${bdcId}.`)
  return zoneId
}

/** Creates one native CodPlay input with explicit selection and correction actions. */
function createQuestionAnswerPerso(
  pageId: string,
  bdc: Bdc,
  prefix: string,
  answer: QuestionAnswer,
  question: QuestionContent,
  answersZone: string,
): PersoDoc<string> {
  const correctAnswerIds = question.answers.filter((candidate) => candidate.correct).map((candidate) => candidate.id)
  return {
    id: `${pageId}-${bdc.id}-answer-${answer.id}`,
    type: 'input',
    initial: {
      inputType: QUESTION_TYPE_CONFIG[question.type].inputType,
      name: `${prefix}:answer-group`,
      value: answer.id,
      label: answer.label,
      hint: '',
      checked: false,
      disabled: false,
      visualState: 'idle',
      selectionIcon: { className: 'elce-question-answer__selection' },
      correctionIcon: {
        className: 'elce-question-answer__correction',
        correctContent: '✓',
        incorrectContent: '×',
        missedCorrectContent: '✓',
      },
      move: { target: answersZone },
    },
    emit: { change: { event: { name: `${prefix}:answer:select`, data: { answerId: answer.id } } } },
    actions: {
      [`${prefix}:answer:${answer.id}:selected`]: { selectedAnswerIds: [answer.id], checked: true, visualState: 'selected' },
      [`${prefix}:answer:${answer.id}:idle`]: { selectedAnswerIds: [], checked: false, visualState: 'idle' },
      [`${prefix}:answer:${answer.id}:reset`]: {
        selectedAnswerIds: [], correctAnswerIds: [], checked: false, disabled: false,
        disableAnswers: false, showCorrection: false, visualState: 'idle',
      },
      [`${prefix}:answer:${answer.id}:revealed-correct`]: {
        selectedAnswerIds: [answer.id], correctAnswerIds, checked: true, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'revealed-correct',
      },
      [`${prefix}:answer:${answer.id}:revealed-incorrect`]: {
        selectedAnswerIds: [answer.id], correctAnswerIds, checked: true, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'revealed-incorrect',
      },
      [`${prefix}:answer:${answer.id}:revealed-missed-correct`]: {
        selectedAnswerIds: [], correctAnswerIds, checked: false, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'revealed-missed-correct',
      },
      [`${prefix}:answer:${answer.id}:locked`]: {
        selectedAnswerIds: [], correctAnswerIds, checked: false, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'disabled',
      },
    },
  }
}

/** Creates the validate action in the preset's validation zone. */
function createQuestionValidatePerso(bdcId: string, prefix: string, target: string): PersoDoc<string> {
  return {
    id: `${bdcId}-validate`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: QUESTION_DEFAULTS.VALIDATE_LABEL,
      attr: { type: 'button', disabled: true },
      className: 'elce-question-validate',
      move: { target },
    },
    emit: { click: { event: { name: `${prefix}:validate` } } },
    actions: {
      [`${prefix}:selection:available`]: { attr: { type: 'button', disabled: false } },
      [`${prefix}:selection:empty`]: { attr: { type: 'button', disabled: true } },
      [`${prefix}:resolved`]: { attr: { type: 'button', disabled: true } },
    },
  }
}

/** Creates the live result text beneath the Question validation button. */
function createQuestionFeedbackPerso(bdcId: string, prefix: string, target: string): PersoDoc<string> {
  return {
    id: `${bdcId}-feedback`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: '',
      attr: { hidden: true, 'aria-live': 'polite' },
      className: 'elce-question-feedback',
      move: { target },
    },
    actions: { [`${prefix}:feedback`]: {} },
  }
}

/** Applies a reader's answer selection and updates every CodPlay input perso. */
function selectQuestionAnswer(
  prefix: string,
  question: QuestionContent,
  state: Readonly<Record<string, unknown>>,
  data: Record<string, unknown> | undefined,
) {
  if (state.submitted === true || typeof data?.answerId !== 'string') return undefined
  if (!question.answers.some((answer) => answer.id === data.answerId)) return undefined
  const previous = readQuestionSelection(state.selectedAnswerIds)
  let selectedAnswerIds: readonly string[]
  switch (QUESTION_TYPE_CONFIG[question.type].selection) {
    case 'single':
      selectedAnswerIds = [data.answerId]
      break
    case 'multiple':
      selectedAnswerIds = previous.includes(data.answerId)
        ? previous.filter((id) => id !== data.answerId)
        : [...previous, data.answerId]
      break
  }
  const selected = new Set(selectedAnswerIds)
  return {
    update: { selectedAnswerIds },
    events: [
      { name: selectedAnswerIds.length > 0 ? `${prefix}:selection:available` : `${prefix}:selection:empty` },
      ...question.answers.map((answer) => ({ name: `${prefix}:answer:${answer.id}:${selected.has(answer.id) ? 'selected' : 'idle'}` })),
    ],
  }
}

/** Resolves a Question, reveals its correction, and reports completion and result. */
function validateQuestionAnswer(
  pageId: string,
  bdc: Bdc,
  prefix: string,
  question: QuestionContent,
  state: Readonly<Record<string, unknown>>,
  completionEventName?: string,
  completionEventData?: Readonly<Record<string, unknown>>,
) {
  const selectedAnswerIds = readQuestionSelection(state.selectedAnswerIds)
  if (state.submitted === true || selectedAnswerIds.length === 0) return undefined
  const correctAnswerIds = question.answers.filter((answer) => answer.correct).map((answer) => answer.id)
  const isCorrect = sameQuestionAnswerSet(correctAnswerIds, selectedAnswerIds)
  const selected = new Set(selectedAnswerIds)
  const correct = new Set(correctAnswerIds)
  return {
    update: { selectedAnswerIds, submitted: true },
    events: [
      {
        name: `${prefix}:feedback`,
        data: {
          content: isCorrect ? 'Bonne réponse.' : 'Réponse incorrecte.',
          attr: { hidden: false },
          style: { color: isCorrect ? '#166534' : '#b42318', fontWeight: 700 },
        },
      },
      { name: `${prefix}:resolved` },
      ...question.answers.map((answer) => ({
        name: `${prefix}:answer:${answer.id}:${selected.has(answer.id)
          ? correct.has(answer.id) ? 'revealed-correct' : 'revealed-incorrect'
          : correct.has(answer.id) ? 'revealed-missed-correct' : 'locked'}`,
      })),
      {
        name: ELCE_EVENTS.QUESTION_ANSWERED,
        data: { pageId, bdcId: bdc.id, isCorrect },
        visibility: 'public',
      },
      ...(completionEventName === undefined ? [] : [{
        name: completionEventName,
        ...(completionEventData === undefined ? {} : { data: completionEventData }),
        visibility: 'public' as const,
      }]),
    ],
  }
}

/** Resets local selection and validation state when Sighty replays a page. */
function resetQuestion(prefix: string, question: QuestionContent, _state: Readonly<Record<string, unknown>>) {
  return {
    update: { selectedAnswerIds: [], submitted: false },
    events: [
      { name: `${prefix}:selection:empty` },
      ...question.answers.map((answer) => ({ name: `${prefix}:answer:${answer.id}:reset` })),
      { name: `${prefix}:feedback`, data: { content: '', attr: { hidden: true } } },
    ],
  }
}

/** Accepts only string identifiers from a CodPlay state value. */
function readQuestionSelection(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
}

/** Compares answer sets without treating response order as correctness. */
function sameQuestionAnswerSet(expected: readonly string[], actual: readonly string[]): boolean {
  if (expected.length !== actual.length) return false
  const expectedSet = new Set(expected)
  return actual.every((id) => expectedSet.has(id))
}

import type { SceneDoc } from 'codplay/scene/types'
import type { CompiledRecord } from 'codplay'
import type { CoursePage, CourseQuestion } from '../course-data'
import { COURSE_EVENTS } from '../messages'
import {
  createPageBottomMarker,
  createPageScrollPort,
  type CoursePerso,
  pageBottomPartId,
  pageScrollPortId,
} from './page-support'

type QuizState = Readonly<{
  question: CourseQuestion
  selectedAnswerIds: readonly string[]
  submitted: boolean
  solutionsExposed: boolean
}>

/** Builds one independent quiz scene using CodPlay input, listen, and straps. */
export function createQuizPageScene(page: CoursePage): SceneDoc<string> {
  if (page.kind !== 'quiz' || page.question === undefined) {
    throw new Error(`La page ${page.id} n’est pas une question de quiz.`)
  }

  const prefix = `course-quiz:${page.id}`
  const persos: CoursePerso[] = [
    createPageScrollPort(page.id),
    createQuizArticle(page, prefix),
    createQuestionPrompt(page, prefix),
    createQuestionInstructions(page, prefix),
    ...createAnswerPersos(page, prefix),
    createValidateButton(page, prefix),
    createQuestionFeedback(page, prefix),
    createPageBottomMarker(page.id),
  ]

  return {
    id: `sighty-demo5-${page.id}`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        state: {
          question: page.question,
          selectedAnswerIds: [],
          submitted: false,
          solutionsExposed: false,
        } satisfies QuizState,
        straps: {
          'course-quiz-select-answer': ({ event, state }) =>
            selectQuizAnswer(prefix, page.question!, state, event.data),
          'course-quiz-validate-answer': ({ state }) =>
            validateQuizAnswer(page, prefix, state),
          'course-quiz-replay-reset': ({ event, state }) =>
            applyQuizReplayReset(page, prefix, state, event.data),
        },
        listen: [
          { on: `${prefix}:answer:select`, straps: ['course-quiz-select-answer'] },
          { on: `${prefix}:validate`, straps: ['course-quiz-validate-answer'] },
          { on: `${prefix}:reset`, straps: ['course-quiz-replay-reset'] },
        ],
        persos,
      },
    },
  }
}

/** Creates the question wrapper and its explicit answer, feedback, and end parts. */
function createQuizArticle(page: CoursePage, prefix: string): CoursePerso {
  const answersPart = `${prefix}:answers`
  const promptPart = `${prefix}:prompt`
  const instructionsPart = `${prefix}:instructions`
  const controlsPart = `${prefix}:controls`
  const feedbackPart = `${prefix}:feedback`

  return {
    id: `${page.id}-quiz-article`,
    type: 'layout',
    initial: {
      move: { target: pageScrollPortId(page.id) },
      className: 'demo5-quiz__article',
      style: {
        display: 'flex',
        minHeight: 'calc(100% + 8rem)',
        flexDirection: 'column',
        padding: 'clamp(1rem, 3vw, 2rem)',
        boxSizing: 'border-box',
      },
      markup: `<article id="${page.id}-quiz-article-root" class="demo5-quiz__article">
        <form id="${page.id}-quiz-form" class="demo5-quiz__form">
          <fieldset id="${page.id}-quiz-fieldset" class="demo5-quiz__fieldset">
            <legend id="${page.id}-quiz-prompt" data-part="${promptPart}"></legend>
            <div id="${page.id}-quiz-instructions" class="demo5-quiz__instructions" data-part="${instructionsPart}"></div>
            <div id="${page.id}-quiz-answers" class="demo5-quiz__answers" data-part="${answersPart}"></div>
            <div id="${page.id}-quiz-controls" class="demo5-quiz__controls" data-part="${controlsPart}"></div>
            <div id="${page.id}-quiz-feedback" class="demo5-quiz__feedback" aria-live="polite" data-part="${feedbackPart}"></div>
          </fieldset>
        </form>
        <div id="${page.id}-quiz-bottom-host" class="demo5-page__bottom-host" data-part="${pageBottomPartId(page.id)}"></div>
      </article>`,
    },
  }
}

/** Creates the question and its concise response instructions. */
function createQuestionPrompt(page: CoursePage, prefix: string): CoursePerso {
  const question = page.question!
  return {
    id: `${page.id}-quiz-prompt-text`,
    type: 'tag',
    initial: {
      tag: 'span',
      content: question.prompt,
      className: 'demo5-quiz__prompt',
      move: { target: `${prefix}:prompt` },
    },
    actions: {},
  }
}

/** Creates the short answer-selection instructions beneath the question. */
function createQuestionInstructions(page: CoursePage, prefix: string): CoursePerso {
  const instruction = page.question!.type === 'multiple'
    ? 'Plusieurs réponses sont possibles. Sélectionnez-les, puis validez.'
    : 'Sélectionnez une réponse, puis validez.'
  return {
    id: `${page.id}-quiz-instructions-text`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: instruction,
      className: 'demo5-quiz__instructions',
      move: { target: `${prefix}:instructions` },
    },
  }
}

/** Creates all radio or checkbox answer persos for this standalone question. */
function createAnswerPersos(page: CoursePage, prefix: string): CoursePerso[] {
  return page.question!.answers.map((answer) => createAnswerPerso(page, prefix, answer.id, answer.label))
}

/** Creates one CodPlay input and its selected, idle, and correction actions. */
function createAnswerPerso(page: CoursePage, prefix: string, answerId: string, label: string): CoursePerso {
  const question = page.question!
  const correctAnswerIds = [...question.correctAnswerIds]
  const multiSelect = question.type === 'multiple'
  return {
    id: `${page.id}-quiz-answer-${answerId}`,
    type: 'input',
    initial: {
      inputType: multiSelect ? 'checkbox' : 'radio',
      name: `${page.id}-quiz-answer-group`,
      value: answerId,
      label,
      hint: '',
      checked: false,
      disabled: false,
      visualState: 'idle',
      selectionIcon: { className: 'demo5-quiz__selection-icon' },
      correctionIcon: {
        className: 'demo5-quiz__correction-icon',
        correctContent: '✓',
        incorrectContent: '×',
        missedCorrectContent: '✓',
      },
      move: { target: `${prefix}:answers` },
    },
    emit: {
      change: { event: { name: `${prefix}:answer:select`, data: { answerId } } },
    },
    actions: {
      [`${prefix}:answer:${answerId}:selected`]: {
        selectedAnswerIds: [answerId],
        checked: true,
        visualState: 'selected',
      },
      [`${prefix}:answer:${answerId}:idle`]: {
        selectedAnswerIds: [],
        checked: false,
        visualState: 'idle',
      },
      [`${prefix}:answer:${answerId}:reset`]: {
        selectedAnswerIds: [],
        correctAnswerIds: [],
        checked: false,
        disabled: false,
        disableAnswers: false,
        showCorrection: false,
        visualState: 'idle',
      },
      [`${prefix}:answer:${answerId}:revealed-correct`]: {
        selectedAnswerIds: [answerId],
        correctAnswerIds,
        checked: true,
        disabled: true,
        disableAnswers: true,
        showCorrection: true,
        visualState: 'revealed-correct',
      },
      [`${prefix}:answer:${answerId}:revealed-incorrect`]: {
        selectedAnswerIds: [answerId],
        correctAnswerIds,
        checked: true,
        disabled: true,
        disableAnswers: true,
        showCorrection: true,
        visualState: 'revealed-incorrect',
      },
      [`${prefix}:answer:${answerId}:revealed-missed-correct`]: {
        selectedAnswerIds: [],
        correctAnswerIds,
        checked: false,
        disabled: true,
        disableAnswers: true,
        showCorrection: true,
        visualState: 'revealed-missed-correct',
      },
      [`${prefix}:answer:${answerId}:locked`]: {
        selectedAnswerIds: [],
        correctAnswerIds,
        checked: false,
        disabled: true,
        disableAnswers: true,
        showCorrection: true,
        visualState: 'disabled',
      },
    },
  }
}

/** Creates the validation button and its enabled/disabled result states. */
function createValidateButton(page: CoursePage, prefix: string): CoursePerso {
  return {
    id: `${page.id}-quiz-validate`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Valider la réponse',
      attr: { type: 'button', disabled: true },
      className: 'demo5-quiz__validate',
      move: { target: `${prefix}:controls` },
    },
    emit: { click: { event: { name: `${prefix}:validate` } } },
    actions: {
      [`${prefix}:selection:available`]: { attr: { type: 'button', disabled: false } },
      [`${prefix}:selection:empty`]: { attr: { type: 'button', disabled: true } },
      [`${prefix}:resolved`]: { attr: { type: 'button', disabled: true } },
    },
  }
}

/** Creates the accessible feedback node for one question result. */
function createQuestionFeedback(page: CoursePage, prefix: string): CoursePerso {
  return {
    id: `${page.id}-quiz-feedback`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: '',
      attr: { hidden: true },
      className: 'demo5-quiz__feedback-text',
      move: { target: `${prefix}:feedback` },
    },
    actions: {
      [`${prefix}:feedback`]: null,
    },
  }
}

/** Updates the selected answer and emits the input actions for every option. */
function selectQuizAnswer(
  prefix: string,
  question: CourseQuestion,
  state: Readonly<Record<string, unknown>>,
  eventData: Record<string, unknown> | undefined,
) {
  const payload = eventData as { answerId?: unknown } | undefined
  if (state.submitted === true || state.solutionsExposed === true || typeof payload?.answerId !== 'string') return undefined
  if (!question.answers.some((answer) => answer.id === payload.answerId)) return undefined

  const selectedBefore = readSelectedAnswers(state.selectedAnswerIds)
  const selectedAnswerIds = question.type === 'multiple'
    ? selectedBefore.includes(payload.answerId)
      ? selectedBefore.filter((answerId) => answerId !== payload.answerId)
      : [...selectedBefore, payload.answerId]
    : [payload.answerId]
  const selected = new Set(selectedAnswerIds)
  return {
    update: { selectedAnswerIds },
    events: [
      { name: selectedAnswerIds.length > 0 ? `${prefix}:selection:available` : `${prefix}:selection:empty` },
      ...question.answers.map((answer) => ({
        name: `${prefix}:answer:${answer.id}:${selected.has(answer.id) ? 'selected' : 'idle'}`,
      })),
    ],
  }
}

/** Resolves the selected set, displays correction, and publishes the quiz result. */
function validateQuizAnswer(
  page: CoursePage,
  prefix: string,
  state: Readonly<Record<string, unknown>>,
) {
  const question = page.question!
  const selectedAnswerIds = readSelectedAnswers(state.selectedAnswerIds)
  if (state.submitted === true || state.solutionsExposed === true || selectedAnswerIds.length === 0) return undefined

  const isCorrect = hasSameAnswerSet([...question.correctAnswerIds], selectedAnswerIds)
  const feedbackMessage = page.id === 'chapter-1-quiz'
    ? isCorrect
      ? 'Bonne réponse ! Le chapitre 2 est maintenant accessible.'
      : 'Réponse incorrecte. Revenez au début du chapitre depuis le menu pour revoir les notions.'
    : isCorrect
      ? 'Bonne réponse.'
      : 'Réponse incorrecte.'
  const events: Array<{ name: string; data?: CompiledRecord; visibility?: 'public' }> = [
    {
      name: `${prefix}:feedback`,
      data: {
        content: feedbackMessage,
        attr: { hidden: false },
        style: { color: isCorrect ? '#166534' : '#b42318', fontWeight: 700 },
      },
    },
    { name: `${prefix}:resolved` },
    ...createAnswerResolutionEvents(question, prefix, selectedAnswerIds),
    {
      name: COURSE_EVENTS.quizAnswered,
      data: { pageId: page.id, isCorrect },
      visibility: 'public',
    },
  ]

  return {
    update: { selectedAnswerIds, submitted: true },
    events,
  }
}

/** Applies requested quiz reset and solution exposure effects in one scene event. */
function applyQuizReplayReset(
  page: CoursePage,
  prefix: string,
  state: Readonly<Record<string, unknown>>,
  eventData: Record<string, unknown> | undefined,
) {
  const question = page.question!
  const keys = Array.isArray(eventData?.keys)
    ? eventData.keys.filter((key): key is string => typeof key === 'string')
    : []
  const shouldResetQuiz = keys.includes('all') || keys.includes('quiz')
  const shouldExposeSolutions = keys.includes('solutions')
  if (!shouldResetQuiz && !shouldExposeSolutions) return undefined

  const selectedAnswerIds = shouldResetQuiz
    ? []
    : readSelectedAnswers(state.selectedAnswerIds)
  const events: Array<{ name: string; data?: CompiledRecord }> = []
  if (shouldResetQuiz) {
    events.push(
      { name: `${prefix}:selection:empty` },
      ...question.answers.map((answer) => ({ name: `${prefix}:answer:${answer.id}:reset` })),
      { name: `${prefix}:feedback`, data: { content: '', attr: { hidden: true } } },
    )
  }
  if (shouldExposeSolutions) {
    events.push(
      { name: `${prefix}:resolved` },
      ...createAnswerResolutionEvents(question, prefix, selectedAnswerIds),
    )
  }

  return {
    update: {
      ...(shouldResetQuiz ? { selectedAnswerIds, submitted: false } : {}),
      ...(shouldResetQuiz || shouldExposeSolutions
        ? { solutionsExposed: shouldExposeSolutions }
        : {}),
    },
    events,
  }
}

/** Returns the answer-state events for a participant's selection and corrections. */
function createAnswerResolutionEvents(
  question: CourseQuestion,
  prefix: string,
  selectedAnswerIds: readonly string[],
): Array<{ name: string }> {
  const selected = new Set(selectedAnswerIds)
  const correct = new Set(question.correctAnswerIds)
  return question.answers.map((answer) => {
    if (selected.has(answer.id) && correct.has(answer.id)) {
      return { name: `${prefix}:answer:${answer.id}:revealed-correct` }
    }
    if (selected.has(answer.id)) return { name: `${prefix}:answer:${answer.id}:revealed-incorrect` }
    if (correct.has(answer.id)) return { name: `${prefix}:answer:${answer.id}:revealed-missed-correct` }
    return { name: `${prefix}:answer:${answer.id}:locked` }
  })
}

/** Accepts only string ids from the runtime state snapshot. */
function readSelectedAnswers(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((answerId): answerId is string => typeof answerId === 'string') : []
}

/** Compares selected and correct ids without depending on their order. */
function hasSameAnswerSet(expectedIds: string[], actualIds: string[]): boolean {
  if (expectedIds.length !== actualIds.length) return false
  const expected = new Set(expectedIds)
  return actualIds.every((answerId) => expected.has(answerId))
}

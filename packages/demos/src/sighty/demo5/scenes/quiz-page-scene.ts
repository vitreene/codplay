import type { SceneDoc } from 'codplay/scene/types'
import type { CompiledRecord } from 'codplay'
import type { CoursePage, CourseQuestion } from '../course-data'
import { COURSE_EVENTS } from '../messages'
import {
  createQuizAnswerPersos,
  createQuizCorrectionEvents,
  createQuizLocalState,
  readSelectedQuizAnswers,
  resolveQuizAnswer,
  selectQuizAnswer,
  type QuizLocalState,
} from '../../shared/quiz/answer-circuit'
import {
  createPageBottomMarker,
  createPageScrollPort,
  type CoursePerso,
  pageBottomPartId,
  pageScrollPortId,
} from './page-support'

type QuizSceneState = QuizLocalState & Readonly<{ pageId: string }>

type QuizStoryEventInput = Readonly<{
  event: Readonly<{ data?: Record<string, unknown> }>
  state: Readonly<Record<string, unknown>>
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
    ...createQuizAnswerPersos(page.question, {
      persoPrefix: `${page.id}-quiz`,
      eventPrefix: prefix,
    }, {
      selectionIcon: 'demo5-quiz__selection-icon',
      correctionIcon: 'demo5-quiz__correction-icon',
    }),
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
        state: { ...createQuizLocalState(page.question), pageId: page.id },
        straps: {
          'course-quiz-select-answer': selectCourseQuizAnswer,
          'course-quiz-validate-answer': validateCourseQuizAnswer,
          'course-quiz-replay-reset': resetCourseQuizScene,
        },
        listen: [
          { on: `${prefix}:answer:select`, straps: ['course-quiz-select-answer'] },
          { on: `${prefix}:validate`, straps: ['course-quiz-validate-answer'] },
          { on: COURSE_EVENTS.quizReset, straps: ['course-quiz-replay-reset'] },
        ],
        persos,
      },
    },
  }
}

/** Selects an answer using the question and page id carried by scene state. */
function selectCourseQuizAnswer({ event, state }: QuizStoryEventInput) {
  const quiz = readQuizSceneState(state)
  if (quiz === undefined) return undefined
  return selectQuizAnswer(quizEventPrefix(quiz.pageId), quiz.question, state, event.data)
}

/** Validates a quiz answer using the question and page id carried by scene state. */
function validateCourseQuizAnswer({ state }: QuizStoryEventInput) {
  const quiz = readQuizSceneState(state)
  if (quiz === undefined) return undefined
  return validateQuizAnswer(quiz.pageId, quizEventPrefix(quiz.pageId), quiz.question, state)
}

/** Applies a generic Sighty reset to the quiz identified by scene-local state. */
function resetCourseQuizScene({ event, state }: QuizStoryEventInput) {
  const quiz = readQuizSceneState(state)
  if (quiz === undefined) return undefined
  return applyQuizReplayReset(quiz.question, quizEventPrefix(quiz.pageId), state, event.data)
}

/** Reads the immutable quiz definition and page id stored in one quiz story. */
function readQuizSceneState(state: Readonly<Record<string, unknown>>): QuizSceneState | undefined {
  if (typeof state.pageId !== 'string' || state.question === null || typeof state.question !== 'object') {
    return undefined
  }
  return state as QuizSceneState
}

/** Returns the event prefix shared by one quiz page's authored controls. */
function quizEventPrefix(pageId: string): string {
  return `course-quiz:${pageId}`
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

/** Resolves the selected set, displays correction, and publishes the quiz result. */
function validateQuizAnswer(
  pageId: string,
  prefix: string,
  question: CourseQuestion,
  state: Readonly<Record<string, unknown>>,
) {
  const resolution = resolveQuizAnswer(question, state)
  if (resolution === undefined) return undefined
  const { selectedAnswerIds, isCorrect } = resolution
  const feedbackMessage = pageId === 'chapter-1-quiz'
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
    ...createQuizCorrectionEvents(question, prefix, selectedAnswerIds),
    {
      name: COURSE_EVENTS.quizAnswered,
      data: { pageId, isCorrect },
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
  question: CourseQuestion,
  prefix: string,
  state: Readonly<Record<string, unknown>>,
  eventData: Record<string, unknown> | undefined,
) {
  const keys = Array.isArray(eventData?.keys)
    ? eventData.keys.filter((key): key is string => typeof key === 'string')
    : []
  const shouldResetQuiz = keys.includes('all') || keys.includes('quiz')
  const shouldExposeSolutions = keys.includes('solutions')
  if (!shouldResetQuiz && !shouldExposeSolutions) return undefined

  const selectedAnswerIds = shouldResetQuiz
    ? []
    : readSelectedQuizAnswers(state.selectedAnswerIds)
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
      ...createQuizCorrectionEvents(question, prefix, selectedAnswerIds),
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

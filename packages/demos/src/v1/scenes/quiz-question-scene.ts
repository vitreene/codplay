import type { StrapCollection } from "codplay-v1/player"
import type { PersoDoc, SceneDoc, SceneStoryDoc } from "codplay-v1/player/types"

export type QuizQuestionType = "boolean" | "single" | "multiple"

export type QuizAnswer = {
  id: string
  label: string
  isCorrect: boolean
}

export type QuizQuestionLabels = {
  validate: string
  next: string
  correct: string
  incorrect: string
  multipleHint: string
}

export type ResolvedQuizQuestion = {
  index: number
  type: QuizQuestionType
  prompt: string
  answers: QuizAnswer[]
  labels: QuizQuestionLabels
}

export type QuizQuestionStoryConfig = {
  showCorrection: boolean
  showResult: boolean
  maxRetries: number
  disableValidateAfterSubmit: boolean
}

export type QuizQuestionResolvedPayload = {
  questionIndex: number
  selectedAnswerIds: string[]
  correctAnswerIds: string[]
  isCorrect: boolean
}

export type QuizQuestionAnsweredPayload = QuizQuestionResolvedPayload

type QuizQuestionSelectionPayload = {
  answerId: string
}

export type QuizQuestionStoryState = {
  question: ResolvedQuizQuestion
  config: QuizQuestionStoryConfig
  selectedAnswerIds: string[]
  revealed?: QuizQuestionResolvedPayload
  resolved?: QuizQuestionResolvedPayload
  disabled: boolean
  retryCount: number
}

export type QuizSceneState = {
  answers: QuizQuestionAnsweredPayload[]
  answeredCount: number
  correctCount: number
  lastQuestionIndex?: number
  lastResult?: boolean
}

const QUESTION_PANEL_ID = "quiz-question-panel"
const QUESTION_STORY_ID = "quiz-question-story"
const QUESTION_SCENE_AGGREGATION_LOG = "[quiz-question-aggregate]"

const DEFAULT_QUESTION_CONFIG: QuizQuestionStoryConfig = {
  showCorrection: true,
  showResult: true,
  maxRetries: 0,
  disableValidateAfterSubmit: true
}

/**
 * Returns the input type used by one resolved quiz question.
 */
function resolveAnswerInputType(questionType: QuizQuestionType): "radio" | "checkbox" {
  return questionType === "multiple" ? "checkbox" : "radio"
}

/**
 * Returns the label used by one question answer group.
 */
function resolveAnswerGroupName(questionIndex: number): string {
  return `quiz-question-${questionIndex}-answer`
}

/**
 * Returns true when two answer id lists match exactly.
 */
function hasSameAnswerSet(expectedIds: string[], actualIds: string[]): boolean {
  if (expectedIds.length !== actualIds.length) {
    return false
  }

  const expected = new Set(expectedIds)
  return actualIds.every((answerId) => expected.has(answerId))
}

/**
 * Reads the question payload stored in the strap state.
 */
function resolveQuestionState(state: Readonly<Record<string, unknown>>): QuizQuestionStoryState | null {
  const question = state.question
  if (typeof question !== "object" || question === null) {
    return null
  }

  return state as QuizQuestionStoryState
}

/**
 * Resolves one scene aggregation state from one shallow runtime state bucket.
 */
function resolveSceneState(state: Readonly<Record<string, unknown>>): QuizSceneState {
  const answers = Array.isArray(state.answers)
    ? state.answers.filter((answer): answer is QuizQuestionAnsweredPayload => {
        if (typeof answer !== 'object' || answer === null) {
          return false
        }

        const payload = answer as Record<string, unknown>

        return (
          typeof payload.questionIndex === 'number' &&
          Array.isArray(payload.selectedAnswerIds) &&
          Array.isArray(payload.correctAnswerIds) &&
          typeof payload.isCorrect === 'boolean'
        )
      })
    : []

  return {
    answers,
    answeredCount: typeof state.answeredCount === 'number' ? state.answeredCount : answers.length,
    correctCount: typeof state.correctCount === 'number' ? state.correctCount : answers.filter((answer) => answer.isCorrect).length,
    lastQuestionIndex: typeof state.lastQuestionIndex === 'number' ? state.lastQuestionIndex : undefined,
    lastResult: typeof state.lastResult === 'boolean' ? state.lastResult : undefined
  }
}

/**
 * Creates one story-owned title for one quiz question.
 */
function createQuestionTitle(question: ResolvedQuizQuestion): PersoDoc {
  return {
    id: 'quiz-question-title',
    type: 'text',
    initial: {
      tag: 'span',
      content: question.prompt,
      style: {
        fontWeight: 700
      },
      move: {
        parentId: 'quiz-question:title',
      }
    } as unknown as PersoDoc['initial'],
    actions: {}
  }
}

/**
 * Creates one story-owned hint for one quiz question.
 */
function createQuestionHint(question: ResolvedQuizQuestion): PersoDoc {
  return {
    id: 'quiz-question-hint',
    type: 'text',
    initial: {
      tag: 'span',
      content: question.type === 'multiple' ? question.labels.multipleHint : '',
      style: {
        color: '#475569'
      },
      move: {
        parentId: 'quiz-question:hint',
      }
    } as unknown as PersoDoc['initial'],
    actions: {}
  }
}

/**
 * Creates one layout panel that hosts the full quiz question.
 */
function createQuestionPanel(): PersoDoc {
  return {
    id: QUESTION_PANEL_ID,
    type: 'layout',
    initial: {
      // Default root placement — createQuizQuestionStory overrides this with a
      // real `move` when options.parentId is given.
      move: '@root',
      markup: `
        <fieldset class="quiz-question-fieldset">
          <legend data-part="quiz-question:title"></legend>
          <p data-part="quiz-question:hint"></p>
          <div data-part="quiz-question:answers"></div>
          <div data-part="quiz-question:controls"></div>
          <p data-part="quiz-question:result" aria-live="polite"></p>
          <div data-part="quiz-question:next"></div>
        </fieldset>
      `,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        border: '1px solid rgba(15, 23, 42, 0.12)',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        margin: 0
      },
      attr: {
        disabled: false
      }
    },
    actions: {
      'quiz:question:resolved': {
        attr: {
          disabled: true
        }
      }
    }
  }
}

/**
 * Creates one runtime answer item for one quiz question.
 */
function createQuestionAnswer(question: ResolvedQuizQuestion, answer: QuizAnswer): PersoDoc[] {
  const inputType = resolveAnswerInputType(question.type)
  const groupName = resolveAnswerGroupName(question.index)
  const answerRootId = `quiz-question-${question.index}__answer-${answer.id}`
  const selectionIconId = `${answerRootId}__selection-icon`
  const correctionIconId = `${answerRootId}__correction-icon`

  const answerInput: PersoDoc = {
    id: answerRootId,
    type: "input",
    initial: {
      inputType,
      name: groupName,
      value: answer.id,
      label: answer.label,
      hint: "",
      checked: false,
      disabled: false,
      visualState: "idle",
      move: {
        parentId: 'quiz-question:answers',
      }
    } as unknown as PersoDoc['initial'],
    actions: {},
    emit: {
      change: {
        data: {
          answerId: answer.id
        },
        event: {
          name: 'quiz:question:answer:select'
        }
      }
    }
  }

  const selectionIcon: PersoDoc = {
    id: selectionIconId,
    type: 'text',
    initial: {
      tag: 'span',
      content: '',
      className: 'quiz-question-answer__selection-icon',
      style: {
        display: 'inline-block',
        minWidth: '1ch',
        marginInlineStart: '8px',
        textAlign: 'center'
      },
      move: {
        parentId: `${answerRootId}__selection-icon-slot`,
      }
    } as unknown as PersoDoc['initial'],
    actions: {
      [`quiz:question:answer:${answer.id}:selected`]: {
        content: '•',
        className: 'is-selected'
      },
      [`quiz:question:answer:${answer.id}:idle`]: {
        content: '',
        className: 'is-idle'
      }
    }
  }

  const correctionIcon: PersoDoc = {
    id: correctionIconId,
    type: 'text',
    initial: {
      tag: 'span',
      content: '',
      className: 'quiz-question-answer__correction-icon',
      style: {
        display: 'inline-block',
        minWidth: '1ch',
        marginInlineStart: '8px',
        textAlign: 'center',
        fontWeight: 700
      },
      move: {
        parentId: `${answerRootId}__correction-icon-slot`,
      }
    } as unknown as PersoDoc['initial'],
    actions: {
      [`quiz:question:answer:${answer.id}:revealed-correct`]: {
        content: '+',
        className: 'is-correct'
      },
      [`quiz:question:answer:${answer.id}:revealed-incorrect`]: {
        content: '-',
        className: 'is-incorrect'
      },
      [`quiz:question:answer:${answer.id}:revealed-missed-correct`]: {
        content: '+',
        className: 'is-missed-correct'
      }
    }
  }

  return [answerInput, selectionIcon, correctionIcon]
}

/**
 * Creates one story-owned validate button for one quiz question.
 */
function createQuestionValidate(question: ResolvedQuizQuestion): PersoDoc {
  return {
    id: 'quiz-question-validate',
    type: 'text',
    initial: {
      tag: 'button',
      content: question.labels.validate,
      style: {
        marginTop: '12px',
        alignSelf: 'flex-start'
      },
      attr: {
        type: 'button',
        disabled: true
      },
      move: {
        parentId: 'quiz-question:controls',
      }
    } as unknown as PersoDoc['initial'],
    emit: {
      click: {
        event: {
          name: 'quiz:question:validate'
        }
      }
    },
    actions: {
      'quiz:question:selection:available': {
        attr: {
          disabled: false
        }
      },
      'quiz:question:selection:empty': {
        attr: {
          disabled: true
        }
      },
      'quiz:question:resolved': {
        attr: {
          disabled: true
        }
      }
    }
  }
}

/**
 * Creates one text node that displays the validation result.
 */
function createQuestionResult(question: ResolvedQuizQuestion): PersoDoc {
  return {
    id: 'quiz-question-result',
    type: 'text',
    initial: {
      tag: 'span',
      content: '',
      style: {
        fontWeight: 600
      },
      attr: {
        hidden: true,
        'aria-live': 'polite'
      },
      move: {
        parentId: 'quiz-question:result',
      }
    } as unknown as PersoDoc['initial'],
    actions: {
      'quiz:question:resolved:correct': {
        content: question.labels.correct,
        attr: {
          hidden: false
        }
      },
      'quiz:question:resolved:incorrect': {
        content: question.labels.incorrect,
        attr: {
          hidden: false
        }
      }
    }
  }
}

/**
 * Creates one story-owned next button displayed after resolution.
 */
function createQuestionNext(question: ResolvedQuizQuestion): PersoDoc {
  return {
    id: 'quiz-question-next',
    type: 'text',
    initial: {
      tag: 'button',
      content: question.labels.next,
      attr: {
        type: 'button',
        hidden: true
      },
      move: {
        parentId: 'quiz-question:next',
      }
    } as unknown as PersoDoc['initial'],
    emit: {
      click: {
        event: {
          name: 'quiz:question:next'
        }
      }
    },
    actions: {
      'quiz:question:resolved': {
        attr: {
          hidden: false
        }
      }
    }
  }
}

/**
 * Creates one story document that renders one quiz question.
 */
function createQuestionStory(question: ResolvedQuizQuestion): SceneStoryDoc {
  return {
    id: QUESTION_STORY_ID,
    initial: { move: '@root' },
    state: {
      question,
      config: DEFAULT_QUESTION_CONFIG,
      selectedAnswerIds: [],
      revealed: undefined,
      resolved: undefined,
      disabled: false,
      retryCount: 0
    },
    straps: quizQuestionStoryStraps,
    listen: [
      {
        on: 'quiz:question:answer:select',
        straps: ['quiz-question-select']
      },
      {
        on: 'quiz:question:validate',
        straps: ['quiz-question-submit']
      }
    ],
    persos: [
      createQuestionPanel(),
      createQuestionTitle(question),
      createQuestionHint(question),
      ...question.answers.flatMap((answer) => createQuestionAnswer(question, answer)),
      createQuestionValidate(question),
      createQuestionResult(question),
      createQuestionNext(question)
    ]
  }
}

type QuizQuestionStoryOptions = {
  storyId?: string
  parentId?: string
  panelClassName?: string
  panelStyle?: Record<string, unknown>
}

export function createQuizQuestionStory(
  question: ResolvedQuizQuestion,
  options: QuizQuestionStoryOptions = {},
): SceneStoryDoc {
  const story = createQuestionStory(question)
  const storyId = options.storyId ?? QUESTION_STORY_ID
  const panel = story.persos.find((perso) => perso.id === QUESTION_PANEL_ID)
  // Composition into another story's outlet is the STORY's own move
  // (`initial.move: { parentId }`), never the panel perso reaching directly
  // across story boundaries — the panel always keeps `move: '@root'`,
  // attaching to its own (now correctly placed) story.
  const storyInitial = options.parentId
    ? { ...(story.initial as Record<string, unknown> | undefined), move: { parentId: options.parentId } }
    : story.initial

  if (panel) {
    const initial = panel.initial as Record<string, unknown>
    if (options.panelClassName) {
      initial.className = options.panelClassName
    }
    if (options.panelStyle) {
      initial.style = {
        ...(typeof initial.style === 'object' && initial.style !== null ? initial.style as Record<string, unknown> : {}),
        ...options.panelStyle,
      }
    }
  }

  return {
    ...story,
    id: storyId,
    initial: storyInitial,
  }
}

/**
 * Creates one scene doc for one resolved quiz question.
 */
export function createQuizQuestionScene(question: ResolvedQuizQuestion): SceneDoc {
  return {
    id: `quiz-question-${question.index}-scene`,
    initial: {
      answers: [],
      answeredCount: 0,
      correctCount: 0,
      lastQuestionIndex: undefined,
      lastResult: undefined
    },
    straps: undefined,
    listen: [
      {
        on: "quiz:question:answered",
        straps: ["quiz-question-aggregate"]
      }
    ],
    stories: {
      [QUESTION_STORY_ID]: createQuestionStory(question)
    },
    tracks: {}
  }
}

/**
 * Handles one user selection and updates the quiz answer snapshot.
 */
function handleQuestionSelect(state: Readonly<Record<string, unknown>>, eventData: Record<string, unknown> | undefined) {
  const questionState = resolveQuestionState(state)
  if (questionState === null) {
    return undefined
  }

  const selectPayload = eventData as QuizQuestionSelectionPayload | undefined
  if (typeof selectPayload?.answerId !== 'string' || selectPayload.answerId.length === 0) {
    return undefined
  }

  const answerId = selectPayload.answerId

  const currentSelectedAnswerIds = Array.isArray(questionState.selectedAnswerIds)
    ? questionState.selectedAnswerIds.filter((candidate): candidate is string => typeof candidate === 'string')
    : []
  const isMultipleChoice = questionState.question.type === 'multiple'
  const alreadySelected = currentSelectedAnswerIds.includes(answerId)

  const selectedAnswerIds = isMultipleChoice
    ? alreadySelected
      ? currentSelectedAnswerIds.filter((candidate) => candidate !== answerId)
      : [...currentSelectedAnswerIds, answerId]
    : [answerId]

  const selectionEventName = selectedAnswerIds.length > 0 ? 'quiz:question:selection:available' : 'quiz:question:selection:empty'
  const selectedIds = new Set(selectedAnswerIds)
  const answerEvents = questionState.question.answers.map((answer) => {
    const isSelected = selectedIds.has(answer.id)
    return {
      name: `quiz:question:answer:${answer.id}:${isSelected ? 'selected' : 'idle'}`
    }
  })

  return {
    update: {
      selectedAnswerIds,
      revealed: questionState.revealed,
      resolved: questionState.resolved,
      disabled: questionState.disabled,
      retryCount: typeof questionState.retryCount === 'number' ? questionState.retryCount : 0
    },
    events: [
      {
        name: selectionEventName,
        data: {
          selectedAnswerIds
        }
      },
      ...answerEvents
    ]
  }
}

/**
 * Handles one submitted selection and resolves the quiz answer result.
 */
function handleQuestionSubmit(state: Readonly<Record<string, unknown>>, _eventData: Record<string, unknown> | undefined) {
  const questionState = resolveQuestionState(state)
  if (questionState === null) {
    return undefined
  }

  const selectedAnswerIds = Array.isArray(questionState.selectedAnswerIds)
    ? questionState.selectedAnswerIds.filter((answerId): answerId is string => typeof answerId === 'string')
    : []
  const correctAnswerIds = questionState.question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id)
  const isCorrect = hasSameAnswerSet(correctAnswerIds, selectedAnswerIds)
  const resultEventName = isCorrect ? "quiz:question:resolved:correct" : "quiz:question:resolved:incorrect"
  const resolvedPayload: QuizQuestionResolvedPayload = {
    questionIndex: questionState.question.index,
    selectedAnswerIds,
    correctAnswerIds,
    isCorrect
  }

  const answerEvents = questionState.question.answers.map((answer) => {
    const isSelected = selectedAnswerIds.includes(answer.id)
    if (isSelected && answer.isCorrect) {
      return { name: `quiz:question:answer:${answer.id}:revealed-correct` }
    }

    if (isSelected) {
      return { name: `quiz:question:answer:${answer.id}:revealed-incorrect` }
    }

    if (answer.isCorrect) {
      return { name: `quiz:question:answer:${answer.id}:revealed-missed-correct` }
    }

    return { name: `quiz:question:answer:${answer.id}:locked` }
  })

  return {
    update: {
      selectedAnswerIds,
      revealed: resolvedPayload,
      resolved: resolvedPayload,
      disabled: true,
      retryCount: typeof questionState.retryCount === 'number' ? questionState.retryCount : 0
    },
    events: [
      {
        name: "quiz:question:answered",
        data: {
          ...resolvedPayload,
        }
      },
      {
        name: 'quiz:question:resolved',
        data: {
          ...resolvedPayload,
          showCorrection: true,
          disableAnswers: true
        }
      },
      {
        name: resultEventName,
        data: {
          ...resolvedPayload,
        }
      },
      ...answerEvents
    ]
  }
}

/**
 * Aggregates one answered quiz question at scene level.
 */
function handleQuestionAggregate(state: Readonly<Record<string, unknown>>, eventData: Record<string, unknown> | undefined) {
  const payload = eventData as QuizQuestionResolvedPayload | undefined
  if (payload === undefined) {
    return undefined
  }

  const sceneState = resolveSceneState(state)
  const nextAnswer: QuizQuestionAnsweredPayload = {
    questionIndex: payload.questionIndex,
    selectedAnswerIds: payload.selectedAnswerIds,
    correctAnswerIds: payload.correctAnswerIds,
    isCorrect: payload.isCorrect
  }

  const previousAnswers = sceneState.answers.filter((answer) => answer.questionIndex !== nextAnswer.questionIndex)
  const answers = [...previousAnswers, nextAnswer].sort((left, right) => left.questionIndex - right.questionIndex)
  const answeredCount = answers.length
  const correctCount = answers.filter((answer) => answer.isCorrect).length

  console.log(QUESTION_SCENE_AGGREGATION_LOG, {
    answeredCount,
    correctCount,
    lastQuestionIndex: nextAnswer.questionIndex,
    lastResult: nextAnswer.isCorrect
  })

  return {
    update: {
      answers,
      answeredCount,
      correctCount,
      lastQuestionIndex: nextAnswer.questionIndex,
      lastResult: nextAnswer.isCorrect
    }
  }
}

export const quizQuestionStoryStraps: StrapCollection = {
  "quiz-question-select": ({ event, state }) => handleQuestionSelect(state, event.data),
  "quiz-question-submit": ({ event, state }) => handleQuestionSubmit(state, event.data),
}

export const quizQuestionSceneStraps: StrapCollection = {
  "quiz-question-aggregate": ({ event, state }) => handleQuestionAggregate(state, event.data)
}

export const quizQuestionStraps: StrapCollection = {
  ...quizQuestionStoryStraps,
  ...quizQuestionSceneStraps,
}

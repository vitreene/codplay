import type { StrapCollection } from "../../player"
import type { PersoDoc, SceneDoc, SceneStoryDoc } from "../../player/types"

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

type FormSnapshot = {
  questionIndex?: unknown
  values?: unknown
  selectedAnswerIds?: unknown
  canValidate?: unknown
}

type QuizQuestionState = {
  question: ResolvedQuizQuestion
}

const QUESTION_PANEL_ID = "quiz-question-panel"
const QUESTION_STORY_ID = "quiz-question-story"
const QUESTION_FORM_ID = "quiz-question-form"

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
function resolveQuestionState(state: Readonly<Record<string, unknown>>): QuizQuestionState | null {
  const question = state.question
  if (typeof question !== "object" || question === null) {
    return null
  }

  return state as QuizQuestionState
}

/**
 * Reads one form snapshot from one native form event payload.
 */
function resolveFormSnapshot(data: Record<string, unknown> | undefined): FormSnapshot {
  if (data === undefined) {
    return {}
  }

  return data as FormSnapshot
}

/**
 * Creates one visual panel that groups the quiz question story.
 */
function createQuestionPanel(): PersoDoc {
  return {
    id: QUESTION_PANEL_ID,
    type: 'list',
    initial: {
      className: 'quiz-question-panel',
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        border: '1px solid rgba(15, 23, 42, 0.12)',
        borderRadius: '12px',
        backgroundColor: '#ffffff'
      }
    },
    actions: {}
  }
}

/**
 * Creates one runtime answer item for one quiz question.
 */
function createQuestionAnswer(question: ResolvedQuizQuestion, answer: QuizAnswer): PersoDoc {
  const inputType = resolveAnswerInputType(question.type)
  const groupName = resolveAnswerGroupName(question.index)

  return {
    id: `quiz-question-${question.index}__answer-${answer.id}`,
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
        parentId: QUESTION_FORM_ID,
        mode: "append"
      }
    } as unknown as PersoDoc['initial'],
    actions: {
      [`quiz:question:answer:${answer.id}:revealed-correct`]: {
        checked: true,
        disabled: true,
        visualState: 'revealed-correct'
      },
      [`quiz:question:answer:${answer.id}:revealed-incorrect`]: {
        checked: true,
        disabled: true,
        visualState: 'revealed-incorrect'
      },
      [`quiz:question:answer:${answer.id}:revealed-missed-correct`]: {
        checked: false,
        disabled: true,
        visualState: 'revealed-missed-correct'
      },
      [`quiz:question:answer:${answer.id}:locked`]: {
        checked: false,
        disabled: true,
        visualState: 'disabled'
      }
    }
  }
}

/**
 * Creates the form item that hosts one quiz question.
 */
function createQuestionForm(question: ResolvedQuizQuestion): PersoDoc {
  return {
    id: QUESTION_FORM_ID,
    type: "form",
    initial: {
      questionIndex: question.index,
      title: question.prompt,
      hint: question.type === "multiple" ? question.labels.multipleHint : "",
      validateLabel: question.labels.validate,
      nextLabel: question.labels.next,
      resultMessage: "",
      canValidate: false,
      showResult: false,
      showNext: false,
      move: {
        parentId: QUESTION_PANEL_ID,
        mode: 'append'
      }
    } as unknown as PersoDoc['initial'],
    actions: {
      'quiz:question:resolved': {
        canValidate: false
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
      tag: 'p',
      content: '',
      attr: {
        hidden: true,
        'aria-live': 'polite'
      },
      move: {
        parentId: QUESTION_PANEL_ID,
        mode: 'append'
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
        parentId: QUESTION_PANEL_ID,
        mode: 'append'
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
    entries: [QUESTION_PANEL_ID],
    initial: undefined,
    state: {
      question
    },
    straps: undefined,
    listen: [
      {
        on: "native:form:submit",
        straps: ["quiz-question-submit"]
      }
    ],
    persos: [
      createQuestionPanel(),
      createQuestionForm(question),
      ...question.answers.map((answer) => createQuestionAnswer(question, answer)),
      createQuestionResult(question),
      createQuestionNext(question)
    ]
  }
}

/**
 * Creates one scene doc for one resolved quiz question.
 */
export function createQuizQuestionScene(question: ResolvedQuizQuestion): SceneDoc {
  return {
    id: `quiz-question-${question.index}-scene`,
    rootStories: [QUESTION_STORY_ID],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      [QUESTION_STORY_ID]: createQuestionStory(question)
    },
    tracks: {}
  }
}

/**
 * Handles one submitted form snapshot and resolves the quiz answer result.
 */
function handleQuestionSubmit(state: Readonly<Record<string, unknown>>, eventData: Record<string, unknown> | undefined) {
  const questionState = resolveQuestionState(state)
  if (questionState === null) {
    return undefined
  }

  const snapshot = resolveFormSnapshot(eventData)
  const selectedAnswerIds = Array.isArray(snapshot.selectedAnswerIds)
    ? snapshot.selectedAnswerIds.filter((answerId): answerId is string => typeof answerId === "string")
    : []
  const values = typeof snapshot.values === "object" && snapshot.values !== null
    ? (snapshot.values as Record<string, string | number | boolean | string[] | null>)
    : {}
  const correctAnswerIds = questionState.question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id)
  const isCorrect = hasSameAnswerSet(correctAnswerIds, selectedAnswerIds)
  const resultEventName = isCorrect ? "quiz:question:resolved:correct" : "quiz:question:resolved:incorrect"

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
    events: [
      {
        name: "quiz:question:answered",
        data: {
          questionIndex: questionState.question.index,
          selectedAnswerIds,
          correctAnswerIds,
          isCorrect,
          values
        }
      },
      {
        name: 'quiz:question:resolved',
        data: {
          questionIndex: questionState.question.index,
          selectedAnswerIds,
          correctAnswerIds,
          isCorrect,
          values
        }
      },
      {
        name: resultEventName,
        data: {
          questionIndex: questionState.question.index,
          selectedAnswerIds,
          correctAnswerIds,
          isCorrect,
          values
        }
      },
      ...answerEvents
    ]
  }
}

export const quizQuestionStraps: StrapCollection = {
  "quiz-question-submit": ({ event, state }) => handleQuestionSubmit(state, event.data)
}

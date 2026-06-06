import type { StrapCollection } from "../../player"
import type { PersoDoc, SceneDoc, SceneStoryDoc } from "../../player/types"
import type { QuizQuestionAnsweredPayload, QuizQuestionStoryConfig, ResolvedQuizQuestion } from "./quiz-question-scene"
import { quizQuestionStraps } from "./quiz-question-scene"

// --- Configuration ---

const SERIES_TOTAL = 3
const SERIES_THRESHOLD = 2

const SERIES_LABELS = {
  validate: "Valider",
  next: "Suivant",
  correct: "Correct !",
  incorrect: "Incorrect",
  multipleHint: "Plusieurs réponses possibles"
}

const SERIES_BACKGROUNDS = ["#eff6ff", "#f0fdf4", "#fff7ed"]
const SERIES_BORDERS = ["#2563eb", "#16a34a", "#ea580c"]

const DEFAULT_SERIES_CONFIG: QuizQuestionStoryConfig = {
  showCorrection: true,
  showResult: true,
  maxRetries: 0,
  disableValidateAfterSubmit: true
}

// --- Questions (français) ---

const SERIES_QUESTIONS: ResolvedQuizQuestion[] = [
  {
    index: 1,
    type: "boolean",
    prompt: "La Tour Eiffel se trouve à Paris.",
    answers: [
      { id: "vrai", label: "Vrai", isCorrect: true },
      { id: "faux", label: "Faux", isCorrect: false }
    ],
    labels: SERIES_LABELS
  },
  {
    index: 2,
    type: "single",
    prompt: "Quelle est la plus grande planète du système solaire ?",
    answers: [
      { id: "mars", label: "Mars", isCorrect: false },
      { id: "jupiter", label: "Jupiter", isCorrect: true },
      { id: "saturne", label: "Saturne", isCorrect: false },
      { id: "neptune", label: "Neptune", isCorrect: false }
    ],
    labels: SERIES_LABELS
  },
  {
    index: 3,
    type: "multiple",
    prompt: "Parmi ces éléments, lesquels sont des fruits ?",
    answers: [
      { id: "pomme", label: "Pomme", isCorrect: true },
      { id: "carotte", label: "Carotte", isCorrect: false },
      { id: "banane", label: "Banane", isCorrect: true },
      { id: "poireau", label: "Poireau", isCorrect: false }
    ],
    labels: SERIES_LABELS
  }
]

// --- Container story ---

function createSeriesContainerStory(): SceneStoryDoc {
  return {
    id: "quiz-series-container-story",
    entries: ["quiz-series-container"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "quiz-series-container",
        type: "layout",
        initial: {
          markup: `
            <div class="quiz-series-wrapper">
              <div data-part="quiz-series:slot" style="position: relative; height: 100%;"></div>
            </div>
          `,
          style: {
            position: "relative",
            overflow: "hidden",
            height: "520px",
            width: "100%",
            borderRadius: "12px"
          }
        } as unknown as PersoDoc["initial"],
        actions: {}
      }
    ]
  }
}

// --- Question story builder ---

function resolveSeriesAnswerInputType(type: ResolvedQuizQuestion["type"]): "radio" | "checkbox" {
  return type === "multiple" ? "checkbox" : "radio"
}

function createSeriesQuestionStory(
  question: ResolvedQuizQuestion,
  position: number,
  backgroundColor: string,
  borderColor: string
): SceneStoryDoc {
  const storyId = `quiz-series-q${position}-story`
  const panelId = `quiz-series-q${position}-panel`
  const prefix = `quiz-series-q${position}`
  const inputType = resolveSeriesAnswerInputType(question.type)
  const groupName = `quiz-series-${position}-answer`

  const answerPersos: PersoDoc[] = question.answers.flatMap((answer): PersoDoc[] => {
    const answerRootId = `quiz-question-${question.index}__answer-${answer.id}`
    return [
      {
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
          move: { parentId: `${prefix}:answers`, mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {},
        emit: {
          change: {
            data: { answerId: answer.id },
            event: { name: "quiz:question:answer:select" }
          }
        }
      },
      {
        id: `${answerRootId}__selection-icon`,
        type: "text",
        initial: {
          tag: "span",
          content: "",
          style: {
            display: "inline-block",
            minWidth: "1ch",
            marginInlineStart: "8px",
            textAlign: "center"
          },
          move: { parentId: `${answerRootId}__selection-icon-slot`, mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {
          [`quiz:question:answer:${answer.id}:selected`]: { content: "•" },
          [`quiz:question:answer:${answer.id}:idle`]: { content: "" }
        }
      },
      {
        id: `${answerRootId}__correction-icon`,
        type: "text",
        initial: {
          tag: "span",
          content: "",
          style: {
            display: "inline-block",
            minWidth: "1ch",
            marginInlineStart: "8px",
            textAlign: "center",
            fontWeight: 700
          },
          move: { parentId: `${answerRootId}__correction-icon-slot`, mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {
          [`quiz:question:answer:${answer.id}:revealed-correct`]: { content: "+" },
          [`quiz:question:answer:${answer.id}:revealed-incorrect`]: { content: "-" },
          [`quiz:question:answer:${answer.id}:revealed-missed-correct`]: { content: "+" }
        }
      }
    ]
  })

  const persos: PersoDoc[] = [
    {
      id: panelId,
      type: "layout",
      initial: {
        markup: `
          <div class="quiz-series-question-panel">
            <fieldset class="quiz-question-fieldset">
              <legend data-part="${prefix}:title"></legend>
              <p data-part="${prefix}:hint"></p>
              <div data-part="${prefix}:answers"></div>
              <div data-part="${prefix}:controls"></div>
              <p data-part="${prefix}:result" aria-live="polite"></p>
            </fieldset>
            <div data-part="${prefix}:next"></div>
          </div>
        `,
        style: {
          position: "absolute",
          top: "0",
          left: "0",
          width: "100%",
          height: "100%",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "16px",
          border: `2px solid ${borderColor}`,
          borderRadius: "12px",
          backgroundColor,
          margin: 0,
          boxSizing: "border-box",
          ...(position > 0 ? { transform: "translateX(100%)" } : {})
        },
        move: { parentId: "quiz-series:slot", mode: "append" }
      } as unknown as PersoDoc["initial"],
      actions: {
        [`quiz:question:${position}:hide`]: {
          style: { x: { from: 0, to: "-100%", duration: 350, ease: "inOutCubic" } }
        },
        [`quiz:question:${position}:show`]: {
          style: { x: { from: "100%", to: 0, duration: 350, ease: "inOutCubic" } }
        }
      }
    },
    {
      id: `${prefix}-title`,
      type: "text",
      initial: {
        tag: "span",
        content: question.prompt,
        style: { fontWeight: 700, color: borderColor },
        move: { parentId: `${prefix}:title`, mode: "append" }
      } as unknown as PersoDoc["initial"],
      actions: {}
    },
    {
      id: `${prefix}-hint`,
      type: "text",
      initial: {
        tag: "span",
        content: question.type === "multiple" ? question.labels.multipleHint : "",
        style: { color: "#475569", fontSize: "0.875rem" },
        move: { parentId: `${prefix}:hint`, mode: "append" }
      } as unknown as PersoDoc["initial"],
      actions: {}
    },
    ...answerPersos,
    {
      id: `${prefix}-validate`,
      type: "text",
      initial: {
        tag: "button",
        content: question.labels.validate,
        style: {
          marginTop: "12px",
          alignSelf: "flex-start",
          backgroundColor: borderColor,
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "8px 16px",
          cursor: "pointer",
          fontWeight: 600
        },
        attr: { type: "button", disabled: true },
        move: { parentId: `${prefix}:controls`, mode: "append" }
      } as unknown as PersoDoc["initial"],
      emit: {
        click: { event: { name: "quiz:question:validate" } }
      },
      actions: {
        "quiz:question:selection:available": { attr: { disabled: false } },
        "quiz:question:selection:empty": { attr: { disabled: true } },
        "quiz:question:resolved": { attr: { disabled: true } }
      }
    },
    {
      id: `${prefix}-result`,
      type: "text",
      initial: {
        tag: "span",
        content: "",
        style: { fontWeight: 600 },
        attr: { hidden: true },
        move: { parentId: `${prefix}:result`, mode: "append" }
      } as unknown as PersoDoc["initial"],
      actions: {
        "quiz:question:resolved:correct": {
          content: question.labels.correct,
          attr: { hidden: false },
          style: { color: "#16a34a" }
        },
        "quiz:question:resolved:incorrect": {
          content: question.labels.incorrect,
          attr: { hidden: false },
          style: { color: "#dc2626" }
        }
      }
    },
    {
      id: `${prefix}-next`,
      type: "text",
      initial: {
        tag: "button",
        content: question.labels.next,
        attr: { type: "button", hidden: true },
        style: { marginTop: "8px", cursor: "pointer" },
        move: { parentId: `${prefix}:next`, mode: "append" }
      } as unknown as PersoDoc["initial"],
      emit: {
        click: { event: { name: "quiz:question:next" } }
      },
      actions: {
        "quiz:question:resolved": { attr: { hidden: false } }
      }
    }
  ]

  return {
    id: storyId,
    entries: [panelId],
    initial: undefined,
    state: {
      question,
      config: DEFAULT_SERIES_CONFIG,
      selectedAnswerIds: [],
      revealed: undefined,
      resolved: undefined,
      disabled: false,
      retryCount: 0
    },
    straps: undefined,
    listen: [
      { on: "quiz:question:answer:select", straps: ["quiz-question-select"] },
      { on: "quiz:question:validate", straps: ["quiz-question-submit"] }
    ],
    persos
  }
}

// --- Result modal story ---

function createSeriesResultStory(): SceneStoryDoc {
  const itemPersos: PersoDoc[] = Array.from({ length: SERIES_TOTAL }, (_, i) => {
    const n = i + 1
    return {
      id: `quiz-series-result-item-${n}`,
      type: "text",
      initial: {
        tag: "p",
        content: `Question ${n}`,
        style: { margin: "4px 0", fontWeight: 500 },
        move: { parentId: "quiz-series-result:items", mode: "append" }
      } as unknown as PersoDoc["initial"],
      actions: {
        [`quiz:result:item:${n}:correct`]: {
          content: `Question ${n} : ✓`,
          style: { color: "#16a34a" }
        },
        [`quiz:result:item:${n}:incorrect`]: {
          content: `Question ${n} : ✗`,
          style: { color: "#dc2626" }
        }
      }
    }
  })

  return {
    id: "quiz-series-result-story",
    entries: ["quiz-series-result-modal"],
    initial: undefined,
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "quiz-series-result-modal",
        type: "layout",
        initial: {
          markup: `
            <div class="quiz-series-result-overlay">
              <div data-part="quiz-series-result:card"></div>
            </div>
          `,
          style: {
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            bottom: "0",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            opacity: 0,
            pointerEvents: "none"
          },
          move: { parentId: "quiz-series:slot", mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {
          "quiz:result:show": {
            style: {
              opacity: { from: 0, to: 1, duration: 300 },
              pointerEvents: "auto"
            }
          }
        }
      },
      {
        id: "quiz-series-result-card",
        type: "layout",
        initial: {
          markup: `
            <div class="quiz-series-result-card">
              <div data-part="quiz-series-result:items"></div>
              <div data-part="quiz-series-result:score"></div>
              <div data-part="quiz-series-result:verdict"></div>
            </div>
          `,
          style: {
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "24px 32px",
            minWidth: "300px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          },
          move: { parentId: "quiz-series-result:card", mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {}
      },
      ...itemPersos,
      {
        id: "quiz-series-result-score",
        type: "text",
        initial: {
          tag: "p",
          content: "— / 3",
          style: { fontSize: "1.25rem", fontWeight: 700, margin: "12px 0 4px" },
          move: { parentId: "quiz-series-result:score", mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {
          "quiz:result:score": {}
        }
      },
      {
        id: "quiz-series-result-verdict",
        type: "text",
        initial: {
          tag: "p",
          content: "",
          style: { fontWeight: 700, fontSize: "1.125rem" },
          move: { parentId: "quiz-series-result:verdict", mode: "append" }
        } as unknown as PersoDoc["initial"],
        actions: {
          "quiz:result:verdict:passed": {
            content: "Réussi !",
            style: { color: "#16a34a" }
          },
          "quiz:result:verdict:failed": {
            content: "Échoué",
            style: { color: "#dc2626" }
          }
        }
      }
    ]
  }
}

// --- Scene builder ---

export function createQuizSeriesScene(): SceneDoc {
  const questionStories = SERIES_QUESTIONS.map((question, position) =>
    createSeriesQuestionStory(question, position, SERIES_BACKGROUNDS[position], SERIES_BORDERS[position])
  )

  const allStories: Record<string, SceneStoryDoc> = {
    "quiz-series-container-story": createSeriesContainerStory()
  }

  for (const story of questionStories) {
    allStories[story.id] = story
  }

  allStories["quiz-series-result-story"] = createSeriesResultStory()

  return {
    id: "quiz-series-scene",
    rootStories: ["quiz-series-container-story"],
    initial: {
      currentIndex: 0,
      answers: [],
      answeredCount: 0,
      correctCount: 0,
      lastQuestionIndex: undefined,
      lastResult: undefined
    },
    straps: undefined,
    listen: [
      { on: "quiz:question:next", straps: ["quiz-series-advance"] },
      { on: "quiz:question:answered", straps: ["quiz-question-aggregate"] },
      { on: "quiz:result:show", straps: ["quiz-result-render"] }
    ],
    stories: allStories,
    tracks: {}
  }
}

// --- Straps ---

function handleSeriesAdvance(state: Readonly<Record<string, unknown>>) {
  const currentIndex = typeof state.currentIndex === "number" ? state.currentIndex : 0
  const nextIndex = currentIndex + 1

  if (nextIndex >= SERIES_TOTAL) {
    return {
      events: [
        { name: `quiz:question:${currentIndex}:hide` },
        { name: "quiz:result:show" }
      ]
    }
  }

  return {
    update: { currentIndex: nextIndex },
    events: [
      { name: `quiz:question:${currentIndex}:hide` },
      { name: `quiz:question:${nextIndex}:show` }
    ]
  }
}

function handleResultRender(state: Readonly<Record<string, unknown>>) {
  const answers = Array.isArray(state.answers)
    ? (state.answers as Array<QuizQuestionAnsweredPayload>)
    : []
  const correctCount = typeof state.correctCount === "number" ? state.correctCount : 0
  const passed = correctCount >= SERIES_THRESHOLD

  const itemEvents = answers.map((answer) => ({
    name: `quiz:result:item:${answer.questionIndex}:${answer.isCorrect ? "correct" : "incorrect"}`
  }))

  return {
    events: [
      ...itemEvents,
      {
        name: "quiz:result:score",
        data: { content: `${correctCount} / ${SERIES_TOTAL}` }
      },
      {
        name: passed ? "quiz:result:verdict:passed" : "quiz:result:verdict:failed"
      }
    ]
  }
}

export const quizSeriesStraps: StrapCollection = {
  ...quizQuestionStraps,
  "quiz-series-advance": ({ state }) => handleSeriesAdvance(state),
  "quiz-result-render": ({ state }) => handleResultRender(state)
}

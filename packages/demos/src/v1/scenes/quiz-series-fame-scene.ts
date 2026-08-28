import "./quiz-series-fame-scene.css"
import type { StrapCollection } from "codplay-v1/player"
import type { PersoDoc, SceneDoc, SceneStoryDoc } from "codplay-v1/player/types"
import type { QuizQuestionAnsweredPayload, QuizQuestionResolvedPayload, QuizQuestionStoryConfig, ResolvedQuizQuestion } from "./quiz-question-scene"

// Local duplicates of quiz-question-scene.ts's handleQuestionSelect/handleQuestionSubmit,
// parameterized by `prefix` instead of the fixed "quiz:question:" namespace — this scene
// mounts 3 question stories simultaneously that must not cross-trigger, and the shared
// straps in quiz-question-scene.ts (reused by quiz-hunt) must not be touched. See
// 2026-07-10 quiz-series-fame investigation.

type QuizSeriesSelectionPayload = {
  answerId: string
}

function resolveSeriesQuestionState(state: Readonly<Record<string, unknown>>): {
  question: ResolvedQuizQuestion
  selectedAnswerIds: string[]
  retryCount: number
} | null {
  const question = state.question
  if (typeof question !== "object" || question === null) {
    return null
  }

  return state as { question: ResolvedQuizQuestion; selectedAnswerIds: string[]; retryCount: number }
}

function hasSameAnswerSet(expectedIds: string[], actualIds: string[]): boolean {
  if (expectedIds.length !== actualIds.length) {
    return false
  }

  const expected = new Set(expectedIds)
  return actualIds.every((answerId) => expected.has(answerId))
}

function handleSeriesQuestionSelect(prefix: string, state: Readonly<Record<string, unknown>>, eventData: Record<string, unknown> | undefined) {
  const questionState = resolveSeriesQuestionState(state)
  if (questionState === null) {
    return undefined
  }

  const selectPayload = eventData as QuizSeriesSelectionPayload | undefined
  if (typeof selectPayload?.answerId !== "string" || selectPayload.answerId.length === 0) {
    return undefined
  }

  const answerId = selectPayload.answerId
  const currentSelectedAnswerIds = Array.isArray(questionState.selectedAnswerIds)
    ? questionState.selectedAnswerIds.filter((candidate): candidate is string => typeof candidate === "string")
    : []
  const isMultipleChoice = questionState.question.type === "multiple"
  const alreadySelected = currentSelectedAnswerIds.includes(answerId)

  const selectedAnswerIds = isMultipleChoice
    ? alreadySelected
      ? currentSelectedAnswerIds.filter((candidate) => candidate !== answerId)
      : [...currentSelectedAnswerIds, answerId]
    : [answerId]

  const selectionEventName = selectedAnswerIds.length > 0 ? `${prefix}:selection:available` : `${prefix}:selection:empty`
  const selectedIds = new Set(selectedAnswerIds)
  const answerEvents = questionState.question.answers.map((answer) => ({
    name: `${prefix}:answer:${answer.id}:${selectedIds.has(answer.id) ? "selected" : "idle"}`
  }))

  return {
    update: {
      selectedAnswerIds,
      retryCount: typeof questionState.retryCount === "number" ? questionState.retryCount : 0
    },
    events: [
      { name: selectionEventName, data: { selectedAnswerIds } },
      ...answerEvents
    ]
  }
}

function handleSeriesQuestionSubmit(prefix: string, state: Readonly<Record<string, unknown>>) {
  const questionState = resolveSeriesQuestionState(state)
  if (questionState === null) {
    return undefined
  }

  const selectedAnswerIds = Array.isArray(questionState.selectedAnswerIds)
    ? questionState.selectedAnswerIds.filter((answerId): answerId is string => typeof answerId === "string")
    : []
  const correctAnswerIds = questionState.question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id)
  const isCorrect = hasSameAnswerSet(correctAnswerIds, selectedAnswerIds)
  const resultEventName = isCorrect ? `${prefix}:resolved:correct` : `${prefix}:resolved:incorrect`
  const resolvedPayload: QuizQuestionResolvedPayload = {
    questionIndex: questionState.question.index,
    selectedAnswerIds,
    correctAnswerIds,
    isCorrect
  }

  const answerEvents = questionState.question.answers.map((answer) => {
    const isSelected = selectedAnswerIds.includes(answer.id)
    if (isSelected && answer.isCorrect) {
      return { name: `${prefix}:answer:${answer.id}:revealed-correct` }
    }

    if (isSelected) {
      return { name: `${prefix}:answer:${answer.id}:revealed-incorrect` }
    }

    if (answer.isCorrect) {
      return { name: `${prefix}:answer:${answer.id}:revealed-missed-correct` }
    }

    return { name: `${prefix}:answer:${answer.id}:locked` }
  })

  return {
    update: {
      selectedAnswerIds,
      retryCount: typeof questionState.retryCount === "number" ? questionState.retryCount : 0
    },
    events: [
      { name: "quiz:question:answered", data: { ...resolvedPayload } },
      { name: `${prefix}:resolved`, data: { ...resolvedPayload, showCorrection: true, disableAnswers: true } },
      { name: resultEventName, data: { ...resolvedPayload } },
      ...answerEvents
    ]
  }
}

// --- Configuration ---

export const SERIES_TOTAL = 3
const SERIES_THRESHOLD = 2
const AUTO_STEP_MS = 2000
export const QUIZ_SERIES_AUTO_TRACK_ID = "quiz-series-auto-track"

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
    initial: { move: "@root" },
    straps: undefined,
    listen: [],
    persos: [
      {
        id: "quiz-series-container",
        type: "layout",
        initial: {
          move: "@root",
          markup: `
            <div class="quiz-series-wrapper">
              <div data-part="quiz-series:progress" style="margin-bottom: 10px;"></div>
              <div data-part="quiz-series:slot" style="position: relative; overflow: hidden; height: 500px;"></div>
            </div>
          `,
          style: {
            width: "100%",
            borderRadius: "12px"
          }
        },
        actions: {}
      }
    ]
  }
}

// --- Progress story ---

type SeriesProgressStoryOptions = {
  storyId?: string
  parentId?: string
  showTrack?: boolean
  showRate?: boolean
  layoutClassName?: string
  countClassName?: string
  fillClassName?: string
  rateClassName?: string
  background?: string
  padding?: string
  borderRadius?: string
  countStyle?: Record<string, unknown>
  rateStyle?: Record<string, unknown>
}

export function createSeriesProgressStory(options: SeriesProgressStoryOptions = {}): SceneStoryDoc {
  const storyId = options.storyId ?? "quiz-series-progress-story"
  const parentId = options.parentId ?? "quiz-series:progress"
  const showTrack = options.showTrack !== false
  const showRate = options.showRate !== false
  const background = options.background ?? "rgba(15,23,42,0.06)"
  const padding = options.padding ?? "8px 12px"
  const borderRadius = options.borderRadius ?? "8px"
  const persos: PersoDoc[] = [
    {
      id: "quiz-series-progress-layout",
      type: "layout",
      initial: {
        className: options.layoutClassName,
        markup: `
          <div class="quiz-series-progress" style="display: flex; align-items: center; gap: 10px; padding: ${padding}; background: ${background}; border-radius: ${borderRadius};">
            <span data-part="quiz-series:progress-count"></span>
            ${showTrack ? '<div data-part="quiz-series:progress-track" style="flex: 1; height: 8px; background: rgba(15,23,42,0.12); border-radius: 4px; overflow: hidden;"></div>' : ''}
            ${showRate ? '<span data-part="quiz-series:progress-rate"></span>' : ''}
          </div>
        `,
        style: {},
        move: "@root"
      },
      actions: {}
    },
    {
      id: "quiz-series-progress-count",
      type: "tag",
      initial: {
        className: options.countClassName,
        tag: "span",
        content: `0 / ${SERIES_TOTAL}`,
        style: { fontSize: "0.8rem", fontWeight: 600, whiteSpace: "nowrap", minWidth: "48px", ...(options.countStyle ?? {}) },
        move: { parentId: "quiz-series:progress-count" }
      },
      actions: { "quiz:series:progress:count": {} }
    }
  ]

  if (showTrack) {
    persos.push({
      id: "quiz-series-progress-fill",
      type: "tag",
      initial: {
        className: options.fillClassName,
        tag: "div",
        content: "",
        style: {
          height: "100%",
          width: "0%",
          backgroundColor: "#2563eb",
          borderRadius: "4px",
          transition: "width 350ms ease"
        },
        move: { parentId: "quiz-series:progress-track" }
      },
      actions: { "quiz:series:progress:fill": {} }
    })
  }

  if (showRate) {
    persos.push({
      id: "quiz-series-progress-rate",
      type: "tag",
      initial: {
        className: options.rateClassName,
        tag: "span",
        content: "—",
        style: { fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap", minWidth: "48px", textAlign: "right", ...(options.rateStyle ?? {}) },
        move: { parentId: "quiz-series:progress-rate" }
      },
      actions: { "quiz:series:progress:rate": {} }
    })
  }

  return {
    id: storyId,
    initial: { move: { parentId } },
    straps: undefined,
    listen: [],
    persos
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
          move: { parentId: `${prefix}:answers` }
        },
        actions: {},
        emit: {
          change: {
            data: { answerId: answer.id },
            event: { name: `${prefix}:answer:select` }
          }
        }
      },
      {
        id: `${answerRootId}__selection-icon`,
        type: "tag",
        initial: {
          tag: "span",
          content: "",
          style: {
            display: "inline-block",
            minWidth: "1ch",
            marginInlineStart: "8px",
            textAlign: "center"
          },
          move: { parentId: `${answerRootId}__selection-icon-slot` }
        },
        actions: {
          [`${prefix}:answer:${answer.id}:selected`]: { content: "•" },
          [`${prefix}:answer:${answer.id}:idle`]: { content: "" }
        }
      },
      {
        id: `${answerRootId}__correction-icon`,
        type: "tag",
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
          move: { parentId: `${answerRootId}__correction-icon-slot` }
        },
        actions: {
          [`${prefix}:answer:${answer.id}:revealed-correct`]: { content: "+" },
          [`${prefix}:answer:${answer.id}:revealed-incorrect`]: { content: "-" },
          [`${prefix}:answer:${answer.id}:revealed-missed-correct`]: { content: "+" }
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
              <div data-part="${prefix}:answers" class="quiz-question-answers"></div>
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
        move: "@root"
      },
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
      type: "tag",
      initial: {
        tag: "span",
        content: question.prompt,
        style: { fontWeight: 700, color: borderColor },
        move: { parentId: `${prefix}:title` }
      },
      actions: {}
    },
    {
      id: `${prefix}-hint`,
      type: "tag",
      initial: {
        tag: "span",
        content: question.type === "multiple" ? question.labels.multipleHint : "",
        style: { color: "#475569", fontSize: "0.875rem" },
        move: { parentId: `${prefix}:hint` }
      },
      actions: {}
    },
    ...answerPersos,
    {
      id: `${prefix}-validate`,
      type: "tag",
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
        move: { parentId: `${prefix}:controls` }
      },
      emit: {
        click: { event: { name: `${prefix}:validate` } }
      },
      actions: {
        [`${prefix}:selection:available`]: { attr: { disabled: false } },
        [`${prefix}:selection:empty`]: { attr: { disabled: true } },
        [`${prefix}:resolved`]: { attr: { disabled: true } }
      }
    },
    {
      id: `${prefix}-result`,
      type: "tag",
      initial: {
        tag: "span",
        content: "",
        style: { fontWeight: 600 },
        attr: { hidden: true },
        move: { parentId: `${prefix}:result` }
      },
      actions: {
        [`${prefix}:resolved:correct`]: {
          content: question.labels.correct,
          attr: { hidden: false },
          style: { color: "#16a34a" }
        },
        [`${prefix}:resolved:incorrect`]: {
          content: question.labels.incorrect,
          attr: { hidden: false },
          style: { color: "#dc2626" }
        }
      }
    },
    {
      id: `${prefix}-next`,
      type: "tag",
      initial: {
        tag: "button",
        content: question.labels.next,
        attr: { type: "button", hidden: true },
        style: { marginTop: "8px", cursor: "pointer" },
        move: { parentId: `${prefix}:next` }
      },
      emit: {
        click: { event: { name: "quiz:question:next" } }
      },
      actions: {
        [`${prefix}:resolved`]: { attr: { hidden: false } }
      }
    }
  ]

  return {
    id: storyId,
    initial: { move: { parentId: "quiz-series:slot" } },
    // `init` (rather than a static `state`) makes rewind() truly reset this story:
    // initializeSceneStories() reuses the current `story.state` as its base when no
    // `init` is declared, so a static `state` alone stays polluted by prior answers
    // across a rewind. `init` always returns a fresh object regardless of input.
    init: () => ({
      question,
      config: DEFAULT_SERIES_CONFIG,
      selectedAnswerIds: [],
      retryCount: 0
    }),
    straps: {
      "quiz-series-question-select": ({ event, state }) => handleSeriesQuestionSelect(prefix, state, event.data),
      "quiz-series-question-submit": ({ state }) => handleSeriesQuestionSubmit(prefix, state)
    },
    listen: [
      { on: `${prefix}:answer:select`, straps: ["quiz-series-question-select"] },
      { on: `${prefix}:validate`, straps: ["quiz-series-question-submit"] }
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
      type: "tag",
      initial: {
        tag: "p",
        content: `Question ${n}`,
        style: { margin: "4px 0", fontWeight: 500 },
        move: { parentId: "quiz-series-result:items" }
      },
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
    initial: { move: { parentId: "quiz-series:slot" } },
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
          move: "@root"
        },
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
          move: { parentId: "quiz-series-result:card" }
        },
        actions: {}
      },
      ...itemPersos,
      {
        id: "quiz-series-result-score",
        type: "tag",
        initial: {
          tag: "p",
          content: "— / 3",
          style: { fontSize: "1.25rem", fontWeight: 700, margin: "12px 0 4px" },
          move: { parentId: "quiz-series-result:score" }
        },
        actions: {
          "quiz:result:score": {}
        }
      },
      {
        id: "quiz-series-result-verdict",
        type: "tag",
        initial: {
          tag: "p",
          content: "",
          style: { fontWeight: 700, fontSize: "1.125rem" },
          move: { parentId: "quiz-series-result:verdict" }
        },
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

// --- Auto-play track ---

type AutoTrackEvent = { ms: number; name: string; payload?: Record<string, unknown> }

/**
 * Builds the "auto" track: for each question, correct answer(s) selected →
 * resolved-correct → next, 2s apart. Inactive by default (like quiz-hunt's
 * debug track) — the "Auto" button activates it via `track:activate` after
 * a rewind.
 *
 * Static track events never carry `scopeStoryId` (normalizeTrackBucket drops
 * it), so they can never reach a story's `listen` rules / straps — only
 * scene-level `listen` or direct perso actions (matched by exact action name
 * across all mounted persos, no scope needed). This track therefore drives
 * the same visual-only actions the question personas already expose for
 * normal play (`${prefix}:answer:${id}:selected`, `${prefix}:resolved:correct`,
 * `${prefix}:resolved`) instead of the real `${prefix}:answer:select` /
 * `${prefix}:validate` story events — exactly how quiz-hunt's debug track
 * simulates a pass without touching the real select/submit straps. `state`
 * (selectedAnswerIds, answeredCount, score aggregation, result modal) is
 * intentionally not touched — this is a display-only playthrough. `next`
 * remains the real scene-scoped event since scene `listen` has no scope
 * requirement.
 */
function createQuizSeriesAutoTrack(): Record<string, unknown> {
  const events: AutoTrackEvent[] = []
  let cursorMs = 0

  SERIES_QUESTIONS.forEach((question, position) => {
    const prefix = `quiz-series-q${position}`
    const correctIds = new Set(question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id))

    const answerStepMs = cursorMs + AUTO_STEP_MS
    for (const answer of question.answers) {
      events.push({ ms: answerStepMs, name: `${prefix}:answer:${answer.id}:${correctIds.has(answer.id) ? "selected" : "idle"}` })
    }

    const validateStepMs = cursorMs + 2 * AUTO_STEP_MS
    for (const answer of question.answers) {
      if (correctIds.has(answer.id)) {
        events.push({ ms: validateStepMs, name: `${prefix}:answer:${answer.id}:revealed-correct` })
      }
    }
    events.push({ ms: validateStepMs, name: `${prefix}:resolved:correct` })
    events.push({ ms: validateStepMs, name: `${prefix}:resolved` })
    // quiz:question:answered is scene-scoped (createQuizSeriesFameScene.listen), so it
    // reaches the real quiz-series-aggregate strap without needing scopeStoryId — this
    // is what actually reports the score into state.answers/correctCount, unlike the
    // visual-only actions above (see the module-level doc comment on this function).
    const correctAnswerIds = [...correctIds]
    events.push({
      ms: validateStepMs,
      name: "quiz:question:answered",
      payload: {
        questionIndex: question.index,
        selectedAnswerIds: correctAnswerIds,
        correctAnswerIds,
        isCorrect: true
      }
    })

    events.push({ ms: cursorMs + 3 * AUTO_STEP_MS, name: "quiz:question:next" })
    cursorMs += 3 * AUTO_STEP_MS
  })

  // Leaves room for the last `next`'s chain (quiz-series-advance → quiz:result:show →
  // 300ms modal fade-in) to finish before the player locks the sequence.
  events.push({ ms: cursorMs + AUTO_STEP_MS, name: "sequence:end" })

  return {
    id: QUIZ_SERIES_AUTO_TRACK_ID,
    active: false,
    order: 100,
    source: "story",
    events
  }
}

// --- Scene builder ---

export function createQuizSeriesFameScene(): SceneDoc {
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
  allStories["quiz-series-progress-story"] = createSeriesProgressStory()

  return {
    id: "quiz-series-fame-scene",
    initial: {
      currentIndex: 0,
      answers: [],
      answeredCount: 0,
      correctCount: 0,
      lastQuestionIndex: undefined,
      lastResult: undefined
    },
    // Mirrors the per-question `init` fix: resetSceneForReplay() calls scene.init()
    // on every rewind but never resets scene.state to scene.initial by itself, so
    // without this the previous playthrough's answers/score survive a rewind.
    init: (scene) => {
      scene.state = {
        currentIndex: 0,
        answers: [],
        answeredCount: 0,
        correctCount: 0,
        lastQuestionIndex: undefined,
        lastResult: undefined
      }
    },
    straps: undefined,
    listen: [
      { on: "quiz:question:next", straps: ["quiz-series-advance"] },
      { on: "quiz:question:answered", straps: ["quiz-series-aggregate"] },
      { on: "quiz:result:show", straps: ["quiz-result-render"] }
    ],
    stories: allStories,
    tracks: {
      [QUIZ_SERIES_AUTO_TRACK_ID]: createQuizSeriesAutoTrack()
    }
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

function handleSeriesAggregate(
  state: Readonly<Record<string, unknown>>,
  eventData: Record<string, unknown> | undefined
) {
  const payload = eventData as QuizQuestionAnsweredPayload | undefined
  if (payload === undefined) return undefined

  const previous = Array.isArray(state.answers)
    ? (state.answers as QuizQuestionAnsweredPayload[]).filter(
        (a) => a.questionIndex !== payload.questionIndex
      )
    : []
  const answers = [...previous, {
    questionIndex: payload.questionIndex,
    selectedAnswerIds: payload.selectedAnswerIds,
    correctAnswerIds: payload.correctAnswerIds,
    isCorrect: payload.isCorrect
  }].sort((a, b) => a.questionIndex - b.questionIndex)

  const answeredCount = answers.length
  const correctCount = answers.filter((a) => a.isCorrect).length
  const progressPercent = Math.round((answeredCount / SERIES_TOTAL) * 100)
  const successPercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
  const successColor = correctCount / SERIES_TOTAL >= SERIES_THRESHOLD / SERIES_TOTAL ? "#16a34a" : "#dc2626"

  return {
    update: {
      answers,
      answeredCount,
      correctCount,
      lastQuestionIndex: payload.questionIndex,
      lastResult: payload.isCorrect
    },
    events: [
      { name: "quiz:series:progress:count", data: { content: `${answeredCount} / ${SERIES_TOTAL}` } },
      { name: "quiz:series:progress:fill", data: { style: { width: `${progressPercent}%` } } },
      { name: "quiz:series:progress:rate", data: { content: `${successPercent} %`, style: { color: successColor } } }
    ]
  }
}

export const quizSeriesFameStraps: StrapCollection = {
  "quiz-series-advance": ({ state }) => handleSeriesAdvance(state),
  "quiz-series-aggregate": ({ event, state }) => handleSeriesAggregate(state, event.data),
  "quiz-result-render": ({ state }) => handleResultRender(state)
}

import type { CodPlayEventime, CodPlayEventimeTarget } from "codplay"
import type { V2DemoPlayback } from "../../layout/types"
import { SERIES_QUESTIONS, SERIES_TOTAL } from "./series-data"
import {
  QUIZ_SERIES_AUTO_TRACK_ID,
  QUIZ_SERIES_INTERACTIVE_TRACK_ID,
} from "./track-contract"

const AUTO_STEP_MS = 2_000

/** Builds one story-scoped injection for the automatic track. */
function storyInjection(
  storyId: string,
  startAt: number,
  name: string,
  data?: CodPlayEventime["data"],
): { eventime: CodPlayEventime; target: CodPlayEventimeTarget } {
  return {
    eventime: { name, startAt, data },
    target: { scope: "story", storyId, trackId: QUIZ_SERIES_AUTO_TRACK_ID }
  }
}

/** Builds the externally injected visual sequence used by the Auto telco button. */
function createQuizSeriesAutoPlayback(): V2DemoPlayback {
  const injections: Array<{ eventime: CodPlayEventime; target: CodPlayEventimeTarget }> = [
    {
      eventime: {
        name: "track:deactivate",
        data: { trackIds: [QUIZ_SERIES_INTERACTIVE_TRACK_ID] }
      },
      target: { scope: "scene" }
    },
    {
      eventime: {
        name: "track:activate",
        data: { trackIds: [QUIZ_SERIES_AUTO_TRACK_ID] }
      },
      target: { scope: "scene" }
    }
  ]

  SERIES_QUESTIONS.forEach((question, position) => {
    const storyId = `quiz-series-q${position}-story`
    const prefix = `quiz-series-q${position}`
    const correctIds = new Set(
      question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id),
    )
    const answerAt = (position * 3 + 1) * AUTO_STEP_MS
    const validateAt = (position * 3 + 2) * AUTO_STEP_MS
    const nextAt = (position * 3 + 3) * AUTO_STEP_MS

    for (const answer of question.answers) {
      injections.push(storyInjection(
        storyId,
        answerAt,
        `${prefix}:answer:${answer.id}:${correctIds.has(answer.id) ? "selected" : "idle"}`,
      ))
    }
    for (const answer of question.answers) {
      injections.push(storyInjection(
        storyId,
        validateAt,
        `${prefix}:answer:${answer.id}:${answer.isCorrect ? "revealed-correct" : "locked"}`,
      ))
    }
    injections.push(storyInjection(storyId, validateAt, `${prefix}:resolved:correct`))
    injections.push(storyInjection(storyId, validateAt, `${prefix}:resolved`))

    const answeredCount = position + 1
    const progressPercent = Math.round((answeredCount / SERIES_TOTAL) * 100)
    injections.push(storyInjection(
      "quiz-series-progress-story",
      validateAt,
      "quiz:series:progress:count",
      { content: `${answeredCount} / ${SERIES_TOTAL}` },
    ))
    injections.push(storyInjection(
      "quiz-series-progress-story",
      validateAt,
      "quiz:series:progress:fill",
      { style: { width: `${progressPercent}%` } },
    ))
    injections.push(storyInjection(
      "quiz-series-progress-story",
      validateAt,
      "quiz:series:progress:rate",
      { content: "100 %", style: { color: "#16a34a" } },
    ))

    injections.push(storyInjection(storyId, nextAt, `quiz:question:${position}:hide`))
    if (position + 1 < SERIES_TOTAL) {
      injections.push(storyInjection(
        `quiz-series-q${position + 1}-story`,
        nextAt,
        `quiz:question:${position + 1}:show`,
      ))
    }
  })

  const resultAt = SERIES_TOTAL * 3 * AUTO_STEP_MS
  injections.push(storyInjection("quiz-series-result-story", resultAt, "quiz:result:show"))
  for (let index = 1; index <= SERIES_TOTAL; index += 1) {
    injections.push(storyInjection(
      "quiz-series-result-story",
      resultAt,
      `quiz:result:item:${index}:correct`,
    ))
  }
  injections.push(storyInjection(
    "quiz-series-result-story",
    resultAt,
    "quiz:result:score",
    { content: `${SERIES_TOTAL} / ${SERIES_TOTAL}` },
  ))
  injections.push(storyInjection(
    "quiz-series-result-story",
    resultAt,
    "quiz:result:verdict:passed",
  ))

  return { label: "Auto", injections }
}

export const quizSeriesAutoPlayback = createQuizSeriesAutoPlayback()

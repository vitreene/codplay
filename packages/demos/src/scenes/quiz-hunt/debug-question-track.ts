import type { QuizHuntWord } from "./types"

export const QUIZ_HUNT_DEBUG_QUESTION_TRACK_ID = "quiz-hunt-debug-questions"

const QUESTION_PASS_MS = 4000
const ANSWER_AT_MS = 1300
const HIDE_AT_MS = 3800

type DebugTrackEvent = {
  ms: number
  name: string
}

type DebugQuestionDescriptor = {
  kind: "trial" | "final"
  word: QuizHuntWord
  prefix: string
}

/** Resolves one deliberately wrong answer id for visual correction inspection. */
function resolveWrongAnswerId(question: QuizHuntWord["trial"]["question"]): string | null {
  return question.answers.find((answer) => !answer.isCorrect)?.id ?? question.answers[0]?.id ?? null
}

/** Resolves the correct answer ids to select for one visual correction pass. */
function resolveCorrectAnswerIds(question: QuizHuntWord["trial"]["question"]): string[] {
  return question.answers.filter((answer) => answer.isCorrect).map((answer) => answer.id)
}

/** Adds answer/result reset events for one debug question block. */
function pushClearEvents(events: DebugTrackEvent[], ms: number, descriptor: DebugQuestionDescriptor): void {
  const question = descriptor.kind === "trial" ? descriptor.word.trial.question : descriptor.word.finalQuestion
  events.push({ ms, name: `debug:${descriptor.prefix}:result:clear` })
  for (const answer of question.answers) {
    events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:idle` })
    events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:clear` })
  }
}

/** Adds one visual answer state for a debug question block. */
function pushAnswerEvents(events: DebugTrackEvent[], ms: number, descriptor: DebugQuestionDescriptor, mode: "incorrect" | "correct"): void {
  const question = descriptor.kind === "trial" ? descriptor.word.trial.question : descriptor.word.finalQuestion
  const selectedAnswerIds = mode === "correct"
    ? resolveCorrectAnswerIds(question)
    : [resolveWrongAnswerId(question)].filter((answerId): answerId is string => answerId !== null)
  const selectedSet = new Set(selectedAnswerIds)

  for (const answer of question.answers) {
    events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:${selectedSet.has(answer.id) ? "selected" : "idle"}` })
  }

  for (const answer of question.answers) {
    if (selectedSet.has(answer.id) && mode === "correct") {
      events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:revealed-correct` })
      continue
    }

    if (selectedSet.has(answer.id)) {
      events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:revealed-incorrect` })
      continue
    }

    if (answer.isCorrect && mode === "incorrect") {
      events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:revealed-missed-correct` })
      continue
    }

    events.push({ ms, name: `debug:${descriptor.prefix}:answer:${answer.id}:clear` })
  }

  events.push({ ms, name: `debug:${descriptor.prefix}:resolved:${mode}` })
}

/** Adds one 4s visual pass for a question, either wrong or correct. */
function pushQuestionPass(events: DebugTrackEvent[], startMs: number, descriptor: DebugQuestionDescriptor, mode: "incorrect" | "correct"): void {
  if (descriptor.kind === "trial") {
    events.push({ ms: startMs, name: `game:trial:${descriptor.word.id}:show` })
    events.push({ ms: startMs + 100, name: `game:trial:${descriptor.word.id}:reveal-question` })
  } else {
    events.push({ ms: startMs, name: `game:final:${descriptor.word.id}:show` })
  }

  pushClearEvents(events, startMs + 200, descriptor)
  pushAnswerEvents(events, startMs + ANSWER_AT_MS, descriptor, mode)
  events.push({
    ms: startMs + HIDE_AT_MS,
    name: descriptor.kind === "trial" ? `game:trial:${descriptor.word.id}:hide` : `game:final:${descriptor.word.id}:hide`
  })
}

/** Builds the inactive visual-inspection track for every trial and final question. */
export function createQuizHuntDebugQuestionTrack(words: QuizHuntWord[]): Record<string, unknown> {
  const descriptors: DebugQuestionDescriptor[] = [
    ...words.map((word): DebugQuestionDescriptor => ({ kind: "trial", word, prefix: `trial-${word.id}` })),
    ...words.map((word): DebugQuestionDescriptor => ({ kind: "final", word, prefix: `final-${word.id}` }))
  ]
  const events: DebugTrackEvent[] = []
  let cursorMs = 0

  for (const descriptor of descriptors) {
    pushQuestionPass(events, cursorMs, descriptor, "incorrect")
    cursorMs += QUESTION_PASS_MS
    pushQuestionPass(events, cursorMs, descriptor, "correct")
    cursorMs += QUESTION_PASS_MS
  }

  return {
    id: QUIZ_HUNT_DEBUG_QUESTION_TRACK_ID,
    active: false,
    order: 100,
    source: "story",
    events
  }
}

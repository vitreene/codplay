import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { QuizQuestionLabels, QuizQuestionStoryConfig, ResolvedQuizQuestion } from "../../quiz-question-scene"
import { quizQuestionStoryStraps } from "../../quiz-question-scene"
import { createQuizAnswerPersos, createQuizControlPersos } from "./answer-persos"
import type { QuizHuntWord } from "../types"

/**
 * Builds one final-question story for a word. Only the one whose color matches the seed-drawn
 * `finalColor` (resolved at runtime against whichever word actually filled that basket slot) is
 * ever shown — but all 16 are pre-built since the word isn't known until the basket fills up.
 */
export function createFinalStory(
  word: QuizHuntWord,
  index: number,
  config: QuizQuestionStoryConfig,
  labels: QuizQuestionLabels
): SceneStoryDoc {
  const prefix = `final-${word.id}`
  const panelId = `${prefix}-panel`
  const groupName = `${prefix}-answer`

  const question: ResolvedQuizQuestion = {
    index,
    type: word.finalQuestion.type,
    prompt: word.finalQuestion.prompt,
    answers: word.finalQuestion.answers,
    labels
  }

  const persos: PersoDoc[] = [
    {
      id: panelId,
      type: "layout",
        initial: {
          markup: `
            <div class="quiz-hunt-final-panel is-hidden">
              <div data-part="${prefix}:fieldset-slot"></div>
            </div>
          `,
        move: { parentId: "game:zone:main" }
      },
      actions: {
        [`game:final:${word.id}:show`]: { className: { add: "is-visible", remove: "is-hidden" } },
        [`game:final:${word.id}:hide`]: { className: { add: "is-hidden", remove: "is-visible" } }
      }
    },
    {
      id: `${prefix}-fieldset`,
      type: "layout",
      initial: {
        markup: `
          <fieldset class="quiz-question-fieldset">
            <legend class="quiz-hunt-question-title-slot is-final" data-part="${prefix}:title"></legend>
            <p data-part="${prefix}:hint"></p>
            <div data-part="${prefix}:answers"></div>
            <div data-part="${prefix}:controls"></div>
            <p data-part="${prefix}:result" aria-live="polite"></p>
          </fieldset>
        `,
        attr: { disabled: false },
        move: { parentId: `${prefix}:fieldset-slot` }
      },
      actions: {
        "quiz:question:resolved": { attr: { disabled: true } }
      }
    },
    {
      id: `${prefix}-title`,
      type: "tag",
      initial: { tag: "span", content: question.prompt, move: { parentId: `${prefix}:title` } },
      actions: {}
    },
    {
      id: `${prefix}-hint`,
      type: "tag",
      initial: {
        tag: "span",
        className: "quiz-hunt-question-hint",
        content: question.type === "multiple" ? question.labels.multipleHint : "",
        move: { parentId: `${prefix}:hint` }
      },
      actions: {}
    },
    ...createQuizAnswerPersos(prefix, question, groupName),
    ...createQuizControlPersos(prefix, question, "#7c3aed")
  ]

  return {
    id: `game-final-${word.id}-story`,
    entries: [panelId],
    initial: undefined,
    state: {
      question,
      config,
      selectedAnswerIds: [],
      revealed: undefined,
      resolved: undefined,
      disabled: false,
      retryCount: 0
    },
    straps: quizQuestionStoryStraps,
    listen: [
      { on: "quiz:question:answer:select", straps: ["quiz-question-select"] },
      { on: "quiz:question:validate", straps: ["quiz-question-submit"] }
    ],
    persos
  }
}

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
          <div class="quiz-hunt-final-panel">
            <div data-part="${prefix}:fieldset-slot"></div>
          </div>
        `,
        style: {
          display: "none",
          position: "absolute",
          inset: "0",
          padding: "20px",
          border: "1px solid rgba(15, 23, 42, 0.12)",
          borderRadius: "12px",
          backgroundColor: "#ffffff",
          overflowY: "auto",
          boxSizing: "border-box"
        },
        move: { parentId: "game:zone:main" }
      } as unknown as PersoDoc["initial"],
      actions: {
        [`game:final:${word.id}:show`]: { style: { display: "block" } },
        [`game:final:${word.id}:hide`]: { style: { display: "none" } }
      }
    },
    {
      id: `${prefix}-fieldset`,
      type: "layout",
      initial: {
        markup: `
          <fieldset class="quiz-question-fieldset" style="border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px;">
            <legend data-part="${prefix}:title" style="font-weight: 700; font-size: 1.1rem;"></legend>
            <p data-part="${prefix}:hint"></p>
            <div data-part="${prefix}:answers"></div>
            <div data-part="${prefix}:controls"></div>
            <p data-part="${prefix}:result" aria-live="polite"></p>
          </fieldset>
        `,
        attr: { disabled: false },
        move: { parentId: `${prefix}:fieldset-slot` }
      } as unknown as PersoDoc["initial"],
      actions: {
        "quiz:question:resolved": { attr: { disabled: true } }
      }
    },
    {
      id: `${prefix}-title`,
      type: "tag",
      initial: { tag: "span", content: question.prompt, move: { parentId: `${prefix}:title` } } as unknown as PersoDoc["initial"],
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
      } as unknown as PersoDoc["initial"],
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

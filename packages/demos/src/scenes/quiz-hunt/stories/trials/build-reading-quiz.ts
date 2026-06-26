import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { QuizQuestionLabels, QuizQuestionStoryConfig, ResolvedQuizQuestion } from "../../../quiz-question-scene"
import { quizQuestionStoryStraps } from "../../../quiz-question-scene"
import { createQuizAnswerPersos, createQuizControlPersos } from "../answer-persos"
import type { QuizHuntWord } from "../../types"

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Builds one "reading+quiz" trial story: a text clue (always visible while open) followed by
 * a question revealed after a fixed delay. Opening/reveal/timing is orchestrated by the
 * scene-level `game-router` strap — this story only embeds the question select/submit straps,
 * which are local to its own answer/validate persos (same pattern as quiz-series).
 */
export function createReadingQuizTrial(
  word: QuizHuntWord,
  index: number,
  config: QuizQuestionStoryConfig,
  labels: QuizQuestionLabels
): SceneStoryDoc {
  const prefix = `trial-${word.id}`
  const panelId = `${prefix}-panel`
  const groupName = `${prefix}-answer`
  const retryEventName = `game:trial:${word.id}:retry`

  const question: ResolvedQuizQuestion = {
    index,
    type: word.trial.question.type,
    prompt: word.trial.question.prompt,
    answers: word.trial.question.answers,
    labels
  }

  const persos: PersoDoc[] = [
    {
      id: panelId,
      type: "layout",
        initial: {
          markup: `
            <div class="quiz-hunt-trial-panel is-hidden">
              <p class="quiz-hunt-trial-eyebrow" data-part="${prefix}:epreuve-label">${escapeHtml(word.trial.epreuveLabel)}</p>
              <p class="quiz-hunt-trial-instruction" data-part="${prefix}:consigne">${escapeHtml(word.trial.consigne)}</p>
              <p class="quiz-hunt-trial-clue" data-part="${prefix}:clue">${escapeHtml(word.trial.clueText)}</p>
              <div data-part="${prefix}:fieldset-slot"></div>
            </div>
          `,
        move: { parentId: "game:zone:main" }
      },
      actions: {
        [`game:trial:${word.id}:show`]: { className: { add: "is-visible", remove: "is-hidden" } },
        [`game:trial:${word.id}:hide`]: { className: { add: "is-hidden", remove: "is-visible" } }
      }
    },
    {
      id: `${prefix}-fieldset`,
      type: "layout",
      initial: {
        markup: `
          <fieldset class="quiz-question-fieldset is-hidden">
            <legend class="quiz-hunt-question-title-slot" data-part="${prefix}:title"></legend>
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
        [`game:trial:${word.id}:reveal-question`]: { className: { remove: "is-hidden" } },
        "quiz:question:resolved": { attr: { disabled: true } },
        [retryEventName]: { attr: { disabled: false } }
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
    ...createQuizAnswerPersos(prefix, question, groupName, retryEventName),
    ...createQuizControlPersos(prefix, question, "#2563eb", retryEventName)
  ]

  return {
    id: `game-trial-${word.id}-story`,
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

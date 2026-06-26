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
          <div class="quiz-hunt-trial-panel">
            <p data-part="${prefix}:epreuve-label" style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: #64748b; margin: 0;">${escapeHtml(word.trial.epreuveLabel)}</p>
            <p data-part="${prefix}:consigne" style="font-weight: 600; margin: 4px 0 12px;">${escapeHtml(word.trial.consigne)}</p>
            <p data-part="${prefix}:clue" style="margin: 0 0 16px;">${escapeHtml(word.trial.clueText)}</p>
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
      },
      actions: {
        [`game:trial:${word.id}:show`]: { style: { display: "block" } },
        [`game:trial:${word.id}:hide`]: { style: { display: "none" } }
      }
    },
    {
      id: `${prefix}-fieldset`,
      type: "layout",
      initial: {
        markup: `
          <fieldset class="quiz-question-fieldset" style="border: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px;">
            <legend data-part="${prefix}:title" style="font-weight: 700;"></legend>
            <p data-part="${prefix}:hint"></p>
            <div data-part="${prefix}:answers"></div>
            <div data-part="${prefix}:controls"></div>
            <p data-part="${prefix}:result" aria-live="polite"></p>
          </fieldset>
        `,
        style: { display: "none" },
        attr: { disabled: false },
        move: { parentId: `${prefix}:fieldset-slot` }
      },
      actions: {
        [`game:trial:${word.id}:reveal-question`]: { style: { display: "block" } },
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
        content: question.type === "multiple" ? question.labels.multipleHint : "",
        style: { color: "#475569", fontSize: "0.875rem" },
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

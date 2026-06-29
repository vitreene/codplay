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
        `
      },
      // Attached on demand on `:show`, detached for real on `:hide` once
      // the fade-out (CSS opacity transition, quiz-hunt.css) has had time
      // to play — see PRATIQUES.md item 3. ActionSequence (the
      // `[{action,durationMs?}, ...]` chaining shape) is a valid runtime
      // action value not yet reflected in the static `ActionDoc` type —
      // cast needed, mirrors move-off-story.ts.
      actions: {
        [`game:final:${word.id}:show`]: [
          { action: { move: { parentId: "game:zone:main" } }, durationMs: 20 },
          { action: { className: { add: "is-visible", remove: "is-hidden" } } }
        ],
        [`game:final:${word.id}:hide`]: [
          { action: { className: { add: "is-hidden", remove: "is-visible" } }, durationMs: 200 },
          { action: { move: "off" } }
        ]
      } as unknown as PersoDoc<"layout">["actions"]
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
    // Not the story's permanent root (v1-story-spec.md: `entries` designates
    // persos placed at the story's root, mounted directly in its story host
    // regardless of move) — this panel is absent until its own `:show`
    // action moves it, and detached again on `:hide` (`move:"off"`). Listing
    // it as an entry would make it always-mounted by definition, defeating
    // that mechanism and the seek-time refresh filter that depends on it
    // (`resolveMountedPersoIdsAtSeek`) — see PRATIQUES.md item 3.
    entries: [],
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

import type { PersoDoc, SceneStoryDoc } from "codplay/player/types"
import type { QuizQuestionLabels, QuizQuestionStoryConfig, ResolvedQuizQuestion } from "../../../quiz-question-scene"
import { quizQuestionStoryStraps } from "../../../quiz-question-scene"
import { createQuizAnswerPersos, createQuizControlPersos } from "../answer-persos"
import type { QuizHuntClueMedia, QuizHuntWord } from "../../types"

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Builds the reading clue slot content: plain text, video, or a temporary placeholder. */
function createCluePersos(prefix: string, word: QuizHuntWord): PersoDoc[] {
  const clueMedia = word.trial.clueMedia
  if (clueMedia?.type !== "video") {
    return [
      {
        id: `${prefix}-clue-text`,
        type: "tag",
        initial: {
          tag: "p",
          className: "quiz-hunt-trial-clue",
          content: word.trial.clueText ?? "",
          move: { parentId: `${prefix}:clue-slot` }
        },
        actions: {}
      }
    ]
  }

  return createClueVideoPersos(prefix, word.id, clueMedia)
}

/** Builds the optional clue video and its placeholder for one trial. */
function createClueVideoPersos(prefix: string, wordId: string, clueMedia: QuizHuntClueMedia): PersoDoc[] {
  const startEventName = `game:trial:${wordId}:clue-media:start`
  const stopEventName = `game:trial:${wordId}:clue-media:stop`

  const mediaPersos: PersoDoc[] = []

  if (typeof clueMedia.src === "string" && clueMedia.src.length > 0) {
    mediaPersos.push({
      id: `${prefix}-clue-video`,
      type: "media",
      initial: {
        tag: "video",
        src: clueMedia.src,
        master: false,
        className: "quiz-hunt-trial-clue-video",
        video: { style: { width: "100%", display: "block" }, controls: true, muted: true },
        move: { parentId: `${prefix}:clue-slot` }
      },
      actions: {
        [startEventName]: { broadcast: { type: "START", startAt: 0 } },
        [stopEventName]: { broadcast: { type: "STOP" } }
      }
    } as unknown as PersoDoc)
  } else {
    mediaPersos.push({
      id: `${prefix}-clue-video-placeholder`,
      type: "tag",
      initial: {
        tag: "div",
        className: "quiz-hunt-trial-clue-video-placeholder",
        content: clueMedia.placeholderText ?? "Video a brancher dans assets.",
        move: { parentId: `${prefix}:clue-slot` }
      },
      actions: {}
    })
  }

  return mediaPersos
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
            <div data-part="${prefix}:clue-slot"></div>
            <div data-part="${prefix}:fieldset-slot"></div>
          </div>
        `
      },
      // Attached on demand on `:show`, detached for real on `:hide` once
      // the fade-out (CSS opacity transition, quiz-hunt.css) has had time
      // to play — see docs/formalisation/pratiques.md item 3. ActionSequence (the
      // `[{action,durationMs?}, ...]` chaining shape) is a valid runtime
      // action value not yet reflected in the static `ActionDoc` type —
      // cast needed, mirrors move-off-story.ts.
      actions: {
        [`game:trial:${word.id}:show`]: {
          move: { parentId: "game:zone:main" },
          className: { add: "is-visible", remove: "is-hidden" }
        },
        [`game:trial:${word.id}:hide`]: [
          { action: { className: { add: "is-hidden", remove: "is-visible" } }, durationMs: 200 },
          { action: { move: "@off" } }
        ],
        [retryEventName]: {
          move: { parentId: "game:zone:main" },
          className: { add: "is-visible", remove: "is-hidden" }
        }
      } as unknown as PersoDoc<"layout">["actions"]
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
        [retryEventName]: {
          attr: { disabled: false },
          className: { add: "is-hidden" }
        }
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
    ...createCluePersos(prefix, word),
    ...createQuizAnswerPersos(prefix, question, groupName, retryEventName),
    ...createQuizControlPersos(prefix, question, "#2563eb", retryEventName)
  ]

  return {
    id: `game-trial-${word.id}-story`,
    // No move: '@root' here on purpose — this panel is absent until its own
    // `:show` action moves it, and detached again on `:hide` (`move:"@off"`).
    // See v1-perso-spec.md 4bis and v1-seek-spec.md (appendice 2026-06-29).
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

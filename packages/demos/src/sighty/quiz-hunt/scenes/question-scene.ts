import type { SceneDoc } from 'codplay/scene/types'
import type { CompiledRecord } from 'codplay'
import type { StrapFunction } from 'codplay/runtime/player'
import {
  createQuizAnswerPersos,
  createQuizCorrectionEvents,
  createQuizLocalState,
  resolveQuizAnswer,
  selectQuizAnswer,
} from '../../shared/quiz/answer-circuit'
import { resolveQuizHuntColorStyle } from '../../../v1/scenes/quiz-hunt/color-palette'
import type { QuizHuntFinal, QuizHuntTrial } from '../game-data'
import {
  finalAnsweredEvent,
  finalFeedbackFinishedEvent,
  trialAnsweredEvent,
  trialFeedbackFinishedEvent,
} from '../messages'

type QuestionScenePerso = SceneDoc<string>['stories'][string]['persos'][number]
type QuizHuntQuestionSceneSource = QuizHuntTrial | QuizHuntFinal

/** Builds one autonomous trial scene with the original clue panel and quiz circuit. */
export function createQuestionScene(trial: QuizHuntTrial, tileNumber: number): SceneDoc<string> {
  return createQuizQuestionScene(trial, tileNumber, 'trial')
}

/** Builds one eager final question scene using the original final-question panel. */
export function createFinalQuestionScene(final: QuizHuntFinal, tileNumber: number): SceneDoc<string> {
  return createQuizQuestionScene(final, tileNumber, 'final')
}

/** Creates the shared answer circuit with either the trial clue or final panel. */
function createQuizQuestionScene(
  source: QuizHuntQuestionSceneSource,
  tileNumber: number,
  mode: 'trial' | 'final',
): SceneDoc<string> {
  const isFinal = mode === 'final'
  const prefix = isFinal ? `quiz-hunt:final:${source.id}` : `quiz-hunt:question:${source.id}`
  const revealEvent = isFinal ? undefined : `${prefix}:reveal`
  const persos: QuestionScenePerso[] = [
    createQuestionLayout(source, prefix, mode),
    createQuestionBadge(source, prefix, tileNumber, isFinal),
    createQuestionPrompt(source, prefix, isFinal),
    createQuestionHint(source, prefix),
    createQuestionFieldset(prefix, revealEvent, isFinal),
    ...createQuizAnswerPersos(source.question, {
      persoPrefix: `${prefix}-quiz`,
      eventPrefix: prefix,
    }, {
      selectionIcon: 'quiz-hunt-answer-icon quiz-hunt-answer-icon-selection',
      correctionIcon: 'quiz-hunt-answer-icon quiz-hunt-answer-icon-correction',
    }),
    createQuestionValidateButton(source, prefix),
    createQuestionFeedback(prefix),
    ...(isFinal ? [] : createCluePersos(source as QuizHuntTrial, prefix)),
  ]

  return {
    id: isFinal ? `quiz-hunt-final-question-${source.id}` : `quiz-hunt-question-${source.id}`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        state: { ...createQuizLocalState(source.question), revealed: isFinal },
        straps: {
          ...(isFinal ? {} : {
            'quiz-hunt-question-reveal': ({ state }) => {
              if (state.revealed === true) return undefined
              return { update: { revealed: true }, events: [{ name: revealEvent! }] }
            },
          }),
          'quiz-hunt-question-select-answer': ({ event, state }) => {
            if (state.revealed !== true) return undefined
            return selectQuizAnswer(prefix, source.question, state, event.data)
          },
          'quiz-hunt-question-submit-answer': createAnswerSubmissionStrap(source, prefix, mode),
        },
        listen: [
          ...(isFinal ? [] : [{ on: revealEvent!, straps: ['quiz-hunt-question-reveal'] }]),
          { on: `${prefix}:answer:select`, straps: ['quiz-hunt-question-select-answer'] },
          { on: `${prefix}:validate`, straps: ['quiz-hunt-question-submit-answer'] },
        ],
        persos,
      },
    },
  }
}

/** Reuses the original V1 reading or final panel inside one question scene. */
function createQuestionLayout(
  source: QuizHuntQuestionSceneSource,
  prefix: string,
  mode: 'trial' | 'final',
): QuestionScenePerso {
  const baseId = mode === 'final' ? `quiz-hunt-final-${source.id}` : `quiz-hunt-question-${source.id}`
  const panel = mode === 'final'
    ? `<div id="${baseId}-panel" class="quiz-hunt-final-panel">
        <div id="${baseId}-header" class="quiz-hunt-trial-header">
          <p id="${baseId}-eyebrow" class="quiz-hunt-trial-eyebrow">Épreuve finale</p>
          <div id="${baseId}-badge-slot" class="quiz-hunt-question-badge-slot" data-part="${prefix}:badge"></div>
        </div>
        <div id="${baseId}-form-host" data-part="${prefix}:form"></div>
      </div>`
    : createTrialPanel(source as QuizHuntTrial, prefix, baseId)

  return {
    id: `${baseId}-layout`,
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-main-zone',
      style: { width: '100%', height: '100%', minWidth: 0, minHeight: 0 },
      markup: `<div id="${baseId}-root" class="quiz-hunt-main-zone">${panel}</div>`,
    },
    actions: {},
  }
}

/** Creates the original reading panel with its clue, instructions, and answer host. */
function createTrialPanel(trial: QuizHuntTrial, prefix: string, baseId: string): string {
  return `<div id="${baseId}-panel" class="quiz-hunt-trial-panel">
    <div id="${baseId}-header" class="quiz-hunt-trial-header">
      <p id="${baseId}-eyebrow" class="quiz-hunt-trial-eyebrow">${escapeHtml(trial.clue.label)}</p>
      <div id="${baseId}-badge-slot" class="quiz-hunt-question-badge-slot" data-part="${prefix}:badge"></div>
    </div>
    <p id="${baseId}-instructions" class="quiz-hunt-trial-instruction">${escapeHtml(trial.clue.instructions)}</p>
    <div id="${baseId}-clue" data-part="${prefix}:clue"></div>
    <div id="${baseId}-form-host" data-part="${prefix}:form"></div>
  </div>`
}

/** Creates the original color polygon badge with its tile number or final mark. */
function createQuestionBadge(
  source: QuizHuntQuestionSceneSource,
  prefix: string,
  tileNumber: number,
  isFinal: boolean,
): QuestionScenePerso {
  const polygonByColor: Record<string, { sides: number; inner?: number; outer: number; rotationDeg?: number }> = {
    rouge: { sides: 5, inner: 18, outer: 42, rotationDeg: -18 },
    bleu: { sides: 12, inner: 34, outer: 42, rotationDeg: -15 },
    vert: { sides: 5, outer: 42, rotationDeg: -18 },
    jaune: { sides: 8, outer: 42, rotationDeg: 22.5 },
  }
  const colorStyle = resolveQuizHuntColorStyle(source.color)
  return {
    id: `${prefix}-badge`,
    type: 'polygon',
    initial: {
      move: { target: `${prefix}:badge` },
      content: isFinal ? '🏆' : String(tileNumber),
      ...(polygonByColor[source.color] ?? { sides: 6, outer: 40 }),
      style: {
        width: '2.5rem',
        minWidth: '2.5rem',
        height: '2.5rem',
        minHeight: '2.5rem',
        color: colorStyle.solid,
        '--polygon-label-color': '#ffffff',
        fontSize: '1.35rem',
        fontWeight: '900',
        filter: 'drop-shadow(0 0.18rem 0.4rem rgba(15, 23, 42, 0.28))',
      },
    },
    actions: {},
  }
}

/** Creates the question legend mounted inside the answer fieldset. */
function createQuestionPrompt(
  source: QuizHuntQuestionSceneSource,
  prefix: string,
  isFinal: boolean,
): QuestionScenePerso {
  return {
    id: `${prefix.replace(/:/g, '-')}-prompt`,
    type: 'tag',
    initial: {
      tag: 'legend',
      content: source.question.prompt,
      className: `quiz-hunt-question-title-slot${isFinal ? ' is-final' : ''}`,
      move: { target: `${prefix}:title` },
    },
  }
}

/** Creates the V1 multiple-answer hint inside the original answer fieldset. */
function createQuestionHint(source: QuizHuntQuestionSceneSource, prefix: string): QuestionScenePerso {
  return {
    id: `${prefix.replace(/:/g, '-')}-hint`,
    type: 'tag',
    initial: {
      tag: 'span',
      content: source.question.type === 'multiple' ? 'Plusieurs réponses possibles' : '',
      className: 'quiz-hunt-question-hint',
      move: { target: `${prefix}:hint` },
    },
  }
}

/** Creates the original answer fieldset with named answer and control regions. */
function createQuestionFieldset(
  prefix: string,
  revealEvent: string | undefined,
  isFinal: boolean,
): QuestionScenePerso {
  const sceneId = prefix.replace(/:/g, '-')
  const fieldsetClass = `quiz-question-fieldset${isFinal ? '' : ' is-hidden'}`
  return {
    id: `${sceneId}-fieldset`,
    type: 'layout',
    initial: {
      className: fieldsetClass,
      markup: `<fieldset id="${sceneId}-answers" class="${fieldsetClass}">
        <legend id="${sceneId}-title-slot" class="quiz-hunt-question-title-slot" data-part="${prefix}:title"></legend>
        <p id="${sceneId}-hint-slot" data-part="${prefix}:hint"></p>
        <div id="${sceneId}-answer-group" class="quiz-question-answers" data-part="${prefix}:answers"></div>
        <div id="${sceneId}-controls" data-part="${prefix}:controls"></div>
        <p id="${sceneId}-feedback-slot" data-part="${prefix}:feedback" aria-live="polite"></p>
      </fieldset>`,
      attr: { disabled: false },
      move: { target: `${prefix}:form` },
    },
    actions: {
      ...(revealEvent === undefined ? {} : { [revealEvent]: { className: { remove: 'is-hidden' } } }),
      [`${prefix}:resolved`]: { attr: { disabled: true } },
    },
  }
}

/** Creates the disabled-until-selection control for one question. */
function createQuestionValidateButton(source: QuizHuntQuestionSceneSource, prefix: string): QuestionScenePerso {
  return {
    id: `${prefix}-validate`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Valider la réponse',
      attr: { id: `${prefix}-validate-button`, type: 'button', disabled: true },
      className: 'quiz-hunt-validate-button',
      style: { '--quiz-hunt-accent': resolveQuizHuntColorStyle(source.color).solid },
      move: { target: `${prefix}:controls` },
    },
    emit: { click: { event: { name: `${prefix}:validate` } } },
    actions: {
      [`${prefix}:selection:available`]: { attr: { disabled: false } },
      [`${prefix}:selection:empty`]: { attr: { disabled: true } },
      [`${prefix}:resolved`]: { attr: { disabled: true } },
    },
  }
}

/** Creates the polite result node updated when the player submits a selection. */
function createQuestionFeedback(prefix: string): QuestionScenePerso {
  const feedbackId = `${prefix.replace(/:/g, '-')}-feedback`
  return {
    id: feedbackId,
    type: 'tag',
    initial: {
      tag: 'p',
      content: '',
      attr: { id: feedbackId, hidden: true },
      className: 'quiz-hunt-question-result',
      move: { target: `${prefix}:feedback` },
    },
    actions: { [`${prefix}:feedback`]: null },
  }
}

/** Creates the clue text or a browser-controlled Nostromo video tag. */
function createCluePersos(
  trial: QuizHuntTrial,
  prefix: string,
): QuestionScenePerso[] {
  if (trial.clue.videoUrl === undefined) {
    return [{
      id: `quiz-hunt-question-${trial.id}-clue-text`,
      type: 'tag',
      initial: {
        tag: 'p',
        content: trial.clue.text ?? '',
        className: 'quiz-hunt-trial-clue',
        move: { target: `${prefix}:clue` },
      },
    }]
  }

  return [{
    id: `quiz-hunt-question-${trial.id}-clue-video`,
    type: 'tag',
    initial: {
      tag: 'video',
      className: 'quiz-hunt-trial-clue-video',
      style: { width: '100%', display: 'block' },
      attr: {
        muted: true,
        playsinline: true,
        controls: true,
        autoplay: true,
        preload: 'auto',
        src: trial.clue.videoUrl,
      },
      move: { target: `${prefix}:clue` },
    },
  }]
}

/** Stores one selected answer and completes the local feedback for its question kind. */
function createAnswerSubmissionStrap(
  source: QuizHuntQuestionSceneSource,
  prefix: string,
  mode: 'trial' | 'final',
): StrapFunction {
  return ({ state, context }) => {
    if (state.revealed !== true) return undefined
    const resolution = resolveQuizAnswer(source.question, state)
    if (resolution === undefined) return undefined
    const { selectedAnswerIds, isCorrect } = resolution
    const events: Array<{ name: string; data?: CompiledRecord; visibility?: 'public' }> = [
      { name: `${prefix}:feedback`, data: {
        content: mode === 'final'
          ? (isCorrect ? 'Gagné !' : 'Perdu')
          : (isCorrect ? `${source.label} rejoint le panier.` : 'Réponse incorrecte. Cette épreuve reste à reprendre.'),
        attr: { hidden: false },
        className: `quiz-hunt-question-result ${isCorrect ? 'is-correct' : 'is-incorrect'}`,
      } },
      { name: `${prefix}:resolved` },
      ...createQuizCorrectionEvents(source.question, prefix, selectedAnswerIds),
    ]
    if (mode === 'trial') {
      events.push({
        name: trialAnsweredEvent(source.id),
        data: { trialId: source.id, isCorrect },
        visibility: 'public',
      })
    } else {
      events.push({
        name: finalAnsweredEvent(source.id),
        data: { finalId: source.id, isCorrect },
        visibility: 'public',
      })
    }
    const localResolution = { update: { selectedAnswerIds, submitted: true }, events }
    return [
      localResolution,
      context.planned.wait(2_000, {
        event: {
          name: feedbackFinishedEventName(source.id, mode),
          visibility: 'public',
          data: mode === 'trial' ? { trialId: source.id } : { finalId: source.id },
        },
      }),
    ]
  }
}

/** Selects the public feedback-completion event for a trial or final question. */
function feedbackFinishedEventName(id: string, mode: 'trial' | 'final'): string {
  return mode === 'trial' ? trialFeedbackFinishedEvent(id) : finalFeedbackFinishedEvent(id)
}

/** Escapes source text before embedding it into scene-authored markup. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

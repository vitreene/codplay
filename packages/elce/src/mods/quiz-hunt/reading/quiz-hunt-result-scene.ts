import type { SceneDoc } from 'codplay/scene/types'
import type { MediaType } from '../../../core/media/media-config'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { ElceCardBdcSceneBuilder } from '../../../resources/bdcs/card/reading/card-bdc-scene-builder'
import { CARD_PLAYER_STYLE_RULES } from '../../../resources/bdcs/card/reading/card-player-style'
import { CARD_PRESETS } from '../../../resources/bdcs/card/card-presets'
import { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { createQuizHuntInlineTextSceneFeature } from './quiz-hunt-inline-text-scene'

type ResultScenePerso = SceneDoc<string>['stories'][string]['persos'][number]
type ResultOutcome = 'success' | 'failure'
type ResultScene = Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }>

export const QUIZ_HUNT_RESULT_EVENT = {
  ELAPSED_TIME: 'quiz-hunt:result:elapsed-time',
  QUESTION_STATS: 'quiz-hunt:result:question-stats',
} as const

const RESULT_PRESENTATION_STYLES = `
.quiz-hunt-result-page {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  text-align: center;
  gap: 1rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: clamp(1rem, 3vw, 2rem);
  overflow-y: auto;
}

.quiz-hunt-result-title { margin: 0; }

.quiz-hunt-result-content { min-width: 0; }

.quiz-hunt-result-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  margin-top: 1rem;
  font-weight: 700;
}

.quiz-hunt-result-metrics p { margin: 0; }

.quiz-hunt-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75em;
  margin-top: auto;
  padding-top: 0.5em;
}

.quiz-hunt-result-return,
.quiz-hunt-result-restart {
  min-height: 2.75em;
  padding: 0.5em 0.85em;
  border: 1px solid #cbd5e1;
  border-radius: 0.5em;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.quiz-hunt-result-return:focus-visible,
.quiz-hunt-result-restart:focus-visible {
  outline: 3px solid #2563eb;
  outline-offset: 2px;
}
`

/** Builds the editable success and failure Cards as normal game-content views. */
export function buildQuizHuntResultScenes(
  document: QuizHuntDocument,
  mediaSources: Readonly<Record<string, string>> = {},
): Readonly<{ success: ResultScene; failure: ResultScene }> {
  const successBdc = document.bdcs.find((bdc) => bdc.id === document.settings.successCardBdcId)
  const failureBdc = document.bdcs.find((bdc) => bdc.id === document.settings.failureCardBdcId)
  if (successBdc?.card == null || failureBdc?.card == null) throw new Error('Les deux Cartes de résultat Quiz Hunt sont requises.')

  const presetBuilder = new ElceCardPresetBuilder(CARD_PRESETS)
  const cardBuilder = new ElceCardBdcSceneBuilder(presetBuilder, createQuizHuntInlineTextSceneFeature())
  const mediaTypes: Readonly<Record<string, MediaType>> = Object.fromEntries(document.medias.flatMap((media) => {
    const type = mediaTypeFromMimeType(media.mimeType)
    return type === null ? [] : [[media.id, type]]
  }))
  /** Builds one outcome view from its configured result Card. */
  const buildOutcome = (outcome: ResultOutcome, bdcId: string): ResultScene => {
    const bdc = document.bdcs.find((candidate) => candidate.id === bdcId)
    if (bdc?.card == null) throw new Error(`La Carte Quiz Hunt de résultat ${outcome} est absente.`)
    const pageId = `quiz-hunt-result-${outcome}`
    const card = cardBuilder.build({ pageId, containerBdcId: bdc.id, bdc, mediaSources, mediaTypes })
    return {
      sceneDoc: {
        id: `${pageId}-scene`,
        stories: {
          main: {
            id: 'main',
            initial: { move: '@root' },
            persos: [
              createResultPage(outcome, card.markup),
              createResultElapsedTime(outcome),
              ...(outcome === 'failure' ? [createResultQuestionStats(outcome)] : []),
              createResultReturnButton(outcome),
              createResultRestartButton(outcome),
              ...card.contentPersos,
              ...card.mediaPersos,
            ],
          },
        },
      },
      styleSheet: `${CARD_PLAYER_STYLE_RULES.map(([, cssText]) => cssText).join('\n')}\n${card.styleSheet}\n${RESULT_PRESENTATION_STYLES}`,
    }
  }

  return {
    success: buildOutcome('success', successBdc.id),
    failure: buildOutcome('failure', failureBdc.id),
  }
}

/** Creates one terminal content page around its existing authored Card. */
function createResultPage(outcome: ResultOutcome, cardMarkup: string): ResultScenePerso {
  const pageId = `quiz-hunt-result-${outcome}`
  const title = outcome === 'success' ? 'Partie réussie !' : 'Partie échouée'
  return {
    id: `${pageId}-page`,
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-result-page',
      markup: `<section id="${pageId}-root" class="quiz-hunt-result-page">
        <h1 id="${pageId}-title" class="quiz-hunt-result-title">${title}</h1>
        <div id="${pageId}-content" class="quiz-hunt-result-content">
          ${cardMarkup}
          <div id="${pageId}-metrics" class="quiz-hunt-result-metrics">
            <div id="${pageId}-elapsed-time-host" data-part="quiz-hunt:result:${outcome}:elapsed-time"></div>
            ${outcome === 'failure' ? `<div id="${pageId}-question-stats-host" data-part="quiz-hunt:result:${outcome}:question-stats"></div>` : ''}
          </div>
        </div>
        <nav id="${pageId}-actions" class="quiz-hunt-result-actions" aria-label="Actions de fin de partie">
          <div id="${pageId}-return-host" data-part="quiz-hunt:result:${outcome}:return"></div>
          <div id="${pageId}-restart-host" data-part="quiz-hunt:result:${outcome}:restart"></div>
        </nav>
      </section>`,
    },
    actions: {},
  }
}

/** Receives the elapsed game time for the terminal result page. */
function createResultElapsedTime(outcome: ResultOutcome): ResultScenePerso {
  const pageId = `quiz-hunt-result-${outcome}`
  return {
    id: `${pageId}-elapsed-time`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: '',
      className: 'quiz-hunt-result-elapsed-time',
      move: { target: `quiz-hunt:result:${outcome}:elapsed-time` },
    },
    actions: { [QUIZ_HUNT_RESULT_EVENT.ELAPSED_TIME]: null },
  }
}

/** Receives the answered and correct question counts on the failure page. */
function createResultQuestionStats(outcome: ResultOutcome): ResultScenePerso {
  const pageId = `quiz-hunt-result-${outcome}`
  return {
    id: `${pageId}-question-stats`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: '',
      className: 'quiz-hunt-result-question-stats',
      move: { target: `quiz-hunt:result:${outcome}:question-stats` },
    },
    actions: { [QUIZ_HUNT_RESULT_EVENT.QUESTION_STATS]: null },
  }
}

/** Creates the action that leaves a terminal page for the Sommaire. */
function createResultReturnButton(outcome: ResultOutcome): ResultScenePerso {
  return {
    id: `quiz-hunt-result-${outcome}-return`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Retour au sommaire',
      attr: { type: 'button' },
      className: 'quiz-hunt-result-return',
      move: { target: `quiz-hunt:result:${outcome}:return` },
    },
    emit: { click: { event: { name: 'quiz-hunt:result:return', visibility: 'public' } } },
    actions: {},
  }
}

/** Creates the action that starts a new game from a terminal page. */
function createResultRestartButton(outcome: ResultOutcome): ResultScenePerso {
  return {
    id: `quiz-hunt-result-${outcome}-restart`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Recommencer',
      attr: { type: 'button' },
      className: 'quiz-hunt-result-restart',
      move: { target: `quiz-hunt:result:${outcome}:restart` },
    },
    emit: { click: { event: { name: 'quiz-hunt:game:restart', visibility: 'public' } } },
    actions: {},
  }
}

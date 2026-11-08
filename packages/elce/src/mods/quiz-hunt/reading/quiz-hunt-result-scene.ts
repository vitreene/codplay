import type { SceneDoc } from 'codplay/scene/types'
import type { CompiledRecord } from 'codplay'
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

const RESULT_PRESENTATION_STYLES = `
.quiz-hunt-result-card .elce-card {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.quiz-hunt-result-content { min-width: 0; }

.quiz-hunt-result-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75em;
  margin-top: 0.75em;
}

.quiz-hunt-result-return,
.quiz-hunt-result-restart {
  padding: 0.5em 0.75em;
  border: 1px solid #cbd5e1;
  border-radius: 0.5em;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 40em) {
  .quiz-hunt-result-card { padding: 1.25em; }
}
`

/** Builds the original verdict overlay around the author's outcome Card BDC. */
export function buildQuizHuntResultScene(
  document: QuizHuntDocument,
  mediaSources: Readonly<Record<string, string>> = {},
): Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }> {
  const successBdc = document.bdcs.find((bdc) => bdc.id === document.settings.successCardBdcId)
  const failureBdc = document.bdcs.find((bdc) => bdc.id === document.settings.failureCardBdcId)
  if (successBdc?.card == null || failureBdc?.card == null) throw new Error('Les deux Cartes de résultat Quiz Hunt sont requises.')

  const presetBuilder = new ElceCardPresetBuilder(CARD_PRESETS)
  const cardBuilder = new ElceCardBdcSceneBuilder(presetBuilder, createQuizHuntInlineTextSceneFeature())
  const mediaTypes: Readonly<Record<string, MediaType>> = Object.fromEntries(document.medias.flatMap((media) => {
    const type = mediaTypeFromMimeType(media.mimeType)
    return type === null ? [] : [[media.id, type]]
  }))
  const success = cardBuilder.build({ pageId: 'quiz-hunt-result', containerBdcId: successBdc.id, bdc: successBdc, mediaSources, mediaTypes })
  const failure = cardBuilder.build({ pageId: 'quiz-hunt-result', containerBdcId: failureBdc.id, bdc: failureBdc, mediaSources, mediaTypes })
  const outcomes = [
    { outcome: 'success' as const, markup: success.markup, contentPersos: success.contentPersos, mediaPersos: success.mediaPersos },
    { outcome: 'failure' as const, markup: failure.markup, contentPersos: failure.contentPersos, mediaPersos: failure.mediaPersos },
  ]

  return {
    sceneDoc: {
      id: 'quiz-hunt-result-scene',
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          listen: [
            { on: 'quiz-hunt:result:project', straps: ['quiz-hunt-result-project'] },
            { on: 'quiz-hunt:result:return', straps: ['quiz-hunt-result-hide'] },
          ],
          straps: {
            'quiz-hunt-result-project': ({ event }) => projectResult(event.data),
            'quiz-hunt-result-hide': () => ({ events: [
              { name: 'quiz-hunt:result:hide-success' },
              { name: 'quiz-hunt:result:hide-failure' },
            ] }),
          },
          persos: outcomes.flatMap(({ outcome, markup, contentPersos, mediaPersos }) => [
            createResultOverlay(outcome, markup),
            createResultSummary(outcome),
            createResultTime(outcome),
            createResultReturnButton(outcome),
            createResultRestartButton(outcome),
            ...contentPersos,
            ...mediaPersos,
          ]),
        },
      },
    },
    styleSheet: `${CARD_PLAYER_STYLE_RULES.map(([, cssText]) => cssText).join('\n')}\n${success.styleSheet}\n${failure.styleSheet}\n${RESULT_PRESENTATION_STYLES}`,
  }
}

/** Creates one result overlay with the original verdict, summary, and time slots. */
function createResultOverlay(outcome: ResultOutcome, cardMarkup: string): ResultScenePerso {
  const overlayId = `quiz-hunt-result-${outcome}-overlay`
  const showEvent = `quiz-hunt:result:show-${outcome}`
  const hideEvent = `quiz-hunt:result:hide-${outcome}`
  const verdict = outcome === 'success' ? 'Partie réussie !' : 'Partie échouée'
  const verdictClass = outcome === 'success' ? 'is-passed' : 'is-failed'
  return {
    id: overlayId,
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-result-overlay is-hidden',
      markup: `<div id="${overlayId}-root" class="quiz-hunt-result-overlay is-hidden">
        <div id="${overlayId}-card" class="quiz-hunt-result-card">
          <p id="${overlayId}-verdict" class="quiz-hunt-result-verdict ${verdictClass}">${verdict}</p>
          <p id="${overlayId}-summary" class="quiz-hunt-result-summary-slot" data-part="quiz-hunt:result:${outcome}:summary"></p>
          <p id="${overlayId}-time" class="quiz-hunt-result-time-slot" data-part="quiz-hunt:result:${outcome}:time"></p>
          <div id="${overlayId}-content" class="quiz-hunt-result-content">${cardMarkup}</div>
          <div id="${overlayId}-actions" class="quiz-hunt-result-actions">
            <div id="${overlayId}-restart-host" data-part="quiz-hunt:result:${outcome}:restart"></div>
            <div id="${overlayId}-return-host" data-part="quiz-hunt:result:${outcome}:return"></div>
          </div>
        </div>
      </div>`,
    },
    actions: {
      [showEvent]: {
        className: { add: 'is-visible', remove: 'is-hidden' },
        style: { opacity: { from: 0, to: 1, duration: 300 } },
      },
      [hideEvent]: {
        className: { add: 'is-hidden', remove: 'is-visible' },
        style: { opacity: 0 },
      },
    },
  }
}

/** Creates the result summary value inside the original card. */
function createResultSummary(outcome: ResultOutcome): ResultScenePerso {
  return {
    id: `quiz-hunt-result-${outcome}-summary-value`,
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      move: { target: `quiz-hunt:result:${outcome}:summary` },
    },
    actions: { [`quiz-hunt:result:${outcome}:summary`]: null },
  }
}

/** Creates the elapsed-time value inside the original card. */
function createResultTime(outcome: ResultOutcome): ResultScenePerso {
  return {
    id: `quiz-hunt-result-${outcome}-time-value`,
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      move: { target: `quiz-hunt:result:${outcome}:time` },
    },
    actions: { [`quiz-hunt:result:${outcome}:time`]: null },
  }
}

/** Creates the return control that restores the saved verdict on the Sommaire. */
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

/** Creates the existing restart action alongside the original result card. */
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

/** Projects the verdict and original count/time values to the matching overlay. */
function projectResult(data: Readonly<Record<string, unknown>> | undefined): Readonly<{
  events: readonly Readonly<{ name: string; data?: CompiledRecord }>[]
}> | undefined {
  const outcome = data?.outcome
  if (outcome !== 'success' && outcome !== 'failure') return undefined
  const summary = typeof data?.summary === 'string' ? data.summary : ''
  const time = typeof data?.time === 'string' ? data.time : ''
  return {
    events: [
      { name: `quiz-hunt:result:${outcome}:summary`, data: { content: summary } },
      { name: `quiz-hunt:result:${outcome}:time`, data: { content: time } },
      { name: `quiz-hunt:result:hide-${outcome === 'success' ? 'failure' : 'success'}` },
      { name: `quiz-hunt:result:show-${outcome}` },
    ],
  }
}

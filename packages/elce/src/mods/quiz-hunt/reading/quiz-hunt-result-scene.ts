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

const RESULT_PRESENTATION_STYLES = `
.quiz-hunt-result-root {
  position: relative;
  width: 100%;
  height: 100%;
}

.quiz-hunt-result-overlay[hidden] {
  display: none;
}

.quiz-hunt-result-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 5vw, 3rem);
  background: rgb(15 23 42 / 74%);
  animation: quiz-hunt-result-backdrop-in 260ms ease-out both;
}

.quiz-hunt-result-card {
  width: min(100%, 46rem);
  animation: quiz-hunt-result-card-in 420ms cubic-bezier(.16, 1, .3, 1) both;
}

.quiz-hunt-result-success .quiz-hunt-result-card {
  filter: drop-shadow(0 1.2rem 2.2rem rgb(45 180 126 / 32%));
}

.quiz-hunt-result-failure .quiz-hunt-result-card {
  filter: drop-shadow(0 1.2rem 2.2rem rgb(213 74 78 / 32%));
}

.quiz-hunt-result-card .elce-card {
  width: 100%;
}

.quiz-hunt-result-return {
  display: block;
  min-height: 2.75rem;
  margin: 0;
  padding: 0.65rem 1.25rem;
  border: 0;
  border-radius: 0.4rem;
  background: #fffdf8;
  color: #263b3a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.quiz-hunt-result-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.quiz-hunt-result-restart {
  min-height: 2.75rem;
  padding: 0.65rem 1.25rem;
  border: 1px solid #fffdf8;
  border-radius: 0.4rem;
  background: transparent;
  color: #fffdf8;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@keyframes quiz-hunt-result-backdrop-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes quiz-hunt-result-card-in {
  from { opacity: 0; transform: translateY(1.5rem) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`

/** Builds the two fixed result presentations from the author's shared Card BDCs. */
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
  const success = cardBuilder.build({
    pageId: 'quiz-hunt-result',
    containerBdcId: successBdc.id,
    bdc: successBdc,
    mediaSources,
    mediaTypes,
  })
  const failure = cardBuilder.build({
    pageId: 'quiz-hunt-result',
    containerBdcId: failureBdc.id,
    bdc: failureBdc,
    mediaSources,
    mediaTypes,
  })
  const successOverlay = createResultOverlay('success', success.markup)
  const failureOverlay = createResultOverlay('failure', failure.markup)

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
            'quiz-hunt-result-project': ({ event }) => {
              const outcome = event.data?.outcome
              if (outcome !== 'success' && outcome !== 'failure') return undefined
              return { events: [{ name: `quiz-hunt:result:show-${outcome}` }] }
            },
            'quiz-hunt-result-hide': () => ({ events: [{ name: 'quiz-hunt:result:hide' }] }),
          },
          persos: [
            {
              id: 'quiz-hunt-result-layout',
              type: 'layout',
              initial: {
                move: '@root',
                markup: `<div id="quiz-hunt-result-root" class="quiz-hunt-result-root">
                  <div id="quiz-hunt-result-success-host" data-part="quiz-hunt:result:success-host"></div>
                  <div id="quiz-hunt-result-failure-host" data-part="quiz-hunt:result:failure-host"></div>
                </div>`,
              },
              actions: {},
            },
            successOverlay.perso,
            failureOverlay.perso,
            ...success.contentPersos,
            ...success.mediaPersos,
            ...failure.contentPersos,
            ...failure.mediaPersos,
            createResultReturnButton('success'),
            createResultReturnButton('failure'),
            createResultRestartButton('success'),
            createResultRestartButton('failure'),
          ],
        },
      },
    },
    styleSheet: `${CARD_PLAYER_STYLE_RULES.map(([, cssText]) => cssText).join('\n')}\n${success.styleSheet}\n${failure.styleSheet}\n${RESULT_PRESENTATION_STYLES}`,
  }
}

/** Creates one overlay scene and binds its fixed reveal animation to a result. */
function createResultOverlay(outcome: 'success' | 'failure', cardMarkup: string): Readonly<{ perso: ResultScenePerso }> {
  const hostPart = `quiz-hunt:result:${outcome}-host`
  const returnPart = `quiz-hunt:result:${outcome}:return`
  const restartPart = `quiz-hunt:result:${outcome}:restart`
  const overlayId = `quiz-hunt-result-${outcome}-overlay`
  const showEvent = `quiz-hunt:result:show-${outcome}`
  return {
    perso: {
      id: overlayId,
      type: 'layout',
      initial: {
        move: { target: hostPart },
        className: `quiz-hunt-result-overlay quiz-hunt-result-${outcome}`,
        attr: { hidden: true },
        markup: `<section id="${overlayId}-root" class="quiz-hunt-result-overlay quiz-hunt-result-${outcome}" hidden>
          <div id="${overlayId}-card" class="quiz-hunt-result-card">${cardMarkup}</div>
          <div id="${overlayId}-actions" class="quiz-hunt-result-actions">
            <div id="${overlayId}-restart-host" data-part="${restartPart}"></div>
            <div id="${overlayId}-return-host" data-part="${returnPart}"></div>
          </div>
        </section>`,
      },
      actions: {
        [showEvent]: { attr: { hidden: false } },
        'quiz-hunt:result:hide': { attr: { hidden: true } },
      },
    },
  }
}

/** Creates the single return control hosted by one result overlay. */
function createResultReturnButton(outcome: 'success' | 'failure'): ResultScenePerso {
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

/** Adds a result action that starts a new mod-owned game run. */
function createResultRestartButton(outcome: 'success' | 'failure'): ResultScenePerso {
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

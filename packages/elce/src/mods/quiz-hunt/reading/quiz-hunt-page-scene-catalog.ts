import type { SightySceneSourceValue } from '@codplay/sighty'
import type { MediaInitial } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { CARD_PLAYER_STYLE_RULES } from '../../../resources/bdcs/card/reading/card-player-style'
import { CARD_PRESETS } from '../../../resources/bdcs/card/card-presets'
import { CAROUSEL_PLAYER_STYLE_RULES } from '../../../resources/bdcs/carousel/reading/carousel-player-style'
import { CAROUSEL_PRESETS } from '../../../resources/bdcs/carousel/carousel-presets'
import { ElceCardBdcSceneBuilder } from '../../../resources/bdcs/card/reading/card-bdc-scene-builder'
import { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import { ElceEditorSettingsResolver } from '../../../domain/editor-settings/editor-settings-resolver'
import { FLUX_PLAYER_STYLE_RULES } from '../../../resources/pages/flux/reading/flux-player-style'
import { buildFluxScene } from '../../../resources/pages/flux/flux-scene-builder'
import { DIAPO_PLAYER_STYLE_RULES } from '../../../resources/pages/diapo/reading/diapo-player-style'
import { buildDiapoScene } from '../../../resources/pages/diapo/diapo-scene-builder'
import { ElceCarouselSceneBuilder } from '../../../resources/bdcs/carousel/reading/carousel-scene-builder'
import { QUESTION_PLAYER_STYLE_RULES } from '../../../resources/bdcs/question/reading/question-player-style'
import { QUESTION_PRESETS } from '../../../resources/bdcs/question/question-presets'
import { SECTION_PRESETS } from '../../../resources/bdcs/section/section-presets'
import { DOT_LEADER_STYLE_SHEET } from '../../../resources/bdcs/section/dot-leader/dot-leader-style'
import { STATISTICAL_GRAPH_PLAYER_STYLE_RULES } from '../../../resources/bdcs/statistical-graph/reading/statistical-graph-player-style'
import { ELCE_EDITOR_SETTINGS } from '../../../config/editor-settings'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { QuizHuntDocument, QuizHuntPage } from '../document/quiz-hunt-document-types'
import type { QuizHuntGameCatalog } from './quiz-hunt-game-catalog'
import { resolveQuizHuntColorStyle } from './quiz-hunt-color-style.ts'
import { createQuizHuntInlineTextSceneFeature } from './quiz-hunt-inline-text-scene'

export const QUIZ_HUNT_VIDEO_EVENT = {
  PLAY: 'quiz-hunt:video:play',
  PAUSE: 'quiz-hunt:video:pause',
  ENDED: 'quiz-hunt:video:ended',
  STOP: 'quiz-hunt:video:stop',
} as const

/** Names the page-local event that starts its Question video through the media component. */
export function quizHuntVideoStartEvent(pageId: string): string {
  return `quiz-hunt:video:start:${pageId}`
}

/** Finds the first video-backed Question BDC on a non-summary Quiz Hunt page. */
export function findQuizHuntClueVideoBdc(page: QuizHuntPage, document: QuizHuntDocument) {
  if (page.type === 'summary') return undefined
  const pageBdcs = page.bdcIds.flatMap((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId) ?? [])
  return pageBdcs.find((bdc) => {
    const mediaId = bdc.question?.mediaId
    return mediaId != null && document.medias.some((media) => media.id === mediaId && media.mimeType.startsWith('video/'))
  })
}

const editorSettingsResolver = new ElceEditorSettingsResolver()

const QUIZ_HUNT_RESOURCE_PRESETS = {
  ...CARD_PRESETS,
  ...CAROUSEL_PRESETS,
  ...QUESTION_PRESETS,
  ...SECTION_PRESETS,
}

const QUIZ_HUNT_RESOURCE_STYLE_SHEET = [
  ...FLUX_PLAYER_STYLE_RULES,
  ...DIAPO_PLAYER_STYLE_RULES,
  ...CARD_PLAYER_STYLE_RULES,
  ...CAROUSEL_PLAYER_STYLE_RULES,
  ...QUESTION_PLAYER_STYLE_RULES,
  ...STATISTICAL_GRAPH_PLAYER_STYLE_RULES,
].sort(([left], [right]) => left - right).map(([, cssText]) => cssText).join('\n') + DOT_LEADER_STYLE_SHEET

const QUIZ_HUNT_CLUE_STYLE_SHEET = `
.quiz-hunt-question-waiting .elce-card--question {
  display: none;
}
`

const QUIZ_HUNT_GAME_PAGE_STYLE_SHEET = `
.quiz-hunt-main-zone > .quiz-hunt-trial-panel,
.quiz-hunt-main-zone > .quiz-hunt-final-panel {
  display: block;
  overflow-y: auto;
}

.quiz-hunt-game-content-host,
.quiz-hunt-game-content-scrollport {
  min-width: 0;
  min-height: 0;
}

.quiz-hunt-game-content-scrollport {
  width: 100%;
  height: auto;
  overflow: visible;
}

.quiz-hunt-game-content-scrollport > .elce-flux-article {
  display: block;
  width: 100%;
  min-height: 0;
  gap: 0;
}

.quiz-hunt-game-content-scrollport > .elce-diapo-content {
  width: 100%;
  height: auto;
  min-height: 0;
  overflow: visible;
}

.quiz-hunt-game-content-scrollport > .elce-flux-article > section {
  width: 100%;
  margin: 0 0 1em;
}

.quiz-hunt-game-content-scrollport .elce-card--section {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.quiz-hunt-game-content-scrollport .elce-card--question {
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.quiz-hunt-game-content-scrollport .elce-card--question header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.quiz-hunt-game-content-scrollport .elce-card--question form,
.quiz-hunt-game-content-scrollport .elce-card--question fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.quiz-hunt-game-content-scrollport .elce-card--question legend {
  width: 100%;
  margin: 0 0 0.8rem;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.4;
}

.quiz-hunt-game-content-scrollport .elce-question-instructions {
  grid-column: 1 / -1;
  margin: 0 0 0.5rem;
}

.quiz-hunt-game-content-scrollport .elce-question-answers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5em;
}

.quiz-hunt-game-content-scrollport .elce-question-answer-option {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 0.75em;
  border: 1px solid #cbd5e1;
  border-radius: 0.5em;
  background: #fff;
  text-align: left;
}

.quiz-hunt-game-content-scrollport .elce-question-validate {
  margin-top: 0.75em;
  padding: 0.5em 1em;
  border: 0;
  border-radius: 0.5em;
  background: var(--quiz-hunt-accent, #2563eb);
  color: #fff;
  font-weight: 600;
}

.quiz-hunt-game-content-scrollport .elce-question-feedback--correct,
.quiz-hunt-game-content-scrollport .elce-question-answer__correction.is-correct,
.quiz-hunt-game-content-scrollport .elce-question-answer__correction.is-missed-correct {
  color: #16a34a;
}

.quiz-hunt-game-content-scrollport .elce-question-feedback--incorrect,
.quiz-hunt-game-content-scrollport .elce-question-answer__correction.is-incorrect {
  color: #dc2626;
}

.quiz-hunt-game-content-scrollport .elce-flux-video {
  width: 100%;
  aspect-ratio: 16 / 9;
  margin: 0 0 1em;
  border-radius: 0.75em;
  background: #020617;
}

.quiz-hunt-game-content-scrollport .quiz-hunt-trial-clue-video > video {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  object-fit: contain;
}
`

/** Builds every authored content page through the shared page and BDC builders. */
export function buildQuizHuntPageSceneCatalog(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
  mediaSources: Readonly<Record<string, string>> = {},
): Readonly<Record<string, SightySceneSourceValue>> {
  const presetBuilder = new ElceCardPresetBuilder(QUIZ_HUNT_RESOURCE_PRESETS)
  const inlineTextSceneFeature = createQuizHuntInlineTextSceneFeature()
  const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder(presetBuilder, inlineTextSceneFeature)
  const carouselSceneBuilder = new ElceCarouselSceneBuilder(presetBuilder, cardBdcSceneBuilder, inlineTextSceneFeature)
  const mediaTypes = Object.fromEntries(document.medias.flatMap((media) => {
    const type = mediaTypeFromMimeType(media.mimeType)
    return type === null ? [] : [[media.id, type]]
  }))

  return Object.fromEntries(document.pages.flatMap((page) => {
    if (page.type === 'summary') return []
    const editorSettings = editorSettingsResolver.resolvePage(
      page,
      document.bdcs,
      ELCE_EDITOR_SETTINGS.revelation.projectDefaults,
    )
    const options = {
      mediaSources,
      mediaTypes,
      editorSettings,
      presetBuilder,
      cardBdcSceneBuilder,
      carouselSceneBuilder,
      inlineTextSceneFeature,
    }
    const pageScene = page.type === 'diapo'
      ? buildDiapoSceneForQuizHunt(page, document, options)
      : buildFluxScene(page, document.bdcs, options)
    const sceneDoc = page.chapterId === null
      ? pageScene.sceneDoc
      : buildQuizHuntGamePageScene(pageScene.sceneDoc, page, document, game)
    const styleSheet = [
      QUIZ_HUNT_RESOURCE_STYLE_SHEET,
      QUIZ_HUNT_CLUE_STYLE_SHEET,
      ...pageScene.styleSheets,
      ...(page.chapterId === null ? [] : [QUIZ_HUNT_GAME_PAGE_STYLE_SHEET]),
    ].filter((css) => css.length > 0).join('\n')
    const source: SightySceneSourceValue = styleSheet.length === 0
      ? sceneDoc
      : { sceneDoc, styleSheet }
    return [[`scene-page-${page.id}`, source]]
  }))
}

/** Frames a bank page in the original clue panel and reveals its common Question on schedule. */
function buildQuizHuntGamePageScene(
  sceneDoc: SceneDoc<string>,
  page: QuizHuntPage,
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): SceneDoc<string> {
  if (page.type === 'summary') throw new Error('Le Sommaire ne peut pas être composé comme une épreuve Quiz Hunt.')
  const pageId = page.id
  const pageType = page.type
  const story = sceneDoc.stories[quizHuntPageSceneStoryId(pageId, pageType)]
  if (story === undefined) throw new Error(`La scène de la page Quiz Hunt ${pageId} ne contient pas son histoire Flux.`)
  const scrollportId = pageType === 'diapo' ? `${pageId}-diapo-scrollport` : `${pageId}-scrollport`
  const contentRootId = pageType === 'diapo' ? `${pageId}-diapo-content` : `${pageId}-article`
  const revealEvent = quizHuntQuestionRevealEvent(pageId)
  const contentPart = `quiz-hunt:page:${pageId}:content`
  const badgePart = `quiz-hunt:page:${pageId}:badge`
  const colorGroup = document.settings.groups.find((group) => group.id === page.colorId)
  const colorName = colorGroup?.name ?? 'bleu'
  const color = colorGroup?.color ?? '#64748b'
  const isFinal = game.finalPageId === pageId
  const pageBdcs = page.bdcIds.flatMap((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId) ?? [])
  const clueSectionBdc = isFinal ? undefined : pageBdcs.find((bdc) => bdc.section != null)
  const clueTitle = clueSectionBdc?.section?.title
  const clueVideoBdc = isFinal ? undefined : findQuizHuntClueVideoBdc(page, document)
  const clueVideoMediaId = clueVideoBdc?.question?.mediaId
  const clueVideoPersoId = clueVideoBdc === undefined || clueVideoMediaId == null
    ? undefined
    : pageType === 'diapo'
      ? `${clueVideoBdc.id}-diapo-illustration-${clueVideoMediaId}`
      : `${pageId}-${clueVideoBdc.id}-video`
  const trialIndex = game.trialGridOrder.indexOf(pageId)
  const tileNumber = trialIndex < 0 ? 1 : trialIndex + 1
  const panelClass = isFinal ? 'quiz-hunt-final-panel' : 'quiz-hunt-trial-panel'
  const eyebrow = isFinal
    ? 'Épreuve finale'
    : typeof clueTitle === 'string' && clueTitle.trim().length > 0 ? clueTitle : page.name
  const gamePanelId = `quiz-hunt-page-${pageId}-game-panel`
  const clueMediaPartId = `quiz-hunt:page:${pageId}:clue-media`
  const clueMediaMarkup = clueVideoBdc === undefined ? '' : `<div id="quiz-hunt-page-${pageId}-clue-media" class="quiz-hunt-trial-clue-media" data-part="${clueMediaPartId}"></div>`
  let foundScrollport = false
  let foundContentRoot = false
  let foundClueMediaHost = clueVideoBdc === undefined
  const persos = story.persos.map((perso) => {
    if (clueVideoPersoId !== undefined && perso.id === clueVideoPersoId
      && perso.type === 'media' && perso.initial !== undefined) {
      const mediaInitial = perso.initial as MediaInitial
      const currentClass = typeof perso.initial.className === 'string' ? perso.initial.className : ''
      return {
        ...perso,
        initial: {
          ...mediaInitial,
          className: `${currentClass} quiz-hunt-trial-clue-video`.trim(),
          attr: { ...mediaInitial.attr, 'data-quiz-hunt-video-page-id': pageId },
          video: {
            ...mediaInitial.video,
            attr: { ...mediaInitial.video?.attr, muted: true, playsinline: true },
          },
          move: { target: clueMediaPartId },
        },
        actions: {
          ...perso.actions,
          [quizHuntVideoStartEvent(pageId)]: { broadcast: { type: 'START' } },
          [QUIZ_HUNT_VIDEO_EVENT.STOP]: { broadcast: { type: 'STOP' } },
        },
        ...(perso.emit?.observe === undefined ? {} : {
          emit: { ...perso.emit, observe: { ...perso.emit.observe, root: scrollportId } },
        }),
      }
    }
    if (perso.id === scrollportId && perso.initial !== undefined) {
      foundScrollport = true
      const currentClass = typeof perso.initial.className === 'string' ? perso.initial.className : ''
      return {
        ...perso,
        initial: {
          ...perso.initial,
          className: `${currentClass} quiz-hunt-game-content-scrollport`.trim(),
          move: { target: contentPart },
        },
      }
    }
    if (perso.id !== contentRootId || perso.type !== 'layout' || perso.initial === undefined) return perso
    foundContentRoot = true
    const currentClass = typeof perso.initial.className === 'string' ? perso.initial.className : ''
    const currentMarkup = typeof perso.initial.markup === 'string' ? perso.initial.markup : ''
    foundClueMediaHost = clueMediaMarkup === '' || currentMarkup !== ''
    return {
      ...perso,
      initial: {
        ...perso.initial,
        className: `${currentClass} quiz-hunt-question-waiting`.trim(),
        markup: `${clueMediaMarkup}${currentMarkup}`,
      },
      actions: {
        ...perso.actions,
        [revealEvent]: { className: { remove: 'quiz-hunt-question-waiting' } },
      },
    }
  }).filter((perso) => clueSectionBdc === undefined || perso.id !== `${pageId}-${clueSectionBdc.id}-title`)
  if (!foundScrollport || !foundContentRoot || !foundClueMediaHost) {
    throw new Error(`La scène de la page Quiz Hunt ${pageId} ne fournit pas son hôte de contenu.`)
  }
  const gamePanel: SceneDoc<string>['stories'][string]['persos'][number] = {
    id: gamePanelId,
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-main-zone',
      style: { width: '100%', height: '100%', minWidth: 0, minHeight: 0, '--quiz-hunt-accent': color },
      markup: `<div id="quiz-hunt-page-${pageId}-game-root" class="quiz-hunt-main-zone">
        <section id="quiz-hunt-page-${pageId}-trial-panel" class="${panelClass}">
          <header id="quiz-hunt-page-${pageId}-game-header" class="quiz-hunt-trial-header">
            <p id="quiz-hunt-page-${pageId}-game-eyebrow" class="quiz-hunt-trial-eyebrow">${escapeHtml(eyebrow)}</p>
            <div id="quiz-hunt-page-${pageId}-game-badge-slot" class="quiz-hunt-question-badge-slot" data-part="${badgePart}"></div>
          </header>
          <div id="quiz-hunt-page-${pageId}-game-content-host" class="quiz-hunt-game-content-host" data-part="${contentPart}"></div>
        </section>
      </div>`,
    },
    actions: {},
  }
  return {
    ...sceneDoc,
    stories: {
      ...sceneDoc.stories,
      [story.id]: { ...story, persos: [gamePanel, createQuestionBadge(pageId, badgePart, colorName, color, tileNumber, isFinal), ...persos] },
    },
  }
}

/** Creates the original color polygon and grid number or final trophy. */
function createQuestionBadge(
  pageId: string,
  target: string,
  colorName: string,
  color: string,
  tileNumber: number,
  isFinal: boolean,
): SceneDoc<string>['stories'][string]['persos'][number] {
  const polygonByColor: Record<string, { sides: number; inner?: number; outer: number; rotationDeg?: number }> = {
    rouge: { sides: 5, inner: 18, outer: 42, rotationDeg: -18 },
    bleu: { sides: 12, inner: 34, outer: 42, rotationDeg: -15 },
    vert: { sides: 5, outer: 42, rotationDeg: -18 },
    jaune: { sides: 8, outer: 42, rotationDeg: 22.5 },
  }
  const colorStyle = resolveQuizHuntColorStyle(colorName, color)
  return {
    id: `quiz-hunt-page-${pageId}-badge`,
    type: 'polygon',
    initial: {
      move: { target },
      content: isFinal ? '🏆' : String(tileNumber),
      ...(polygonByColor[colorName.trim().toLocaleLowerCase('fr')] ?? { sides: 6, outer: 40 }),
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

/** Escapes author text before writing the original clue label into markup. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Names the page-local event that reveals its common Question BDC. */
export function quizHuntQuestionRevealEvent(pageId: string): string {
  return `quiz-hunt:question:reveal:${pageId}`
}

/** Resolves the story that owns one built Flux or Diapo page. */
export function quizHuntPageSceneStoryId(pageId: string, pageType: 'flux' | 'diapo'): string {
  return pageType === 'diapo' ? `${pageId}-diapo-page` : `${pageId}-page`
}

/** Dispatches imported Diapo pages through their existing common resource builder. */
function buildDiapoSceneForQuizHunt(
  page: QuizHuntDocument['pages'][number],
  document: QuizHuntDocument,
  options: Parameters<typeof buildDiapoScene>[2],
) {
  return buildDiapoScene(page, document.bdcs, options)
}

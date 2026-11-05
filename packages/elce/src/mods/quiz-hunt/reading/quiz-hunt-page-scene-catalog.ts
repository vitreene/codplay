import type { SightySceneSourceValue } from '@codplay/sighty'
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
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { createQuizHuntInlineTextSceneFeature } from './quiz-hunt-inline-text-scene'

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

/** Builds every authored content page through the shared page and BDC builders. */
export function buildQuizHuntPageSceneCatalog(
  document: QuizHuntDocument,
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
      : hideQuestionUntilClue(pageScene.sceneDoc, page.id, page.type)
    const styleSheet = [QUIZ_HUNT_RESOURCE_STYLE_SHEET, QUIZ_HUNT_CLUE_STYLE_SHEET, ...pageScene.styleSheets].filter((css) => css.length > 0).join('\n')
    const source: SightySceneSourceValue = styleSheet.length === 0
      ? sceneDoc
      : { sceneDoc, styleSheet }
    return [[`scene-page-${page.id}`, source]]
  }))
}

/** Hides bank questions until their owning scenario reveals the clue. */
function hideQuestionUntilClue(sceneDoc: SceneDoc<string>, pageId: string, pageType: 'flux' | 'diapo'): SceneDoc<string> {
  const story = sceneDoc.stories[quizHuntPageSceneStoryId(pageId, pageType)]
  if (story === undefined) throw new Error(`La scène de la page Quiz Hunt ${pageId} ne contient pas son histoire Flux.`)
  const articleId = pageType === 'diapo' ? `${pageId}-diapo-content` : `${pageId}-article`
  const revealEvent = quizHuntQuestionRevealEvent(pageId)
  const persos = story.persos.map((perso) => {
    if (perso.id !== articleId || perso.type !== 'layout' || perso.initial === undefined) return perso
    const currentClass = typeof perso.initial.className === 'string' ? perso.initial.className : ''
    return {
      ...perso,
      initial: { ...perso.initial, className: `${currentClass} quiz-hunt-question-waiting`.trim() },
      actions: {
        ...perso.actions,
        [revealEvent]: { className: { remove: 'quiz-hunt-question-waiting' } },
      },
    }
  })
  return { ...sceneDoc, stories: { ...sceneDoc.stories, [story.id]: { ...story, persos } } }
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

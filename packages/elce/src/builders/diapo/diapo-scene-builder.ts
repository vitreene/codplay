import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { BDC_TYPE, CHAPTER_TYPE, ELCE_EVENTS, MEDIA_TYPE, PAGE_TYPE } from '../../config/document-config'
import type { Bdc, Page } from '../../domain/document/document-types'
import { ElceCardBdcSceneBuilder } from '../card/card-bdc-scene-builder'
import { ElceCarouselSceneBuilder } from '../carousel/carousel-scene-builder'
import { createPageBottomMarkerPerso } from '../flux/page-bottom-marker'
import { ElceStatisticalGraphSceneBuilder } from '../statistical-graph/statistical-graph-scene-builder'
import { buildQuestionBdcStory, buildQuestionCardPreset } from '../question/question-bdc-scene-builder'
import { buildEvaluationResultBdcScene } from '../evaluation/evaluation-result-bdc-scene-builder'
import type { DiapoSceneBuild, DiapoSceneBuildOptions } from './diapo-scene-builder-types'
import { addViewportExpansionToScene } from '../viewport-expansion/viewport-expansion-builder.ts'
import { appearanceClassNameForBdc, appearanceClassNameForPage } from '../scene-style/appearance-class-names.ts'

const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder()
const carouselSceneBuilder = new ElceCarouselSceneBuilder()
const statisticalGraphSceneBuilder = new ElceStatisticalGraphSceneBuilder()

/** Builds a no-scroll Diapo scene with one direct BDC and its existing builder. */
export function buildDiapoScene(
  page: Page,
  bdcs: readonly Bdc[],
  options: DiapoSceneBuildOptions,
): DiapoSceneBuild {
  if (page.type !== PAGE_TYPE.DIAPO) throw new Error(`Le builder Diapo ne traite pas la page ${page.id}.`)
  const pageBdcs = page.bdcIds.map((bdcId) => bdcs.find((bdc) => bdc.id === bdcId))
  if (pageBdcs.some((bdc) => bdc === undefined)) throw new Error(`Un BDC de la Diapo ${page.id} est introuvable.`)
  const contentBdcs = pageBdcs.filter((bdc): bdc is Bdc => bdc !== undefined)
  if (contentBdcs.length > 1) throw new Error(`La Diapo ${page.id} accepte un seul BDC direct.`)
  const bdc = contentBdcs[0]
  const storyId = `${page.id}-diapo-page`

  if (bdc?.type === BDC_TYPE.CAROUSEL) {
    const carouselBuild = buildCarousel(page, bdc, bdcs, options)
    const pageStory = createDiapoCarouselPageStory(page, bdc, { ...carouselBuild.story, id: storyId }, options)
    return {
      sceneDoc: {
        ...addViewportExpansionToScene({
          id: `elce-diapo-${page.id}`,
          stories: { [storyId]: pageStory },
        }, options.editorSettings.player.interactions.viewportExpansion),
      },
      styleSheets: [carouselBuild.styleSheet],
    }
  }

  const scrollPortId = `${page.id}-diapo-scrollport`
  const rootId = `${page.id}-diapo-content`
  const pageAppearanceClass = appearanceClassNameForPage(page.id, options.appearanceClassNamesByTarget)
  let markup = ''
  let bottomPartMarkup = ''
  let pageBottomMarker: PersoDoc<string> | undefined
  let childStories: Readonly<Record<string, StoryDoc<string>>> = {}
  let pagePersos: readonly PersoDoc<string>[] = []
  let styleSheets: readonly string[] = []
  let questionReset: DiapoSceneBuild['questionReset']

  if (bdc !== undefined) {
    switch (bdc.type) {
      case BDC_TYPE.CARD: {
        const cardBuild = cardBdcSceneBuilder.build({
          pageId: page.id,
          containerBdcId: bdc.id,
          bdc,
          mediaSources: options.mediaSources ?? {},
          mediaTypes: options.mediaTypes ?? {},
          appearanceClassNamesByTarget: options.appearanceClassNamesByTarget,
        })
        markup = cardBuild.markup
        bottomPartMarkup = `<!-- data-part="${page.id}:bottom" -->`
        pageBottomMarker = createPageBottomMarkerPerso({
          pageId: page.id,
          markerId: `${page.id}-diapo-bottom-marker`,
          rootId: scrollPortId,
          targetPartId: `${page.id}:bottom`,
          settings: options.editorSettings.player.progression.pageCompletionObservation,
        })
        pagePersos = [...cardBuild.contentPersos, ...cardBuild.mediaPersos]
        break
      }
      case BDC_TYPE.STATISTICAL_GRAPH: {
        const graphBuild = statisticalGraphSceneBuilder.build(
          bdc,
          `${page.id}-${bdc.id}-graph`,
          `${page.id}:${bdc.id}:statistical-graph`,
          appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
        )
        markup = graphBuild.markup
        pagePersos = graphBuild.mediaPersos
        styleSheets = [graphBuild.styleSheet]
        bottomPartMarkup = `<!-- data-part="${page.id}:bottom" -->`
        pageBottomMarker = createPageBottomMarkerPerso({
          pageId: page.id,
          markerId: `${page.id}-diapo-bottom-marker`,
          rootId: scrollPortId,
          targetPartId: `${page.id}:bottom`,
          settings: options.editorSettings.player.progression.pageCompletionObservation,
        })
        break
      }
      case BDC_TYPE.QUESTION: {
        if (bdc.question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
        const questionBuild = buildQuestionCardPreset(
          `${page.id}-${bdc.id}`,
          `${page.id}:${bdc.id}:question`,
          bdc.question,
          appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
        )
        markup = questionBuild.markup
        const questionStory = buildQuestionBdcStory(
          page.id,
          bdc,
          questionBuild.zonePartIds,
          ELCE_EVENTS.PAGE_FINISHED,
          { pageId: page.id },
        )
        childStories = { [questionStory.id]: questionStory }
        const resetEventName = ELCE_EVENTS.QUESTION_RESET
        questionReset = { eventName: resetEventName }
        const mediaPerso = createQuestionMediaPerso(bdc, questionBuild.zonePartIds.illustration ?? '', options)
        childStories = { [questionStory.id]: { ...questionStory, persos: [...(questionStory.persos ?? []), ...mediaPerso] } }
        break
      }
      case BDC_TYPE.EVALUATION_RESULT: {
        switch (options.chapterType) {
          case CHAPTER_TYPE.EVALUATION:
            break
          case CHAPTER_TYPE.STANDARD:
          case undefined:
            throw new Error(`Le BDC Résultat ${bdc.id} ne peut être projeté que dans une Diapo d’Évaluation.`)
        }
        const resultBuild = buildEvaluationResultBdcScene(
          page,
          bdc,
          appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
        )
        markup = resultBuild.mountMarkup
        childStories = Object.fromEntries(resultBuild.stories.map((story) => [story.id, story]))
        bottomPartMarkup = `<!-- data-part="${page.id}:bottom" -->`
        pageBottomMarker = createPageBottomMarkerPerso({
          pageId: page.id,
          markerId: `${page.id}-diapo-bottom-marker`,
          rootId: scrollPortId,
          targetPartId: `${page.id}:bottom`,
          settings: options.editorSettings.player.progression.pageCompletionObservation,
        })
        break
      }
      default:
        throw new Error(`Le BDC ${bdc.id} (${bdc.type}) n’est pas pris en charge dans une Diapo.`)
    }
  }

  if (bdc === undefined) {
    bottomPartMarkup = `<!-- data-part="${page.id}:bottom" -->`
    pageBottomMarker = createPageBottomMarkerPerso({
      pageId: page.id,
      markerId: `${page.id}-diapo-bottom-marker`,
      rootId: scrollPortId,
      targetPartId: `${page.id}:bottom`,
      settings: options.editorSettings.player.progression.pageCompletionObservation,
    })
  }

  const pageStory: StoryDoc<string> = {
    id: storyId,
    persos: [
      {
        id: scrollPortId,
        type: 'scroll-container',
        initial: {
          tag: 'section',
          attr: { id: scrollPortId, 'aria-label': 'Contenu de la Diapo' },
          className: 'elce-diapo-host',
          move: '@root',
        },
      },
      {
        id: rootId,
        type: 'layout',
        initial: {
          move: { target: scrollPortId },
          className: `elce-diapo-content ${pageAppearanceClass}`,
          markup: `<article id="${rootId}" class="elce-diapo-content ${pageAppearanceClass}">${markup}${bottomPartMarkup}</article>`,
        },
      },
      ...(pageBottomMarker === undefined ? [] : [pageBottomMarker]),
      ...pagePersos,
    ],
  }
  const sceneDoc = addViewportExpansionToScene({
    id: `elce-diapo-${page.id}`,
    stories: { [pageStory.id]: pageStory, ...childStories },
  }, options.editorSettings.player.interactions.viewportExpansion)
  return {
    sceneDoc,
    styleSheets,
    ...(questionReset === undefined ? {} : { questionReset }),
  }
}

/** Places the Carousel BDC inside its distinct Diapo page appearance root. */
function createDiapoCarouselPageStory(
  page: Page,
  carousel: Bdc,
  story: StoryDoc<string>,
  options: DiapoSceneBuildOptions,
): StoryDoc<string> {
  const pageRootId = `${page.id}-diapo-content`
  const pagePartId = `${page.id}:diapo:carousel`
  const carouselRootId = `${page.id}-${carousel.id}-diapo-end-scrollport`
  let foundCarouselRoot = false
  const carouselPersos = (story.persos ?? []).map((perso) => {
    if (perso.id !== carouselRootId) return perso
    foundCarouselRoot = true
    return {
      ...perso,
      initial: { ...perso.initial, move: { target: pagePartId } },
    }
  })
  if (!foundCarouselRoot) throw new Error(`La racine de Diapo Carousel ${carousel.id} est absente.`)
  const pageAppearanceClass = appearanceClassNameForPage(page.id, options.appearanceClassNamesByTarget)
  const pageRoot: PersoDoc<string> = {
    id: pageRootId,
    type: 'layout',
    initial: {
      move: '@root',
      className: `elce-diapo-content ${pageAppearanceClass}`,
      markup: `<article id="${pageRootId}" class="elce-diapo-content ${pageAppearanceClass}"><!-- data-part="${pagePartId}" --></article>`,
    },
  }
  return { ...story, persos: [pageRoot, ...carouselPersos] }
}

/** Projects the Diapo's one supported Carousel BDC with its illustration children. */
function buildCarousel(
  page: Page,
  carousel: Bdc,
  bdcs: readonly Bdc[],
  options: DiapoSceneBuildOptions,
) {
  if (carousel.carousel == null) throw new Error(`Le BDC Carousel ${carousel.id} de la Diapo est incomplet.`)
  const revelationSettings = options.editorSettings.revelation.carouselsByBdcId[carousel.id]
  if (revelationSettings === undefined) throw new Error(`Les réglages de révélation du Carousel ${carousel.id} sont absents.`)
  const views = carousel.carousel.cards.map((entry) => {
    const child = bdcs.find((candidate) => candidate.id === entry.bdcId)
    if (child === undefined) throw new Error(`La vue ${entry.bdcId} du Carousel ${carousel.id} est introuvable.`)
    return child
  })
  return carouselSceneBuilder.build({
    pageId: page.id,
    bdcId: carousel.id,
    content: carousel.carousel,
    cards: views,
    mediaSources: options.mediaSources ?? {},
    mediaTypes: options.mediaTypes ?? {},
    revelationSettings,
    playerSettings: options.editorSettings.player,
    displayMode: 'scene',
    storyId: `${page.id}-diapo-page`,
    completionEventRootId: `${page.id}-${carousel.id}-diapo-end-scrollport`,
    appearanceClassNamesByTarget: options.appearanceClassNamesByTarget,
  })
}

/** Mounts the Question's reusable illustration without Flux scroll observers. */
function createQuestionMediaPerso(
  bdc: Bdc,
  target: string,
  options: DiapoSceneBuildOptions,
): readonly PersoDoc<string>[] {
  const mediaId = bdc.question?.mediaId
  if (mediaId == null || target.length === 0) return []
  const source = options.mediaSources?.[mediaId]
  const mediaType = options.mediaTypes?.[mediaId]
  if (source === undefined || mediaType === undefined) {
    throw new Error(`La source ou le type du média d’illustration ${mediaId} est absent.`)
  }
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return [{
        id: `${bdc.id}-diapo-illustration-${mediaId}`,
        type: 'img',
        initial: {
          src: source,
          className: 'elce-diapo-question-media',
          img: { className: 'elce-diapo-question-media__native' },
          move: { target },
        },
      }]
    case MEDIA_TYPE.VIDEO:
      return [{
        id: `${bdc.id}-diapo-illustration-${mediaId}`,
        type: 'media',
        initial: {
          tag: 'video',
          src: source,
          controls: true,
          sync: 'independent',
          className: 'elce-diapo-question-media',
          move: { target },
        },
      }]
    default:
      throw new Error(`Le média ${mediaId} n’est pas une illustration de Question prise en charge.`)
  }
}

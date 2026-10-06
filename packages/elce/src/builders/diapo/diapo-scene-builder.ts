import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { BDC_TYPE, ELCE_EVENTS, MEDIA_TYPE, PAGE_TYPE } from '../../config/document-config'
import type { Bdc, Page } from '../../domain/document-types'
import { ElceCardBdcSceneBuilder } from '../card-bdc-scene-builder'
import { ElceCardPresetBuilder } from '../card-preset-builder'
import { ElceCarouselSceneBuilder } from '../carousel-scene-builder'
import { createPageBottomMarkerPerso } from '../page-bottom-marker'
import { buildQuestionBdcStory } from '../question-bdc-scene-builder'
import type { DiapoSceneBuild, DiapoSceneBuildOptions } from './diapo-scene-builder-types'

const cardPresetBuilder = new ElceCardPresetBuilder()
const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder()
const carouselSceneBuilder = new ElceCarouselSceneBuilder()

/** Builds a no-scroll Diapo scene with one direct BDC and its existing builder. */
export function buildDiapoScene(
  page: Page,
  bdcs: readonly Bdc[],
  options: DiapoSceneBuildOptions = {},
): DiapoSceneBuild {
  if (page.type !== PAGE_TYPE.DIAPO) throw new Error(`Le builder Diapo ne traite pas la page ${page.id}.`)
  const pageBdcs = page.bdcIds.map((bdcId) => bdcs.find((bdc) => bdc.id === bdcId))
  if (pageBdcs.some((bdc) => bdc === undefined)) throw new Error(`Un BDC de la Diapo ${page.id} est introuvable.`)
  const contentBdcs = pageBdcs.filter((bdc): bdc is Bdc => bdc !== undefined)
  if (contentBdcs.length > 1) throw new Error(`La Diapo ${page.id} accepte un seul BDC direct.`)
  const bdc = contentBdcs[0]
  const scrollPortId = `${page.id}-diapo-scrollport`
  const rootId = `${page.id}-diapo-content`
  const storyId = `${page.id}-diapo-page`
  let markup = ''
  let bottomPartMarkup = ''
  let pageBottomMarker: PersoDoc<string> | undefined
  let childStories: Readonly<Record<string, StoryDoc<string>>> = {}
  let pagePersos: readonly PersoDoc<string>[] = []
  let styleSheets: readonly string[] = []
  let questionReset: DiapoSceneBuild['questionReset']

  if (bdc !== undefined) {
    switch (bdc.type) {
      case BDC_TYPE.CAROUSEL: {
        const carouselBuild = buildCarousel(page, bdc, bdcs, options)
        markup = carouselBuild.markup
        childStories = { [carouselBuild.story.id]: carouselBuild.story }
        styleSheets = [carouselBuild.styleSheet]
        break
      }
      case BDC_TYPE.CARD: {
        const cardBuild = cardBdcSceneBuilder.build({
          pageId: page.id,
          containerBdcId: bdc.id,
          bdc,
          mediaSources: options.mediaSources ?? {},
          mediaTypes: options.mediaTypes ?? {},
        })
        markup = cardBuild.markup
        bottomPartMarkup = `<div id="${page.id}-diapo-bottom-host" class="elce-diapo-bottom-host" data-part="${page.id}:bottom"></div>`
        pageBottomMarker = createPageBottomMarkerPerso({
          pageId: page.id,
          markerId: `${page.id}-diapo-bottom-marker`,
          rootId: scrollPortId,
          targetPartId: `${page.id}:bottom`,
        })
        pagePersos = [...cardBuild.contentPersos, ...cardBuild.mediaPersos]
        break
      }
      case BDC_TYPE.QUESTION: {
        const questionBuild = cardPresetBuilder.build(
          bdc.presetId,
          `${page.id}-${bdc.id}`,
          `${page.id}:${bdc.id}:question`,
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
        const resetEventName = `${page.id}:${bdc.id}:reset`
        questionReset = { eventName: resetEventName }
        const mediaPerso = createQuestionMediaPerso(bdc, questionBuild.zonePartIds.illustration ?? '', options)
        childStories = { [questionStory.id]: { ...questionStory, persos: [...(questionStory.persos ?? []), ...mediaPerso] } }
        break
      }
      default:
        throw new Error(`Le BDC ${bdc.id} (${bdc.type}) n’est pas pris en charge dans une Diapo.`)
    }
  }

  if (bdc === undefined) {
    bottomPartMarkup = `<div id="${page.id}-diapo-bottom-host" class="elce-diapo-bottom-host" data-part="${page.id}:bottom"></div>`
    pageBottomMarker = createPageBottomMarkerPerso({
      pageId: page.id,
      markerId: `${page.id}-diapo-bottom-marker`,
      rootId: scrollPortId,
      targetPartId: `${page.id}:bottom`,
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
          style: { width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflowY: 'hidden' },
          move: '@root',
        },
      },
      {
        id: rootId,
        type: 'layout',
        initial: {
          move: { target: scrollPortId },
          className: 'elce-diapo-content',
          style: { width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden' },
          markup: `<article id="${rootId}" class="elce-diapo-content">${markup}${bottomPartMarkup}</article>`,
        },
      },
      ...(pageBottomMarker === undefined ? [] : [pageBottomMarker]),
      ...pagePersos,
    ],
  }
  return {
    sceneDoc: {
      id: `elce-diapo-${page.id}`,
      stories: { [pageStory.id]: pageStory, ...childStories },
    },
    styleSheets,
    ...(questionReset === undefined ? {} : { questionReset }),
  }
}

/** Projects the Diapo's one supported Carousel BDC with its Card children. */
function buildCarousel(
  page: Page,
  carousel: Bdc,
  bdcs: readonly Bdc[],
  options: DiapoSceneBuildOptions,
) {
  if (carousel.carousel == null) throw new Error(`Le BDC Carousel ${carousel.id} de la Diapo est incomplet.`)
  const cards = carousel.carousel.cards.map((entry) => {
    const card = bdcs.find((candidate) => candidate.id === entry.bdcId)
    if (card === undefined) throw new Error(`La carte ${entry.bdcId} du Carousel ${carousel.id} est introuvable.`)
    return card
  })
  return carouselSceneBuilder.build({
    pageId: page.id,
    bdcId: carousel.id,
    content: carousel.carousel,
    cards,
    mediaSources: options.mediaSources ?? {},
    mediaTypes: options.mediaTypes ?? {},
    displayMode: 'scene',
    completionEventRootId: `${page.id}-${carousel.id}-diapo-end-scrollport`,
  })
}

/** Mounts the Question's reusable illustration without Flux scroll observers. */
function createQuestionMediaPerso(
  bdc: Bdc,
  target: string,
  options: DiapoSceneBuildOptions,
): readonly PersoDoc<string>[] {
  if (bdc.mediaId === null || target.length === 0) return []
  const source = options.mediaSources?.[bdc.mediaId]
  const mediaType = options.mediaTypes?.[bdc.mediaId]
  if (source === undefined || mediaType === undefined) {
    throw new Error(`La source ou le type du média d’illustration ${bdc.mediaId} est absent.`)
  }
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return [{
        id: `${bdc.id}-diapo-illustration-${bdc.mediaId}`,
        type: 'img',
        initial: {
          src: source,
          className: 'elce-diapo-question-media',
          img: { style: { display: 'block', width: '100%', maxHeight: '28vh', objectFit: 'contain' } },
          move: { target },
        },
      }]
    case MEDIA_TYPE.VIDEO:
      return [{
        id: `${bdc.id}-diapo-illustration-${bdc.mediaId}`,
        type: 'media',
        initial: {
          tag: 'video',
          src: source,
          controls: true,
          className: 'elce-diapo-question-media',
          video: { style: { display: 'block', width: '100%', maxHeight: '28vh', objectFit: 'contain' } },
          move: { target },
        },
      }]
    default:
      throw new Error(`Le média ${bdc.mediaId} n’est pas une illustration de Question prise en charge.`)
  }
}

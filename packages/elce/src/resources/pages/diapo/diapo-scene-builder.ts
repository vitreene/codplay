import { AVATAR_BDC_TYPE } from '../../bdcs/avatar/avatar-config'
import { appendAvatarToDiapoStory } from '../../bdcs/avatar/reading/avatar-diapo-story'
import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { CARD_BDC_TYPE } from '../../bdcs/card/card-config'
import { CAROUSEL_BDC_TYPE, CAROUSEL_PLAYBACK_MODE } from '../../bdcs/carousel/carousel-config'
import { QUESTION_BDC_TYPE, QUESTION_EVENTS } from '../../bdcs/question/question-config'
import { STATISTICAL_GRAPH_BDC_TYPE } from '../../bdcs/statistical-graph/statistical-graph-config'
import { DIAPO_PAGE_TYPE } from './diapo-config'
import { PAGE_FINISHED_EVENT } from '../page-completion/page-completion-events'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import type { ResourceBdc } from '../../document/resource-document-types'
import type { ContentPage } from '../../../core/document/content-document-types'
import { createPageBottomMarkerPerso } from '../page-completion/page-bottom-marker'
import { ElceStatisticalGraphSceneBuilder } from '../../bdcs/statistical-graph/reading/statistical-graph-scene-builder'
import { buildQuestionBdcStory, buildQuestionCardPreset } from '../../bdcs/question/reading/question-bdc-scene-builder'
import type { DiapoSceneBuild, DiapoSceneBuildOptions } from './diapo-scene-builder-types'
import { addViewportExpansionToScene } from '../../viewport-expansion/viewport-expansion-builder'
import { appearanceClassNameForBdc, appearanceClassNameForPage } from '../../../builders/scene-style/appearance-class-names'

const statisticalGraphSceneBuilder = new ElceStatisticalGraphSceneBuilder()

/** Builds a no-scroll Diapo scene with one principal BDC and an optional sibling Avatar. */
export function buildDiapoScene(
  page: ContentPage,
  bdcs: readonly ResourceBdc[],
  options: DiapoSceneBuildOptions,
): DiapoSceneBuild {
  if (page.type !== DIAPO_PAGE_TYPE) throw new Error(`Le builder Diapo ne traite pas la page ${page.id}.`)
  const pageBdcs = page.bdcIds.map((bdcId) => bdcs.find((bdc) => bdc.id === bdcId))
  if (pageBdcs.some((bdc) => bdc === undefined)) throw new Error(`Un BDC de la Diapo ${page.id} est introuvable.`)
  const directBdcs = pageBdcs.filter((bdc): bdc is ResourceBdc => bdc !== undefined)
  const avatars = directBdcs.filter((bdc) => bdc.type === AVATAR_BDC_TYPE)
  if (avatars.length > 1) throw new Error('Une Diapo accepte un seul Avatar.')
  const avatar = avatars[0]
  const contentBdcs = directBdcs.filter((bdc) => bdc.type !== AVATAR_BDC_TYPE)
  if (contentBdcs.length > 1) throw new Error(`La Diapo ${page.id} accepte un seul BDC direct.`)
  const bdc = contentBdcs[0]
  const storyId = `${page.id}-diapo-page`

  if (bdc?.type === CAROUSEL_BDC_TYPE) {
    const carouselBuild = buildCarousel(page, bdc, bdcs, options, avatar)
    const take = avatar?.avatar?.take
    const audioSource = take == null ? undefined : options.mediaSources?.[take.audioMediaId]
    if (take != null && audioSource === undefined) throw new Error('Le fichier audio de la prise est indisponible.')
    const pageRootId = `${page.id}-diapo-content`
    const pageStory = createDiapoCarouselPageStory(page, bdc, { ...carouselBuild.story, id: storyId }, options, take == null ? undefined : avatar?.avatar?.placement)
    const narratedPageStory = avatar !== undefined && take != null && audioSource !== undefined
      ? appendAvatarToDiapoStory(pageStory, page.id, pageRootId, avatar, audioSource, appearanceClassNameForBdc(avatar.id, options.appearanceClassNamesByTarget))
      : pageStory
    return {
      sceneDoc: {
        ...addViewportExpansionToScene({
          id: `elce-diapo-${page.id}`,
          stories: { [storyId]: narratedPageStory },
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

  const additionalBuild = bdc === undefined ? null : options.buildAdditionalBdc?.(page, bdc)
  if (additionalBuild !== null && additionalBuild !== undefined) {
    markup = additionalBuild.mountMarkup
    childStories = Object.fromEntries(additionalBuild.stories.map((story) => [story.id, story]))
    bottomPartMarkup = `<!-- data-part="${page.id}:bottom" -->`
    pageBottomMarker = createPageBottomMarkerPerso({
      pageId: page.id,
      markerId: `${page.id}-diapo-bottom-marker`,
      rootId: scrollPortId,
      targetPartId: `${page.id}:bottom`,
      settings: options.editorSettings.player.progression.pageCompletionObservation,
    })
  } else if (bdc !== undefined) {
    switch (bdc.type) {
      case CARD_BDC_TYPE: {
        const cardBuild = options.cardBdcSceneBuilder.build({
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
      case STATISTICAL_GRAPH_BDC_TYPE: {
        const graphBuild = statisticalGraphSceneBuilder.build(
          bdc,
          `${page.id}-${bdc.id}-graph`,
          `${page.id}:${bdc.id}:statistical-graph`,
          appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
          options.inlineTextSceneFeature,
        )
        markup = graphBuild.markup
        pagePersos = [...graphBuild.mediaPersos, ...graphBuild.contentPersos]
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
      case QUESTION_BDC_TYPE: {
        if (bdc.question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
        const questionBuild = buildQuestionCardPreset(
          `${page.id}-${bdc.id}`,
          `${page.id}:${bdc.id}:question`,
          bdc.question,
          options.presetBuilder,
          appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
          options.inlineTextSceneFeature,
        )
        markup = questionBuild.markup
        const questionStory = buildQuestionBdcStory(
          page.id,
          bdc,
          questionBuild.zonePartIds,
          PAGE_FINISHED_EVENT,
          { pageId: page.id },
          options.inlineTextSceneFeature,
        )
        childStories = { [questionStory.id]: questionStory }
        const resetEventName = QUESTION_EVENTS.RESET
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
  page: ContentPage,
  carousel: ResourceBdc,
  story: StoryDoc<string>,
  options: DiapoSceneBuildOptions,
  avatarPlacement?: NonNullable<ResourceBdc['avatar']>['placement'],
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
  const narratedClass = avatarPlacement === undefined ? '' : ' elce-diapo-content--narrated'
  const pageRoot: PersoDoc<string> = {
    id: pageRootId,
    type: 'layout',
    initial: {
      move: '@root',
      className: `elce-diapo-content${narratedClass} ${pageAppearanceClass}`,
      markup: `<article id="${pageRootId}" class="elce-diapo-content${narratedClass} ${pageAppearanceClass}"><!-- data-part="${pagePartId}" --></article>`,
    },
  }
  return { ...story, persos: [pageRoot, ...carouselPersos] }
}

/** Projects the Diapo's one supported Carousel BDC with its illustration children. */
function buildCarousel(
  page: ContentPage,
  carousel: ResourceBdc,
  bdcs: readonly ResourceBdc[],
  options: DiapoSceneBuildOptions,
  avatar?: ResourceBdc,
) {
  if (carousel.carousel == null) throw new Error(`Le BDC Carousel ${carousel.id} de la Diapo est incomplet.`)
  const revelationSettings = options.editorSettings.revelation.carouselsByBdcId[carousel.id]
  if (revelationSettings === undefined) throw new Error(`Les réglages de révélation du Carousel ${carousel.id} sont absents.`)
  const narrated = avatar?.avatar?.take != null
  const carouselContent = narrated
    ? { ...carousel.carousel, playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC, repeatCount: 0 }
    : carousel.carousel
  const views = carousel.carousel.cards.map((entry) => {
    const child = bdcs.find((candidate) => candidate.id === entry.bdcId)
    if (child === undefined) throw new Error(`La vue ${entry.bdcId} du Carousel ${carousel.id} est introuvable.`)
    return child
  })
  return options.carouselSceneBuilder.build({
    pageId: page.id,
    bdcId: carousel.id,
    content: carouselContent,
    cards: views,
    mediaSources: options.mediaSources ?? {},
    mediaTypes: options.mediaTypes ?? {},
    revelationSettings,
    playerSettings: options.editorSettings.player,
    displayMode: 'scene',
    navigation: narrated ? 'none' : 'points',
    pageCompletion: narrated ? 'external' : 'last-card',
    storyId: `${page.id}-diapo-page`,
    completionEventRootId: `${page.id}-${carousel.id}-diapo-end-scrollport`,
    appearanceClassNamesByTarget: options.appearanceClassNamesByTarget,
  })
}

/** Mounts the Question's reusable illustration without Flux scroll observers. */
function createQuestionMediaPerso(
  bdc: ResourceBdc,
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

import { EVENT_ACTION } from '@codplay/capsule-automation'
import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { ANCHOR, BDC_TYPE, DEFAULT_PRESET_ID, DEFAULT_PROJECT_REVELATION, MEDIA_TYPE, PAGE_TYPE } from '../../config/document-config'
import type { Bdc, BdcId, Page } from '../../domain/document/document-types'
import { projectFluxPlayerMarkup, readFluxAnchorTargets } from './flux-anchor-player-markup'
import { anchorCardBlockSizeFor, anchorFlowBlockSizeFor, anchorNameFor } from '../../anchor/anchor-position'
import { ElceAnchorRatioService } from '../../domain/anchor/anchor-ratio-service'
import { ElceCardPresetBuilder } from '../card/card-preset-builder'
import type { FluxAnchorTarget } from './flux-anchor-player-markup-types'
import type { FluxSceneBuild, FluxSceneBuildOptions } from './flux-scene-builder-types'
import { ElceCarouselSceneBuilder } from '../carousel/carousel-scene-builder'
import type { CarouselSceneBuild } from '../carousel/carousel-scene-builder-types'
import { buildQuestionBdcStory, buildQuestionCardPreset } from '../question/question-bdc-scene-builder'
import { createPageBottomMarkerPerso } from './page-bottom-marker'
import { buildEvaluationResultBdcScene } from '../evaluation/evaluation-result-bdc-scene-builder'
import { ElceCardBdcSceneBuilder } from '../card/card-bdc-scene-builder'
import type { CardBdcSceneBuild } from '../card/card-bdc-scene-builder'
import { createRevelationAction } from '../revelation/revelation-action'

type FluxBdcMount = Readonly<{
  readonly bdc: Bdc
  readonly partId: string
  readonly markup: string
  readonly anchored: boolean
  readonly zonePartIds: Readonly<Record<string, string>>
  readonly paddingBottom?: string
  readonly questionResetEvent?: string
  readonly carouselBuild?: CarouselSceneBuild
  readonly evaluationResultStory?: StoryDoc<string>
  readonly cardBuild?: CardBdcSceneBuild
}>

const anchorRatioService = new ElceAnchorRatioService()
const cardPresetBuilder = new ElceCardPresetBuilder()
const carouselSceneBuilder = new ElceCarouselSceneBuilder()
const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder()

/** Builds an Elcé Flux scene from the métier page without creating a player circuit. */
export function buildFluxScene(
  page: Page,
  bdcs: readonly Bdc[],
  options: FluxSceneBuildOptions = {},
): FluxSceneBuild {
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return buildFluxPageScene(page, bdcs, options)
    case PAGE_TYPE.DIAPO:
      throw new Error(`Le builder Flux ne traite pas encore la page Diapo ${page.id}.`)
    default:
      return assertNeverPageType(page.type)
  }
}

function buildFluxPageScene(page: Page, bdcs: readonly Bdc[], options: FluxSceneBuildOptions): FluxSceneBuild {
  const pageBdcs = page.bdcIds.map((bdcId) => bdcs.find((bdc) => bdc.id === bdcId))
  const missingBdc = pageBdcs.find((bdc) => bdc === undefined)
  switch (missingBdc) {
    case undefined:
      break
    default:
      throw new Error(`Un bdc de la page ${page.id} est introuvable.`)
  }
  const pageContents = pageBdcs.filter((bdc): bdc is Bdc => bdc !== undefined)
  const anchorTargets = readAnchorTargets(pageContents, bdcs)
  const mounts = pageContents.map((bdc) => createBdcMount(page, bdc, bdcs, options))

  const scrollPortId = `${page.id}-scrollport`
  const articleId = `${page.id}-article`
  const bottomMarkerId = `${page.id}-bottom-marker`
  const articleMarkup = `<article id="${articleId}" class="elce-flux-article">${mounts.map((mount) => mount.markup).join('')}<!-- data-part="${page.id}:bottom" --></article>`
  const pageMediaPersos = mounts.flatMap((mount) => createMediaPersos(page, mount, scrollPortId, options))
  const anchoredCardPersos = anchorTargets.flatMap((target) => {
    const card = bdcs.find((candidate) => candidate.id === target.bdcId)
    const section = pageContents.find((candidate) => candidate.id === target.sectionBdcId)
    if (card === undefined || section?.type !== BDC_TYPE.SECTION || section.section === null) {
      throw new Error(`La Carte ancrée ${target.bdcId} ou sa Section est introuvable.`)
    }
    const cardBuild = buildFluxCard(page, section.id, card, options)
    return createFluxCardPersos(page, card, cardBuild, target.partId, scrollPortId, options, {
      paddingBottom: target.paddingBottom,
      layoutId: target.layoutId,
      revelation: section.section.revelation,
    })
  })

  const pageStory: StoryDoc<string> = {
    id: `${page.id}-page`,
    persos: [
      {
        id: scrollPortId,
        type: 'scroll-container',
        initial: {
          tag: 'section',
          attr: { id: scrollPortId, 'aria-label': 'Contenu de la page' },
          className: 'elce-flux-scrollport',
          style: { width: '100%', height: '100%', minHeight: 0, overflowY: 'auto' },
          move: '@root',
        },
      },
      {
        id: articleId,
        type: 'layout',
        initial: {
          move: { target: scrollPortId },
          className: 'elce-flux-article',
          style: { display: 'flex', minHeight: '100%', flexDirection: 'column', gap: '1.25rem', padding: '2rem', boxSizing: 'border-box' },
          markup: articleMarkup,
          flowReservations: anchorTargets.map((target) => ({
            partId: target.partId,
            blockSize: anchorFlowBlockSizeFor(target.paddingBottom, target.layoutId),
          })),
        },
      },
      createPageBottomMarkerPerso({
        pageId: page.id,
        markerId: bottomMarkerId,
        rootId: scrollPortId,
        targetPartId: `${page.id}:bottom`,
      }),
      ...pageMediaPersos,
      ...anchoredCardPersos,
    ],
  }

  const stories: Readonly<Record<string, StoryDoc<string>>> = {
    [pageStory.id]: pageStory,
    ...Object.fromEntries(mounts.filter((mount) => mount.bdc.type === BDC_TYPE.SECTION).map((mount) => [
      `${page.id}-${mount.bdc.id}`,
      createSectionStory(page, mount.bdc, mount.zonePartIds.title ?? `${mount.partId}:title`),
    ])),
    ...Object.fromEntries(mounts.filter((mount) => mount.bdc.type === BDC_TYPE.QUESTION).map((mount) => [
      `${page.id}-${mount.bdc.id}`,
      buildQuestionBdcStory(page.id, mount.bdc, mount.zonePartIds),
    ])),
    ...Object.fromEntries(mounts.flatMap((mount) => mount.evaluationResultStory === undefined
      ? []
      : [[mount.evaluationResultStory.id, mount.evaluationResultStory] as const])),
    ...Object.fromEntries(mounts.flatMap((mount) => mount.carouselBuild === undefined
      ? []
      : [[mount.carouselBuild.story.id, mount.carouselBuild.story] as const])),
  }
  const questionMount = mounts.find((mount) => mount.bdc.type === BDC_TYPE.QUESTION)
  return {
    sceneDoc: { id: `elce-flux-${page.id}`, stories },
    scrollPortId,
    bottomMarkerId,
    storyIds: Object.keys(stories),
    styleSheets: mounts.flatMap((mount) => mount.carouselBuild === undefined ? [] : [mount.carouselBuild.styleSheet]),
    ...(questionMount?.questionResetEvent === undefined ? {} : { questionReset: { eventName: questionMount.questionResetEvent } }),
  }
}

function createBdcMount(
  page: Page,
  bdc: Bdc,
  allBdcs: readonly Bdc[],
  options: FluxSceneBuildOptions,
): FluxBdcMount {
  switch (bdc.type) {
    case BDC_TYPE.SECTION: {
      const partId = `${page.id}:${bdc.id}:section`
      const sectionId = `${page.id}-${bdc.id}`
      const card = cardPresetBuilder.build(
        bdc.presetId,
        sectionId,
        partId,
        { body: projectFluxPlayerMarkup(bdc.section?.markup ?? '') },
      )
      return {
        bdc,
        partId,
        anchored: false,
        markup: card.markup,
        zonePartIds: card.zonePartIds,
      }
    }
    case BDC_TYPE.CARD: {
      if (bdc.card === null) throw new Error(`La Carte ${bdc.id} n’a pas de contenu.`)
      const partId = `${page.id}:${bdc.id}:card:mount`
      return {
        bdc,
        partId,
        anchored: false,
        zonePartIds: {},
        markup: `<!-- data-part="${partId}" -->`,
        cardBuild: buildFluxCard(page, bdc.id, bdc, options),
      }
    }
    case BDC_TYPE.QUESTION: {
      const question = bdc.question
      if (question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
      const partId = `${page.id}:${bdc.id}:question`
      const card = buildQuestionCardPreset(`${page.id}-${bdc.id}`, partId, question)
      const resetEvent = `${page.id}:${bdc.id}:reset`
      return {
        bdc,
        partId,
        anchored: false,
        markup: card.markup,
        zonePartIds: card.zonePartIds,
        questionResetEvent: resetEvent,
      }
    }
    case BDC_TYPE.EVALUATION_RESULT: {
      const resultBuild = buildEvaluationResultBdcScene(page, bdc)
      return {
        bdc,
        partId: `${page.id}:${bdc.id}:evaluation-result`,
        anchored: false,
        markup: resultBuild.markup,
        zonePartIds: {},
        evaluationResultStory: resultBuild.story,
      }
    }
    case BDC_TYPE.CAROUSEL: {
      const content = bdc.carousel
      switch (content) {
        case null:
        case undefined:
          throw new Error(`Le BDC Carousel ${bdc.id} n’a pas de contenu.`)
        default: {
      const carouselBuild = carouselSceneBuilder.build({
            pageId: page.id,
            bdcId: bdc.id,
            content,
            cards: allBdcs,
            mediaSources: options.mediaSources ?? {},
        mediaTypes: options.mediaTypes ?? {},
        revelationDefaults: options.revelationDefaults,
          })
          return {
            bdc,
            partId: `${page.id}:${bdc.id}:carousel`,
            anchored: false,
            markup: carouselBuild.markup,
            zonePartIds: {},
            carouselBuild,
          }
        }
      }
    }
    case BDC_TYPE.CARD:
      throw new Error(`Le BDC Carte ${bdc.id} doit être projeté par son BDC conteneur.`)
    default:
      return assertNeverBdcType(bdc.type)
  }
}

/** Reads the CodPlay targets exported by anchors inside the page's Sections. */
function readAnchorTargets(bdcs: readonly Bdc[], allBdcs: readonly Bdc[]): readonly FluxAnchorTarget[] {
  return bdcs.flatMap((bdc) => {
    switch (bdc.type) {
      case BDC_TYPE.SECTION:
        return readFluxAnchorTargets(bdc.section?.markup ?? '').map((target) => {
          const card = allBdcs.find((candidate) => candidate.id === target.bdcId)
          if (card?.type !== BDC_TYPE.CARD) throw new Error(`La Carte de l’ancre ${target.bdcId} est introuvable.`)
          return { ...target, layoutId: card.presetId, sectionBdcId: bdc.id }
        })
      case BDC_TYPE.QUESTION:
      case BDC_TYPE.EVALUATION_RESULT:
      case BDC_TYPE.CAROUSEL:
      case BDC_TYPE.CARD:
        return []
      default:
        return assertNeverBdcType(bdc.type)
    }
  })
}

function createMediaPersos(
  page: Page,
  mount: FluxBdcMount,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
): readonly PersoDoc<string>[] {
  switch (mount.bdc.type) {
    case BDC_TYPE.SECTION:
      return []
    case BDC_TYPE.CARD:
      return mount.cardBuild === undefined
        ? []
        : createFluxCardPersos(page, mount.bdc, mount.cardBuild, mount.partId, scrollPortId, options)
    case BDC_TYPE.QUESTION:
      return createQuestionMediaPerso(page, mount.bdc, mount.zonePartIds.illustration ?? '', scrollPortId, options)
    case BDC_TYPE.EVALUATION_RESULT:
      return []
    case BDC_TYPE.CAROUSEL:
      return mount.carouselBuild?.mediaPersos ?? []
    default:
      return assertNeverBdcType(mount.bdc.type)
  }
}

/** Builds a Card and its media/text persos in the Flux page's authored layout. */
function buildFluxCard(page: Page, containerBdcId: BdcId, bdc: Bdc, options: FluxSceneBuildOptions): CardBdcSceneBuild {
  return cardBdcSceneBuilder.build({
    pageId: page.id,
    containerBdcId,
    bdc,
    mediaSources: options.mediaSources ?? {},
    mediaTypes: options.mediaTypes ?? {},
  })
}

/** Projects one unique Card BDC at its page or text-anchor placement. */
function createFluxCardPersos(
  page: Page,
  bdc: Bdc,
  cardBuild: CardBdcSceneBuild,
  targetPartId: string,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
  anchor?: Readonly<{ paddingBottom: string; layoutId: string; revelation: NonNullable<Bdc['section']>['revelation'] }>,
): readonly PersoDoc<string>[] {
  const mediaId = bdc.card?.mediaId
  const mediaType = mediaId === null || mediaId === undefined ? undefined : options.mediaTypes?.[mediaId]
  const projectRevelation = options.revelationDefaults ?? DEFAULT_PROJECT_REVELATION
  const introRef = anchor?.revelation.intro ?? projectRevelation.intro
  const outroRef = anchor?.revelation.outro ?? projectRevelation.outro
  const cardId = `${page.id}-${bdc.id}-card`
  const enterEvent = `${cardId}:enter`
  const leaveEvent = `${cardId}:leave`
  const aspectRatio = mediaType === MEDIA_TYPE.VIDEO
    ? '16 / 9'
    : anchor === undefined
      ? ANCHOR.DEFAULT_IMAGE_ASPECT_RATIO
      : anchorRatioService.imageAspectRatio(anchor.paddingBottom)
  const anchoredStyle = anchor === undefined ? {} : {
    position: 'absolute',
    'position-anchor': anchorNameFor(targetPartId),
    'inset-inline-start': 0,
    'inset-inline-end': 0,
    'inset-block-start': `calc(anchor(top) + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`,
    width: '100%',
    ...(anchor.layoutId === DEFAULT_PRESET_ID.PHOTO
      ? { aspectRatio }
      : { height: anchorCardBlockSizeFor(anchor.layoutId, anchor.paddingBottom) }),
  }
  const root: PersoDoc<string> = {
    id: cardId,
    type: 'layout',
    initial: {
      move: { target: targetPartId },
      className: `${cardBuild.rootClassName} elce-flux-card-root`,
      style: anchor === undefined ? { width: '100%' } : anchoredStyle,
      markup: cardBuild.markup,
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: { threshold: 0 },
        enter: [{ name: enterEvent }],
        leave: [{ name: leaveEvent }],
      },
    },
    actions: {
      [enterEvent]: createRevelationAction(introRef, EVENT_ACTION.intro),
      [leaveEvent]: createRevelationAction(outroRef, EVENT_ACTION.outro),
    },
  }
  return [root, ...cardBuild.contentPersos, ...cardBuild.mediaPersos]
}

/** Mounts the question's reusable illustration media into its configured card zone. */
function createQuestionMediaPerso(
  page: Page,
  bdc: Bdc,
  target: string,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
): readonly PersoDoc<string>[] {
  const mediaId = bdc.question?.mediaId
  if (mediaId == null) return []
  const mediaType = options.mediaTypes?.[mediaId]
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return [createImagePerso(page, bdc, target, scrollPortId, resolveMediaSource(bdc.id, mediaId, options), false, ANCHOR.DEFAULT_IMAGE_ASPECT_RATIO)]
    case MEDIA_TYPE.VIDEO:
      return [createVideoPerso(page, bdc, target, scrollPortId, resolveMediaSource(bdc.id, mediaId, options), false)]
    default:
      throw new Error(`Le type du média d’illustration ${mediaId} est absent ou non pris en charge.`)
  }
}

function createSectionStory(page: Page, bdc: Bdc, articlePartId: string): StoryDoc<string> {
  const headingId = `${page.id}-${bdc.id}-title`
  return {
    id: `${page.id}-${bdc.id}`,
    persos: bdc.section?.title
      ? [{
          id: headingId,
          type: 'tag',
          initial: {
            tag: 'h2',
            content: bdc.section.title,
            move: { target: articlePartId },
          },
        }]
      : [],
  }
}

function createImagePerso(
  page: Page,
  bdc: Bdc,
  articlePartId: string,
  scrollPortId: string,
  source: string,
  anchored: boolean,
  paddingBottom: string,
): PersoDoc<string> {
  const imageId = `${page.id}-${bdc.id}-image`
  const enterEvent = `${imageId}:enter`
  const leaveEvent = `${imageId}:leave`
  const aspectRatio = anchored
    ? anchorRatioService.imageAspectRatio(paddingBottom)
    : ANCHOR.DEFAULT_IMAGE_ASPECT_RATIO
  return {
    id: imageId,
    type: 'img',
    initial: {
      src: source,
      className: 'elce-flux-image',
      style: anchored
        ? {
            position: 'absolute',
            'position-anchor': anchorNameFor(articlePartId),
            'inset-inline-start': 0,
            'inset-inline-end': 0,
            'inset-block-start': `calc(anchor(top) + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`,
            width: '100%',
            height: 'auto',
            aspectRatio,
            translateX: '0%',
          }
        : { translateX: '0%' },
      img: {
        style: { display: 'block', width: '100%', aspectRatio, objectFit: 'cover' },
      },
      move: { target: articlePartId },
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: { threshold: 0 },
        enter: [{ name: enterEvent }],
        leave: [{ name: leaveEvent }],
      },
    },
    actions: {
      [enterEvent]: { style: { translateX: { from: '-112%', to: '0%', duration: 1000, ease: 'outCubic' } } },
      [leaveEvent]: { style: { translateX: { from: '0%', to: '-112%', duration: 820, ease: 'inCubic' } } },
    },
  }
}

function createVideoPerso(
  page: Page,
  bdc: Bdc,
  articlePartId: string,
  scrollPortId: string,
  source: string,
  anchored: boolean,
): PersoDoc<string> {
  const videoId = `${page.id}-${bdc.id}-video`
  const playEvent = `${videoId}:fully-visible`
  const pauseEvent = `${videoId}:half-hidden`
  return {
    id: videoId,
    type: 'media',
    initial: {
      tag: 'video',
      src: source,
      controls: true,
      master: false,
      className: 'elce-flux-video',
      style: anchored
        ? {
            position: 'absolute',
            'position-anchor': anchorNameFor(articlePartId),
            'inset-inline-start': 0,
            'inset-inline-end': 0,
            'inset-block-start': `calc(anchor(top) + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`,
            width: '100%',
            height: 'auto',
            aspectRatio: '16 / 9',
          }
        : { position: 'relative', width: '100%', marginInline: 'auto', maxWidth: '48rem' },
      video: {
        style: { display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' },
      },
      move: { target: articlePartId },
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: { threshold: 0.75 },
        enter: [{ name: playEvent }],
        leave: [{ name: pauseEvent }],
      },
    },
    actions: {
      [playEvent]: { broadcast: { type: 'START' } },
      [pauseEvent]: { broadcast: { type: 'PAUSE' } },
    },
  }
}

function resolveMediaSource(bdcId: BdcId, mediaId: string, options: FluxSceneBuildOptions): string {
  switch (mediaId) {
    case null:
      throw new Error(`Le bdc média ${bdcId} ne référence aucun média.`)
    default:
      break
  }
  const source = options.mediaSources?.[mediaId]
  switch (source) {
    case undefined:
      throw new Error(`La source du média ${mediaId} est absente pour le bdc ${bdcId}.`)
    default:
      return source
  }
}

function assertNeverPageType(value: never): never {
  throw new Error(`Type de page non traité : ${String(value)}`)
}

function assertNeverBdcType(value: never): never {
  throw new Error(`Type de bdc non traité : ${String(value)}`)
}

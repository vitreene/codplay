import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { ANCHOR, BDC_TYPE, ELCE_EVENTS, EVALUATION_RESULT_BRANCH, EVALUATION_RESULT_CONFIG, MEDIA_TYPE, PAGE_TYPE } from '../config/document-config'
import type { EvaluationResultAction, EvaluationResultBranch } from '../config/document-config-types'
import type { Bdc, Page } from '../domain/document-types'
import { projectFluxPlayerMarkup, readFluxAnchorTargets } from './flux-anchor-player-markup'
import { anchorFlowBlockSizeFor, anchorNameFor } from '../anchor/anchor-position'
import { ElceAnchorRatioService } from '../domain/anchor-ratio-service'
import { ElceCardPresetBuilder } from './card-preset-builder'
import type { FluxAnchorTarget } from './flux-anchor-player-markup-types'
import type { FluxSceneBuild, FluxSceneBuildOptions } from './flux-scene-builder-types'
import { ElceCarouselSceneBuilder } from './carousel-scene-builder'
import type { CarouselSceneBuild } from './carousel-scene-builder-types'
import { buildQuestionBdcStory } from './question-bdc-scene-builder'
import { createPageBottomMarkerPerso } from './page-bottom-marker'

type FluxBdcMount = Readonly<{
  readonly bdc: Bdc
  readonly partId: string
  readonly markup: string
  readonly anchored: boolean
  readonly zonePartIds: Readonly<Record<string, string>>
  readonly paddingBottom?: string
  readonly questionResetEvent?: string
  readonly carouselBuild?: CarouselSceneBuild
}>

const anchorRatioService = new ElceAnchorRatioService()
const cardPresetBuilder = new ElceCardPresetBuilder()
const carouselSceneBuilder = new ElceCarouselSceneBuilder()

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
  const anchorTargets = readAnchorTargets(pageContents)
  const mounts = pageContents.map((bdc) => createBdcMount(page, bdc, bdcs, anchorTargets, options))

  const scrollPortId = `${page.id}-scrollport`
  const articleId = `${page.id}-article`
  const bottomMarkerId = `${page.id}-bottom-marker`
  const articleMarkup = `<article id="${articleId}" class="elce-flux-article">${mounts.map((mount) => mount.markup).join('')}<div id="${page.id}-bottom-host" data-part="${page.id}:bottom"></div></article>`
  const pageMediaPersos = mounts.flatMap((mount) => createMediaPersos(page, mount, scrollPortId, options))

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
            blockSize: anchorFlowBlockSizeFor(target.paddingBottom),
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
    ...Object.fromEntries(mounts.filter((mount) => mount.bdc.type === BDC_TYPE.EVALUATION_RESULT).map((mount) => [
      `${page.id}-${mount.bdc.id}`,
      createEvaluationResultStory(page, mount.bdc, mount.zonePartIds),
    ])),
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
  anchorTargets: readonly FluxAnchorTarget[],
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
    case BDC_TYPE.IMAGE:
    case BDC_TYPE.VIDEO: {
      const anchorTarget = anchorTargets.find((candidate) => candidate.bdcId === bdc.id)
      switch (anchorTarget) {
        case undefined:
          break
        default:
          return { bdc, partId: anchorTarget.partId, markup: '', anchored: true, zonePartIds: {}, paddingBottom: anchorTarget.paddingBottom }
      }
      const partId = `${page.id}:${bdc.id}:media`
      const hostId = `${page.id}-${bdc.id}-media-host`
      return {
        bdc,
        partId,
        anchored: false,
        zonePartIds: {},
        markup: `<div id="${hostId}" class="elce-flux-media-host" data-part="${partId}"></div>`,
      }
    }
    case BDC_TYPE.QUESTION: {
      const question = bdc.question
      if (question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
      const partId = `${page.id}:${bdc.id}:question`
      const card = cardPresetBuilder.build(bdc.presetId, `${page.id}-${bdc.id}`, partId)
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
      const result = bdc.evaluationResult
      if (result === null || result === undefined) throw new Error(`Le bdc Résultat ${bdc.id} n’a pas de contenu.`)
      const partId = `${page.id}:${bdc.id}:evaluation-result`
      const card = cardPresetBuilder.build(bdc.presetId, `${page.id}-${bdc.id}`, partId)
      return {
        bdc,
        partId,
        anchored: false,
        markup: card.markup,
        zonePartIds: card.zonePartIds,
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
function readAnchorTargets(bdcs: readonly Bdc[]): readonly FluxAnchorTarget[] {
  return bdcs.flatMap((bdc) => {
    switch (bdc.type) {
      case BDC_TYPE.SECTION:
        return readFluxAnchorTargets(bdc.section?.markup ?? '')
      case BDC_TYPE.IMAGE:
      case BDC_TYPE.VIDEO:
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
    case BDC_TYPE.IMAGE:
      return [createImagePerso(
        page,
        mount.bdc,
        mount.partId,
        scrollPortId,
        resolveMediaSource(mount.bdc, options),
        mount.anchored,
        mount.paddingBottom ?? ANCHOR.IMAGE_BLOCK_SIZE,
      )]
    case BDC_TYPE.VIDEO:
      return [createVideoPerso(page, mount.bdc, mount.partId, scrollPortId, resolveMediaSource(mount.bdc, options), mount.anchored)]
    case BDC_TYPE.QUESTION:
      return createQuestionMediaPerso(page, mount.bdc, mount.zonePartIds.illustration ?? '', scrollPortId, options)
    case BDC_TYPE.EVALUATION_RESULT:
      return []
    case BDC_TYPE.CAROUSEL:
      return mount.carouselBuild?.mediaPersos ?? []
    case BDC_TYPE.CARD:
      return []
    default:
      return assertNeverBdcType(mount.bdc.type)
  }
}

/** Builds the conditional success/failure presentation for one Result BDC. */
function createEvaluationResultStory(
  page: Page,
  bdc: Bdc,
  zones: Readonly<Record<string, string>>,
): StoryDoc<string> {
  const result = bdc.evaluationResult
  if (result === null || result === undefined) throw new Error(`Le bdc Résultat ${bdc.id} n’a pas de contenu.`)
  const prefix = `${page.id}:${bdc.id}`
  const rootId = `${page.id}-${bdc.id}`
  const partId = `${prefix}:evaluation-result`
  const card = cardPresetBuilder.build(bdc.presetId, rootId, partId)
  return {
    id: `${page.id}-${bdc.id}`,
    persos: [
      {
        id: `${bdc.id}-result-card`,
        type: 'layout',
        initial: {
          move: '@root',
          className: 'elce-card--evaluation-result elce-evaluation-result--pending',
          markup: card.markup,
        },
        actions: {
          [ELCE_EVENTS.EVALUATION_RESULT_SUCCESS]: { className: 'elce-card--evaluation-result elce-evaluation-result--success' },
          [ELCE_EVENTS.EVALUATION_RESULT_FAILURE]: { className: 'elce-card--evaluation-result elce-evaluation-result--failure' },
        },
      },
      ...resultBranchPersos(page, bdc, EVALUATION_RESULT_BRANCH.SUCCESS, result.success, zones, prefix),
      ...resultBranchPersos(page, bdc, EVALUATION_RESULT_BRANCH.FAILURE, result.failure, zones, prefix),
    ],
  }
}

/** Creates the message and configured button for one evaluation result branch. */
function resultBranchPersos(
  page: Page,
  bdc: Bdc,
  branch: EvaluationResultBranch,
  content: NonNullable<Bdc['evaluationResult']>['success'],
  zones: Readonly<Record<string, string>>,
  prefix: string,
): readonly PersoDoc<string>[] {
  const messageZone = zones[`${branch}-message`]
  const actionZone = zones[`${branch}-action`]
  if (messageZone === undefined || actionZone === undefined) {
    throw new Error(`Les zones du résultat ${branch} manquent au bdc ${bdc.id}.`)
  }
  const label = EVALUATION_RESULT_CONFIG[branch].actions.find((candidate) => candidate.value === content.action)?.label
  const actionPersos = label === undefined || content.action === null
    ? []
    : [createEvaluationResultActionPerso(page, bdc, branch, content.action, label, actionZone, prefix)]
  return [
    {
      id: `${bdc.id}-${branch}-message`,
      type: 'tag',
      initial: { tag: 'p', content: content.message, move: { target: messageZone } },
    },
    ...actionPersos,
  ]
}

/** Creates the CodPlay button that reports its configured result action. */
function createEvaluationResultActionPerso(
  page: Page,
  bdc: Bdc,
  branch: EvaluationResultBranch,
  action: EvaluationResultAction,
  label: string,
  target: string,
  prefix: string,
): PersoDoc<string> {
  return {
    id: `${bdc.id}-${branch}-action`,
    type: 'tag',
    initial: { tag: 'button', content: label, attr: { type: 'button' }, move: { target } },
    emit: {
      click: {
        event: {
          name: ELCE_EVENTS.EVALUATION_RESULT_ACTION,
          data: { pageId: page.id, chapterId: page.chapterId, bdcId: bdc.id, branch, action, prefix },
          visibility: 'public',
        },
      },
    },
  }
}

/** Mounts the question's reusable illustration media into its configured card zone. */
function createQuestionMediaPerso(
  page: Page,
  bdc: Bdc,
  target: string,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
): readonly PersoDoc<string>[] {
  if (bdc.mediaId === null) return []
  const mediaType = options.mediaTypes?.[bdc.mediaId]
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return [createImagePerso(page, bdc, target, scrollPortId, resolveMediaSource(bdc, options), false, ANCHOR.DEFAULT_IMAGE_ASPECT_RATIO)]
    case MEDIA_TYPE.VIDEO:
      return [createVideoPerso(page, bdc, target, scrollPortId, resolveMediaSource(bdc, options), false)]
    default:
      throw new Error(`Le type du média d’illustration ${bdc.mediaId} est absent ou non pris en charge.`)
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

function resolveMediaSource(bdc: Bdc, options: FluxSceneBuildOptions): string {
  switch (bdc.mediaId) {
    case null:
      throw new Error(`Le bdc média ${bdc.id} ne référence aucun média.`)
    default:
      break
  }
  const source = options.mediaSources?.[bdc.mediaId]
  switch (source) {
    case undefined:
      throw new Error(`La source du média ${bdc.mediaId} est absente pour le bdc ${bdc.id}.`)
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

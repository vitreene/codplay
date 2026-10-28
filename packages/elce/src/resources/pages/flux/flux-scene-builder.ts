import { EVENT_ACTION } from '@codplay/capsule-automation'
import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { ANCHOR } from '../../anchoring/anchor-config'
import { CARD_BDC_TYPE, CARD_PRESET_ID } from '../../bdcs/card/card-config'
import { CAROUSEL_BDC_TYPE } from '../../bdcs/carousel/carousel-config'
import { QUESTION_BDC_TYPE, QUESTION_EVENTS } from '../../bdcs/question/question-config'
import { SECTION_BDC_TYPE } from '../../bdcs/section/section-config'
import { STATISTICAL_GRAPH_BDC_TYPE } from '../../bdcs/statistical-graph/statistical-graph-config'
import { FLUX_PAGE_TYPE } from './flux-config'
import { DIAPO_PAGE_TYPE } from '../diapo/diapo-config'
import { STATISTICAL_GRAPH_PRESET_ID, STATISTICAL_GRAPH_RENDERING } from '../../bdcs/statistical-graph/statistical-graph-config'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import type { ResourceBdc } from '../../document/resource-document-types'
import type { ContentPage } from '../../../core/document/content-document-types'
import type { BdcId } from '../../../core/document/content-document-types'
import type { RevelationTransitionDefaults } from '../../revelation/revelation-types'
import { projectFluxPlayerMarkup, readFluxAnchorTargets } from './flux-anchor-player-markup'
import { anchorIllustrationBlockSizeFor, anchorFlowBlockSizeFor, anchorNameFor, anchorReservationFor, statisticalGraphAnchorPaddingBottom } from '../../../domain/anchor/anchor-position'
import { ElceAnchorRatioService } from '../../anchoring/domain/anchor-ratio-service'
import type { FluxAnchorTarget } from './flux-anchor-player-markup-types'
import type { FluxSceneBuild, FluxSceneBuildOptions } from './flux-scene-builder-types'
import type { ElceResolvedPageSettings } from '../../../domain/editor-settings/editor-settings-types'
import type { CarouselSceneBuild } from '../../bdcs/carousel/reading/carousel-scene-builder-types'
import { buildQuestionBdcStory, buildQuestionCardPreset } from '../../bdcs/question/reading/question-bdc-scene-builder'
import { createPageBottomMarkerPerso } from '../page-completion/page-bottom-marker'
import type { CardBdcSceneBuild } from '../../bdcs/card/reading/card-bdc-scene-builder'
import { createRevelationAction, createRevelationInitialStyle } from '../../revelation/revelation-action'
import { ElceStatisticalGraphSceneBuilder } from '../../bdcs/statistical-graph/reading/statistical-graph-scene-builder'
import { addViewportExpansionToScene } from '../../viewport-expansion/viewport-expansion-builder'
import { appendClassToMarkupElement, sceneClassRule, sceneStyleClassName } from '../../../builders/scene-style/scene-style-classes'
import { appearanceClassNameForBdc, appearanceClassNameForPage } from '../../../builders/scene-style/appearance-class-names'

type FluxBdcMount = Readonly<{
  readonly bdc: ResourceBdc
  readonly partId: string
  readonly markup: string
  readonly anchored: boolean
  readonly zonePartIds: Readonly<Record<string, string>>
  readonly paddingBottom?: string
  readonly questionResetEvent?: string
  readonly styleSheet?: string
  readonly carouselBuild?: CarouselSceneBuild
  readonly additionalStories?: readonly StoryDoc<string>[]
  readonly cardBuild?: CardBdcSceneBuild
  readonly graphVisualPersos?: readonly PersoDoc<string>[]
}>

const anchorRatioService = new ElceAnchorRatioService()
const statisticalGraphSceneBuilder = new ElceStatisticalGraphSceneBuilder()

/** Builds an Elcé Flux scene from the métier page without creating a player circuit. */
export function buildFluxScene(
  page: ContentPage,
  bdcs: readonly ResourceBdc[],
  options: FluxSceneBuildOptions,
): FluxSceneBuild {
  switch (page.type) {
    case FLUX_PAGE_TYPE:
      return buildFluxPageScene(page, bdcs, options)
    case DIAPO_PAGE_TYPE:
      throw new Error(`Le builder Flux ne traite pas encore la page Diapo ${page.id}.`)
    default:
      throw new Error(`Le format de page ${page.type} n’est pas pris en charge par Flux.`)
  }
}

function buildFluxPageScene(page: ContentPage, bdcs: readonly ResourceBdc[], options: FluxSceneBuildOptions): FluxSceneBuild {
  const pageBdcs = page.bdcIds.map((bdcId) => bdcs.find((bdc) => bdc.id === bdcId))
  const missingBdc = pageBdcs.find((bdc) => bdc === undefined)
  switch (missingBdc) {
    case undefined:
      break
    default:
      throw new Error(`Un bdc de la page ${page.id} est introuvable.`)
  }
  const pageContents = pageBdcs.filter((bdc): bdc is ResourceBdc => bdc !== undefined)
  const anchorTargets = readAnchorTargets(pageContents, bdcs)
  const mounts = pageContents.map((bdc) => createBdcMount(page, bdc, bdcs, options))

  const scrollPortId = `${page.id}-scrollport`
  const articleId = `${page.id}-article`
  const pageAppearanceClass = appearanceClassNameForPage(page.id, options.appearanceClassNamesByTarget)
  const bottomMarkerId = `${page.id}-bottom-marker`
  const articleMarkup = `<article id="${articleId}" class="elce-flux-article ${pageAppearanceClass}">${mounts.map((mount) => mount.markup).join('')}<!-- data-part="${page.id}:bottom" --></article>`
  const pageMediaPersos = mounts.flatMap((mount) => createMediaPersos(page, mount, scrollPortId, options))
  const anchorStyleSheet = createFluxAnchorStyleSheet(page, bdcs, anchorTargets, options)
  const anchoredGraphStyleSheets: string[] = []
  const anchoredIllustrationPersos = anchorTargets.flatMap((target) => {
    const illustration = bdcs.find((candidate) => candidate.id === target.bdcId)
    const section = pageContents.find((candidate) => candidate.id === target.sectionBdcId)
    if (illustration === undefined || section?.type !== SECTION_BDC_TYPE || section.section === null) {
      throw new Error(`Le BDC illustratif ancré ${target.bdcId} ou sa Section est introuvable.`)
    }
    const anchor = { paddingBottom: target.paddingBottom, layoutId: target.layoutId }
    switch (illustration.type) {
      case CARD_BDC_TYPE: {
        const cardBuild = buildFluxCard(page, section.id, illustration, options)
        return createFluxCardPersos(
          page,
          illustration,
          cardBuild,
          target.partId,
          scrollPortId,
          options,
          getBdcRevelationSettings(options.editorSettings, illustration.id),
          anchor,
        )
      }
      case STATISTICAL_GRAPH_BDC_TYPE: {
        const appearanceClassName = appearanceClassNameForBdc(illustration.id, options.appearanceClassNamesByTarget)
        const graphBuild = statisticalGraphSceneBuilder.build(
          illustration,
          `${page.id}-${section.id}-${illustration.id}-anchor`,
          target.partId,
          appearanceClassName,
        )
        anchoredGraphStyleSheets.push(graphBuild.styleSheet)
        return createFluxGraphPersos(
          page,
          illustration,
          graphBuild.markup,
          graphBuild.mediaPersos,
          graphBuild.rootClassName,
          target.partId,
          scrollPortId,
          options.editorSettings.revelation.byBdcId[illustration.id],
          options.editorSettings.revelation.graphObservation,
        )
      }
      default:
        throw new Error(`Le BDC ${illustration.id} ne peut pas être ancré comme illustration.`)
    }
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
          move: '@root',
        },
      },
      {
        id: articleId,
        type: 'layout',
        initial: {
          move: { target: scrollPortId },
          className: `elce-flux-article ${pageAppearanceClass}`,
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
        settings: options.editorSettings.player.progression.pageCompletionObservation,
      }),
      ...pageMediaPersos,
      ...anchoredIllustrationPersos,
    ],
  }

  const stories: Readonly<Record<string, StoryDoc<string>>> = {
    [pageStory.id]: pageStory,
    ...Object.fromEntries(mounts.filter((mount) => mount.bdc.type === SECTION_BDC_TYPE).map((mount) => [
      `${page.id}-${mount.bdc.id}`,
      createSectionStory(page, mount.bdc, mount.zonePartIds.title ?? `${mount.partId}:title`),
    ])),
    ...Object.fromEntries(mounts.filter((mount) => mount.bdc.type === QUESTION_BDC_TYPE).map((mount) => [
      `${page.id}-${mount.bdc.id}`,
      buildQuestionBdcStory(page.id, mount.bdc, mount.zonePartIds),
    ])),
    ...Object.fromEntries(mounts.flatMap((mount) => mount.additionalStories === undefined
      ? []
      : mount.additionalStories.map((story) => [story.id, story] as const))),
    ...Object.fromEntries(mounts.flatMap((mount) => mount.carouselBuild === undefined
      ? []
      : [[mount.carouselBuild.story.id, mount.carouselBuild.story] as const])),
  }
  const sceneDoc = addViewportExpansionToScene(
    { id: `elce-flux-${page.id}`, stories },
    options.editorSettings.player.interactions.viewportExpansion,
  )
  const questionMount = mounts.find((mount) => mount.bdc.type === QUESTION_BDC_TYPE)
  return {
    sceneDoc,
    scrollPortId,
    bottomMarkerId,
    storyIds: Object.keys(stories),
    styleSheets: [
      ...mounts.flatMap((mount) => [
        ...(mount.styleSheet === undefined ? [] : [mount.styleSheet]),
        ...(mount.carouselBuild === undefined ? [] : [mount.carouselBuild.styleSheet]),
      ]),
      ...anchoredGraphStyleSheets,
      ...(anchorStyleSheet.length === 0 ? [] : [anchorStyleSheet]),
    ],
    ...(questionMount?.questionResetEvent === undefined ? {} : { questionReset: { eventName: questionMount.questionResetEvent } }),
  }
}

/** Generates class rules for per-anchor geometry in the page's existing stylesheet channel. */
function createFluxAnchorStyleSheet(
  page: ContentPage,
  bdcs: readonly ResourceBdc[],
  targets: readonly FluxAnchorTarget[],
  options: FluxSceneBuildOptions,
): string {
  const rules = targets.flatMap((target) => {
    const slotClassName = sceneStyleClassName('flow-slot', target.partId)
    const slotRule = sceneClassRule(slotClassName, {
      [ANCHOR.PADDING_VARIABLE]: target.paddingBottom,
      paddingBottom: anchorReservationFor(target.paddingBottom),
      anchorName: anchorNameFor(target.partId),
    })
    const bdc = bdcs.find((candidate) => candidate.id === target.bdcId)
    if (bdc === undefined) throw new Error(`Le BDC ancré ${target.bdcId} est introuvable.`)

    if (bdc.type === CARD_BDC_TYPE) {
      const mediaId = bdc.card?.mediaId
      const mediaType = mediaId == null ? undefined : options.mediaTypes?.[mediaId]
      const aspectRatio = mediaType === MEDIA_TYPE.VIDEO
        ? '16 / 9'
        : anchorRatioService.imageAspectRatio(target.paddingBottom)
      const declarations = {
        position: 'absolute',
        zIndex: '1',
        positionAnchor: anchorNameFor(target.partId),
        insetInlineStart: '0',
        insetInlineEnd: '0',
        insetBlockStart: `calc(anchor(top) + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`,
        width: '100%',
        ...(target.layoutId === CARD_PRESET_ID.PHOTO
          ? { aspectRatio, height: 'auto' }
          : { height: anchorIllustrationBlockSizeFor(target.layoutId, target.paddingBottom) }),
      }
      const cardId = `${page.id}-${bdc.id}-card`
      return [slotRule, sceneClassRule(sceneStyleClassName('flux-anchor-illustration', cardId), declarations)]
    }

    if (bdc.type === STATISTICAL_GRAPH_BDC_TYPE && bdc.statisticalGraph != null) {
      const graphId = `${page.id}-${bdc.id}-graph`
      const declarations = {
        position: 'absolute',
        zIndex: '1',
        positionAnchor: anchorNameFor(target.partId),
        insetInlineStart: '0',
        insetInlineEnd: '0',
        insetBlockStart: `calc(anchor(top) + ${ANCHOR.DEFAULT_BDC_MARGIN_TOP})`,
        width: '100%',
        height: 'auto',
        ...(bdc.statisticalGraph.rendering === STATISTICAL_GRAPH_RENDERING.TABLE ? {} : { aspectRatio: '16 / 9' }),
      }
      return [slotRule, sceneClassRule(sceneStyleClassName('flux-anchor-illustration', graphId), declarations)]
    }

    throw new Error(`Le BDC ${bdc.id} ne peut pas être ancré en Flux.`)
  })
  return rules.join('\n')
}

function createBdcMount(
  page: ContentPage,
  bdc: ResourceBdc,
  allBdcs: readonly ResourceBdc[],
  options: FluxSceneBuildOptions,
): FluxBdcMount {
  const additionalBuild = options.buildAdditionalBdc?.(page, bdc)
  if (additionalBuild !== null && additionalBuild !== undefined) {
    return {
      bdc,
      partId: additionalBuild.mountPartId,
      anchored: false,
      markup: additionalBuild.mountMarkup,
      zonePartIds: {},
      additionalStories: additionalBuild.stories,
    }
  }
  switch (bdc.type) {
    case SECTION_BDC_TYPE: {
      const partId = `${page.id}:${bdc.id}:section`
      const sectionId = `${page.id}-${bdc.id}`
      const card = options.presetBuilder.build(
        bdc.presetId,
        sectionId,
        partId,
        {
          body: projectFluxPlayerMarkup(bdc.section?.markup ?? ''),
        },
      )
      const markup = appendClassToMarkupElement(
        card.markup,
        sectionId,
        appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
      )
      return {
        bdc,
        partId,
        anchored: false,
        markup,
        zonePartIds: card.zonePartIds,
      }
    }
    case CARD_BDC_TYPE: {
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
    case QUESTION_BDC_TYPE: {
      const question = bdc.question
      if (question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
      const partId = `${page.id}:${bdc.id}:question`
      const card = buildQuestionCardPreset(
        `${page.id}-${bdc.id}`,
        partId,
        question,
        options.presetBuilder,
        appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
      )
      const resetEvent = QUESTION_EVENTS.RESET
      return {
        bdc,
        partId,
        anchored: false,
        markup: card.markup,
        zonePartIds: card.zonePartIds,
        questionResetEvent: resetEvent,
      }
    }
    case CAROUSEL_BDC_TYPE: {
      const content = bdc.carousel
      switch (content) {
        case null:
        case undefined:
          throw new Error(`Le BDC Carousel ${bdc.id} n’a pas de contenu.`)
        default: {
          const carouselBuild = options.carouselSceneBuilder.build({
            pageId: page.id,
            bdcId: bdc.id,
            content,
            cards: allBdcs,
            mediaSources: options.mediaSources ?? {},
            mediaTypes: options.mediaTypes ?? {},
            revelationSettings: getCarouselRevelationSettings(options.editorSettings, bdc.id),
            playerSettings: options.editorSettings.player,
            appearanceClassNamesByTarget: options.appearanceClassNamesByTarget,
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
    case STATISTICAL_GRAPH_BDC_TYPE: {
      const graphPartId = `${page.id}:${bdc.id}:statistical-graph`
      const graphBuild = statisticalGraphSceneBuilder.build(
        bdc,
        `${page.id}-${bdc.id}-graph`,
        graphPartId,
        appearanceClassNameForBdc(bdc.id, options.appearanceClassNamesByTarget),
      )
      return {
        bdc,
        partId: graphPartId,
        anchored: false,
        markup: graphBuild.markup,
        zonePartIds: {},
        graphVisualPersos: graphBuild.mediaPersos,
        styleSheet: graphBuild.styleSheet,
      }
    }
    case CARD_BDC_TYPE:
      throw new Error(`Le BDC Carte ${bdc.id} doit être projeté par son BDC conteneur.`)
    default:
      throw new Error(`Le BDC ${bdc.id} (${bdc.type}) n’est pas pris en charge dans Flux.`)
  }
}

/** Reads the CodPlay targets exported by anchors inside the page's Sections. */
function readAnchorTargets(bdcs: readonly ResourceBdc[], allBdcs: readonly ResourceBdc[]): readonly FluxAnchorTarget[] {
  return bdcs.flatMap((bdc) => {
    switch (bdc.type) {
      case SECTION_BDC_TYPE:
        return readFluxAnchorTargets(bdc.section?.markup ?? '').map((target) => {
          const illustration = allBdcs.find((candidate) => candidate.id === target.bdcId)
          if (illustration === undefined
            || (illustration.type !== CARD_BDC_TYPE && illustration.type !== STATISTICAL_GRAPH_BDC_TYPE)) {
            throw new Error(`Le BDC illustratif de l’ancre ${target.bdcId} est introuvable.`)
          }
          const paddingBottom = illustration.type === STATISTICAL_GRAPH_BDC_TYPE && illustration.statisticalGraph != null
            ? statisticalGraphAnchorPaddingBottom(illustration.statisticalGraph.rendering)
            : target.paddingBottom
          return { ...target, paddingBottom, layoutId: illustration.presetId, sectionBdcId: bdc.id }
        })
      case QUESTION_BDC_TYPE:
      case CAROUSEL_BDC_TYPE:
      case CARD_BDC_TYPE:
        return []
      case STATISTICAL_GRAPH_BDC_TYPE:
        return []
      default:
        return []
    }
  })
}

function createMediaPersos(
  page: ContentPage,
  mount: FluxBdcMount,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
): readonly PersoDoc<string>[] {
  if (mount.additionalStories !== undefined) return []
  switch (mount.bdc.type) {
    case SECTION_BDC_TYPE:
      return []
    case CARD_BDC_TYPE:
      return mount.cardBuild === undefined
        ? []
        : createFluxCardPersos(
          page,
          mount.bdc,
          mount.cardBuild,
          mount.partId,
          scrollPortId,
          options,
          getBdcRevelationSettings(options.editorSettings, mount.bdc.id),
        )
    case QUESTION_BDC_TYPE:
      return createQuestionMediaPerso(page, mount.bdc, mount.zonePartIds.illustration ?? '', scrollPortId, options)
    case CAROUSEL_BDC_TYPE:
      return []
    case STATISTICAL_GRAPH_BDC_TYPE:
      return mount.graphVisualPersos ?? []
    default:
      return []
  }
}

/** Builds a Card and its media/text persos in the Flux page's authored layout. */
function buildFluxCard(page: ContentPage, containerBdcId: BdcId, bdc: ResourceBdc, options: FluxSceneBuildOptions): CardBdcSceneBuild {
  return options.cardBdcSceneBuilder.build({
    pageId: page.id,
    containerBdcId,
    bdc,
    mediaSources: options.mediaSources ?? {},
    mediaTypes: options.mediaTypes ?? {},
    appearanceClassNamesByTarget: options.appearanceClassNamesByTarget,
  })
}

/** Projects one unique Card BDC at its page or text-anchor placement. */
function createFluxCardPersos(
  page: ContentPage,
  bdc: ResourceBdc,
  cardBuild: CardBdcSceneBuild,
  targetPartId: string,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
  revelation: RevelationTransitionDefaults,
  anchor?: Readonly<{ paddingBottom: string; layoutId: string }>,
): readonly PersoDoc<string>[] {
  const introRef = revelation.intro
  const outroRef = revelation.outro
  const cardId = `${page.id}-${bdc.id}-card`
  const enterEvent = `${cardId}:enter`
  const leaveEvent = `${cardId}:leave`
  const hasMedia = cardBuild.mediaPersos.length > 0
  const root: PersoDoc<string> = {
    id: cardId,
    type: 'layout',
    initial: {
      move: { target: targetPartId },
      className: `${cardBuild.rootClassName} elce-flux-card-root${anchor === undefined ? '' : ` ${sceneStyleClassName('flux-anchor-illustration', cardId)}`}`,
      ...(hasMedia ? {} : { style: createRevelationInitialStyle(introRef) }),
      markup: cardBuild.markup,
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: options.editorSettings.revelation.cardObservationZone,
        enter: [{ name: enterEvent }],
        leave: [{ name: leaveEvent }],
      },
    },
    ...(hasMedia ? {} : { actions: {
      [enterEvent]: createRevelationAction(introRef, EVENT_ACTION.intro),
      [leaveEvent]: createRevelationAction(outroRef, EVENT_ACTION.outro),
    } }),
  }
  const mediaPersos = hasMedia
    ? cardBuild.mediaPersos.map((perso) => revealFluxCardMedia(perso, enterEvent, leaveEvent, introRef, outroRef))
    : cardBuild.mediaPersos
  return [root, ...cardBuild.contentPersos, ...mediaPersos]
}

/** Applies a Flux Card's visibility transitions to its media, keeping the observed root still. */
function revealFluxCardMedia(
  perso: PersoDoc<string>,
  enterEvent: string,
  leaveEvent: string,
  introRef: RevelationTransitionDefaults['intro'],
  outroRef: RevelationTransitionDefaults['outro'],
): PersoDoc<string> {
  if (perso.initial === undefined) throw new Error(`Le média ${perso.id} de la Carte Flux ne possède pas d’état initial.`)
  return {
    ...perso,
    initial: { ...perso.initial, style: createRevelationInitialStyle(introRef) },
    actions: {
      ...perso.actions,
      [enterEvent]: createRevelationAction(introRef, EVENT_ACTION.intro),
      [leaveEvent]: createRevelationAction(outroRef, EVENT_ACTION.outro),
    },
  }
}

/** Projects an anchored Statistical Graph into its existing Section anchor target. */
function createFluxGraphPersos(
  page: ContentPage,
  bdc: ResourceBdc,
  markup: string,
  visualPersos: readonly PersoDoc<string>[],
  rootClassName: string,
  targetPartId: string,
  scrollPortId: string,
  revelation: RevelationTransitionDefaults | undefined,
  observation: ElceResolvedPageSettings['revelation']['graphObservation'],
): readonly PersoDoc<string>[] {
  if (bdc.type !== STATISTICAL_GRAPH_BDC_TYPE || bdc.statisticalGraph == null) {
    throw new Error(`Le bdc ${bdc.id} n’est pas un Graphe complet.`)
  }
  if (revelation === undefined) throw new Error(`Les réglages de révélation du Graphe ${bdc.id} sont absents.`)
  const introRef = revelation.intro
  const outroRef = revelation.outro
  const graphId = `${page.id}-${bdc.id}-graph`
  const layoutClass = bdc.presetId === STATISTICAL_GRAPH_PRESET_ID.SIDE_BY_SIDE
    ? 'elce-statistical-graph--side-by-side'
    : 'elce-statistical-graph--above-text'
  const renderingClass = `elce-statistical-graph--${bdc.statisticalGraph.rendering}`
  const enterEvent = `${graphId}:enter`
  const leaveEvent = `${graphId}:leave`
  const root: PersoDoc<string> = {
    id: graphId,
    type: 'layout',
    initial: {
      move: { target: targetPartId },
      className: `${rootClassName} ${layoutClass} ${renderingClass} elce-flux-graph-root ${sceneStyleClassName('flux-anchor-illustration', graphId)}`,
      style: createRevelationInitialStyle(introRef),
      markup,
    },
    emit: {
      observe: {
        root: scrollPortId,
        initial: observation.initial,
        zone: observation.zone,
        enter: [{ name: enterEvent }],
        leave: [{ name: leaveEvent }],
      },
    },
    actions: {
      [enterEvent]: createRevelationAction(introRef, EVENT_ACTION.intro),
      [leaveEvent]: createRevelationAction(outroRef, EVENT_ACTION.outro),
    },
  }
  return [root, ...visualPersos]
}

/** Mounts the question's reusable illustration media into its configured card zone. */
function createQuestionMediaPerso(
  page: ContentPage,
  bdc: ResourceBdc,
  target: string,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
): readonly PersoDoc<string>[] {
  const mediaId = bdc.question?.mediaId
  if (mediaId == null) return []
  const mediaType = options.mediaTypes?.[mediaId]
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return [createImagePerso(
        page,
        bdc,
        target,
        scrollPortId,
        resolveMediaSource(bdc.id, mediaId, options),
        options.editorSettings.revelation.imageEntrance,
      )]
    case MEDIA_TYPE.VIDEO:
      return [createVideoPerso(
        page,
        bdc,
        target,
        scrollPortId,
        resolveMediaSource(bdc.id, mediaId, options),
        options.editorSettings.player.media.fluxVideoVisibilityZone,
      )]
    default:
      throw new Error(`Le type du média d’illustration ${mediaId} est absent ou non pris en charge.`)
  }
}

function createSectionStory(page: ContentPage, bdc: ResourceBdc, articlePartId: string): StoryDoc<string> {
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
  page: ContentPage,
  bdc: ResourceBdc,
  articlePartId: string,
  scrollPortId: string,
  source: string,
  entrance: ElceResolvedPageSettings['revelation']['imageEntrance'],
): PersoDoc<string> {
  const imageId = `${page.id}-${bdc.id}-image`
  const enterEvent = `${imageId}:enter`
  return {
    id: imageId,
    type: 'img',
    initial: {
      src: source,
      className: 'elce-flux-image',
      style: { translateX: entrance.restingTranslateX },
      img: { className: 'elce-flux-image__native' },
      move: { target: articlePartId },
    },
    emit: {
      observe: {
        root: scrollPortId,
        initial: entrance.initial,
        zone: entrance.zone,
        enter: [{ name: enterEvent, once: entrance.once }],
      },
    },
    actions: {
      [enterEvent]: {
        style: {
          translateX: {
            from: entrance.fromTranslateX,
            to: entrance.toTranslateX,
            duration: entrance.duration,
            ease: entrance.ease,
          },
        },
      },
    },
  }
}

function createVideoPerso(
  page: ContentPage,
  bdc: ResourceBdc,
  articlePartId: string,
  scrollPortId: string,
  source: string,
  visibilityZone: ElceResolvedPageSettings['player']['media']['fluxVideoVisibilityZone'],
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
      sync: 'independent',
      className: 'elce-flux-video',
      move: { target: articlePartId },
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: visibilityZone,
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

/** Returns pre-resolved revelation settings for a BDC without applying inheritance. */
function getBdcRevelationSettings(
  editorSettings: ElceResolvedPageSettings,
  bdcId: BdcId,
): RevelationTransitionDefaults {
  const settings = editorSettings.revelation.byBdcId[bdcId]
  if (settings === undefined) throw new Error(`Les réglages de révélation du BDC ${bdcId} sont absents.`)
  return settings
}

/** Returns pre-resolved Carousel revelation settings without applying fallbacks. */
function getCarouselRevelationSettings(
  editorSettings: ElceResolvedPageSettings,
  bdcId: BdcId,
): NonNullable<ElceResolvedPageSettings['revelation']['carouselsByBdcId'][BdcId]> {
  const settings = editorSettings.revelation.carouselsByBdcId[bdcId]
  if (settings === undefined) throw new Error(`Les réglages de révélation du Carousel ${bdcId} sont absents.`)
  return settings
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


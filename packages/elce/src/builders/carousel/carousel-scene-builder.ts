import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from '@codplay/capsule-automation'
import { CapsuleDistribution } from '@codplay/scene-factory/capsule-distribution'
import { CapsulePreset } from '@codplay/scene-factory/capsule-preset'
import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { TRACK_EVENT_DEACTIVATE, type StrapFunction } from 'codplay/runtime/player'
import { BDC_TYPE, CAROUSEL_CONFIG, CAROUSEL_IMAGE_POSITION, CAROUSEL_PLAYBACK_MODE, DEFAULT_PRESET_ID, DEFAULT_PROJECT_REVELATION } from '../../config/document-config'
import type { CarouselContent, CarouselBdcEntry } from '../../domain/carousel/carousel-types'
import type { Bdc } from '../../domain/document/document-types'
import { ElceCardPresetBuilder } from '../card/card-preset-builder'
import { ElceCardBdcSceneBuilder } from '../card/card-bdc-scene-builder'
import { ElceStatisticalGraphSceneBuilder } from '../statistical-graph/statistical-graph-scene-builder'
import { createPageBottomMarkerPerso } from '../flux/page-bottom-marker'
import { createResolvedRevelationAction } from '../revelation/revelation-action'
import type { CarouselSceneBuild, CarouselSceneBuildInput } from './carousel-scene-builder-types'
import {
  addViewportExpansionToStory,
  carouselViewCollapsedEvent,
  carouselViewExpandedEvent,
  carouselViewportCurrentEvent,
  isViewportExpansionPerso,
  type ViewportExpansionCarouselView,
} from '../viewport-expansion/viewport-expansion-builder.ts'

const cardPresetBuilder = new ElceCardPresetBuilder()
const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder()
const statisticalGraphSceneBuilder = new ElceStatisticalGraphSceneBuilder()

type CarouselViewBuild = Readonly<{
  readonly markup: string
  readonly rootClassName: string
  readonly contentPersos: readonly PersoDoc<string>[]
  readonly mediaPersos: readonly PersoDoc<string>[]
}>

type ScheduledView = Readonly<{
  readonly entry: CarouselBdcEntry
  readonly bdc: Bdc
  readonly startMs: number
  readonly endMs: number
}>

/** Builds a Carousel scene whose ordered children use the existing Capsule sequence. */
export class ElceCarouselSceneBuilder {
  /** Projects Carousel settings and illustrative BDCs into a CodPlay story. */
  public build(input: CarouselSceneBuildInput): CarouselSceneBuild {
    const { pageId, bdcId, content } = input
    const displayMode = input.displayMode ?? 'content'
    const prefix = `${pageId}:${bdcId}`
    const rootId = `${pageId}-${bdcId}`
    const capsulePartId = `${prefix}:carousel:capsule`
    const navigationPartId = `${prefix}:carousel:navigation`
    const diapoRootId = displayMode === 'scene' ? input.completionEventRootId ?? rootId : undefined
    const schedule = resolveCardSchedule(input)
    const projectRevelation = input.revelationDefaults ?? DEFAULT_PROJECT_REVELATION
    const parentIntroRef = content.revelation.intro ?? projectRevelation.intro
    const parentOutroRef = content.revelation.outro ?? projectRevelation.outro
    const capsule = new AutoCapsule({
      capsule: {
        id: `${rootId}-capsule`,
        type: CAPSULE_TYPE.carousel,
        className: displayMode === 'scene' ? 'elce-carousel-capsule elce-carousel-capsule--scene' : 'elce-carousel-capsule',
        grid: { className: 'elce-carousel-capsule__grid' },
        style: displayMode === 'scene'
          ? { height: '100%' }
          : { aspectRatio: `${content.aspectRatio.width} / ${content.aspectRatio.height}` },
        defaults: {
          introTransitionRef: parentIntroRef,
          outroTransitionRef: parentOutroRef,
          generateDefaultOutro: true,
        },
      },
      children: schedule.map((entry, index) => ({
        id: entry.bdc.id,
        order: index,
        timeRange: { startMs: entry.startMs, endMs: entry.endMs },
        className: 'elce-carousel-view',
        events: {
          intro: {
            name: `${prefix}:card:${entry.bdc.id}:intro`,
            action: EVENT_ACTION.intro,
            ref: entry.entry.introTransitionRef ?? parentIntroRef,
          },
          outro: {
            name: `${prefix}:card:${entry.bdc.id}:outro`,
            action: EVENT_ACTION.outro,
            ref: entry.entry.outroTransitionRef ?? parentOutroRef,
          },
        },
      })),
    })
    const capsuleResult = capsule.resolve()
    const firstCardBdcId = content.cards[0]?.bdcId ?? null
    const viewBuilds = new Map(schedule.map((entry) => [entry.bdc.id, buildView(input, entry.bdc, displayMode === 'scene')]))
    const lastCardBdcId = capsuleResult.children.at(-1)?.id
    const cardMountTarget = diapoRootId ?? capsulePartId
    const mediaPersos = [...viewBuilds.values()].flatMap((build) => build.mediaPersos)
    const expandableViews: readonly ViewportExpansionCarouselView[] = schedule.flatMap((entry) => {
      const viewBuild = viewBuilds.get(entry.bdc.id)
      return viewBuild?.mediaPersos
        .filter(isViewportExpansionPerso)
        .map((perso) => ({ bdcId: entry.bdc.id, persoId: perso.id })) ?? []
    })
    const cardPersos = capsuleResult.children.flatMap((child) => {
      const entry = schedule.find((candidate) => candidate.bdc.id === child.id)
      const viewBuild = viewBuilds.get(child.id)
      if (entry === undefined || viewBuild === undefined) throw new Error(`La vue Carousel ${child.id} est introuvable.`)
      return [
        ...createCarouselCardPersos(prefix, cardMountTarget, child, entry.bdc, viewBuild, firstCardBdcId, displayMode === 'scene'),
        ...(diapoRootId !== undefined && child.id === lastCardBdcId
          ? [createCarouselCompletionMarker(input.pageId, input.bdcId, child.id, diapoRootId)]
          : []),
      ]
    })
    const selectionEvent = `${prefix}:select-card`
    const storyId = input.storyId ?? `${pageId}-${bdcId}`
    const navigationPersos = content.cards.map((entry, index) => {
      const child = capsuleResult.children.find((candidate) => candidate.id === entry.bdcId)
      const bdc = input.cards.find((candidate) => candidate.id === entry.bdcId)
      if (child === undefined || bdc === undefined) throw new Error(`La vue Carousel ${entry.bdcId} n’a pas de placement résolu.`)
      return createCarouselNavigationPerso(prefix, navigationPartId, child, bdc, index, firstCardBdcId, selectionEvent)
    })
    const card = displayMode === 'scene'
      ? undefined
      : cardPresetBuilder.build(
        DEFAULT_PRESET_ID.CAROUSEL,
        rootId,
        `${pageId}:${bdcId}:carousel`,
        {
          frame: createCapsuleMarkup(rootId, capsulePartId, capsuleResult, parentIntroRef, parentOutroRef),
          navigation: '',
        },
      )
    const story: StoryDoc<string> = {
      id: storyId,
      state: { activeCardBdcId: firstCardBdcId, manualCarouselSelection: false },
      persos: [
        ...(diapoRootId === undefined ? [] : [createDiapoCarouselRoot(
          diapoRootId,
          capsuleResult.capsule.className,
          capsuleResult.capsule.inlineStyle,
          parentIntroRef,
          parentOutroRef,
        )]),
        ...(diapoRootId === undefined ? [] : [createDiapoNavigationHost(diapoRootId, rootId, navigationPartId)]),
        ...cardPersos,
        ...mediaPersos,
        ...navigationPersos,
      ],
      eventimes: content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
        ? createAutomaticEventimes(content, capsuleResult.children, schedule[schedule.length - 1]?.endMs ?? 0)
        : [],
      straps: { [selectionEvent]: createSelectionStrap(prefix, content, storyId, expandableViews) },
      listen: [{ on: selectionEvent, straps: [selectionEvent] }],
    }
    const expandedStory = addViewportExpansionToStory(story, {
      selectionEvent,
      views: expandableViews,
      automatic: content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
      trackId: storyId,
    })
    return {
      markup: card?.markup ?? '',
      story: expandedStory,
      styleSheet: capsuleResult.styleSheet,
    }
  }
}

/** Resolves Carousel entry durations into the ranges consumed by CapsuleDistribution. */
function resolveCardSchedule(input: CarouselSceneBuildInput): readonly ScheduledView[] {
  const cardById = new Map(input.cards.map((bdc) => [bdc.id, bdc]))
  let endMs = 0
  const authoredBounds = input.content.cards.map((entry) => {
    const bdc = cardById.get(entry.bdcId)
    if (bdc === undefined || (bdc.type !== 'card' && bdc.type !== 'statistical-graph')) {
      throw new Error(`Le BDC ${entry.bdcId} du Carousel est introuvable ou non illustratif.`)
    }
    const durationMs = entry.durationMs ?? input.content.defaultViewDurationMs
    const startMs = endMs
    endMs += durationMs
    return { entry, bdc, startMs, endMs }
  })
  const distribution = CapsuleDistribution.compute({
    clipDurationMs: endMs,
    mode: CapsulePreset.resolve({ capsuleType: CAPSULE_TYPE.carousel }).mode,
    children: authoredBounds.map(({ entry, startMs, endMs: cardEndMs }) => ({
      trackId: entry.bdcId,
      lockedIntroMs: startMs,
      lockedOutroMs: cardEndMs,
    })),
  })
  const distributedById = new Map(distribution.children.map((child) => [child.trackId, child]))
  return authoredBounds.map(({ entry, bdc }) => {
    const range = distributedById.get(entry.bdcId)
    if (range === undefined) throw new Error(`CapsuleDistribution n’a pas résolu la carte ${entry.bdcId}.`)
    return { entry, bdc, startMs: range.introMs, endMs: range.outroMs }
  })
}

/** Builds one supported illustration view using its existing BDC scene builder. */
function buildView(input: CarouselSceneBuildInput, bdc: Bdc, photoMediaRoot: boolean): CarouselViewBuild {
  switch (bdc.type) {
    case BDC_TYPE.CARD:
      return cardBdcSceneBuilder.build({
        pageId: input.pageId,
        containerBdcId: input.bdcId,
        bdc,
        mediaSources: input.mediaSources,
        mediaTypes: input.mediaTypes,
        photoMediaRoot,
      })
    case BDC_TYPE.STATISTICAL_GRAPH:
      return statisticalGraphSceneBuilder.build(
        bdc,
        `${input.pageId}-${input.bdcId}-graph-${bdc.id}`,
        `${input.pageId}:${input.bdcId}:card:${bdc.id}`,
      )
    default:
      throw new Error(`Le BDC ${bdc.id} n’est pas une illustration prise en charge par Carousel.`)
  }
}

/** Observes the final visible Diapo Carousel Card through the shared Page event. */
function createCarouselCompletionMarker(
  pageId: string,
  carouselBdcId: string,
  cardBdcId: string,
  rootId: string,
): PersoDoc<string> {
  return createPageBottomMarkerPerso({
    pageId,
    markerId: `${pageId}:${carouselBdcId}-completion-marker`,
    rootId,
    targetPartId: `${pageId}:${carouselBdcId}:card:${cardBdcId}:root`,
    className: 'elce-page-bottom-marker elce-carousel-completion-marker',
    style: { position: 'absolute', insetInlineEnd: 0, insetBlockEnd: 0, width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' },
  })
}

/** Combines the Diapo Carousel root, capsule grid and completion scrollport. */
function createDiapoCarouselRoot(
  rootId: string,
  capsuleClassName: string,
  capsuleStyle: Readonly<Record<string, string | number>>,
  introTransitionRef: string,
  outroTransitionRef: string,
): PersoDoc<string> {
  return {
    id: rootId,
    type: 'scroll-container',
    initial: {
      tag: 'section',
      attr: {
        id: rootId,
        'aria-label': 'Contenu du Carousel',
        'data-intro-transition': introTransitionRef,
        'data-outro-transition': outroTransitionRef,
      },
      className: [
        'elce-card--carousel',
        'elce-diapo-content',
        'elce-diapo-carousel-root',
        ...capsuleClassName.split(/\s+/),
      ].join(' '),
      style: {
        ...capsuleStyle,
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: 'minmax(0, 1fr) auto',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        containerType: 'inline-size',
      },
      move: '@root',
    },
  }
}

/** Creates the Diapo navigation region as a direct grid row of the Carousel root. */
function createDiapoNavigationHost(containerRootId: string, navigationId: string, navigationPartId: string): PersoDoc<string> {
  return {
    id: `${navigationId}-navigation-host`,
    type: 'layout',
    initial: {
      move: { target: containerRootId },
      className: 'elce-carousel__navigation',
      style: { gridRow: '2', gridColumn: '1' },
      markup: `<nav id="${navigationId}-navigation" aria-label="Vues du carousel"><!-- data-part="${navigationPartId}" --></nav>`,
    },
  }
}

/** Expands Capsule Automation's finite Card schedule into the configured repeat count. */
function createAutomaticEventimes(
  content: CarouselContent,
  children: ReturnType<AutoCapsule['resolve']>['children'],
  cycleDurationMs: number,
): NonNullable<StoryDoc<string>['eventimes']> {
  const repeatCount = content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount
  return Array.from({ length: repeatCount + 1 }, (_, repetitionIndex) =>
    children.flatMap((child, cardIndex) => Object.values(child.events)
      .filter((event) => repetitionIndex < repeatCount
        || cardIndex < children.length - 1
        || event.action !== EVENT_ACTION.outro)
      .filter((event) => repetitionIndex !== 0 || cardIndex !== 0 || event.action !== EVENT_ACTION.intro)
      .map((event) => ({
        name: event.name,
        startAt: event.triggerMs + cycleDurationMs * repetitionIndex,
      })))
  ).flat()
}

/** Creates the fixed AutoCapsule host and its resolved inline layout. */
function createCapsuleMarkup(
  rootId: string,
  capsulePartId: string,
  result: ReturnType<AutoCapsule['resolve']>,
  introTransitionRef: string,
  outroTransitionRef: string,
): string {
  const style = serializeStyle(result.capsule.inlineStyle)
  return `<div id="${rootId}-capsule" class="${result.capsule.className}" data-intro-transition="${introTransitionRef}" data-outro-transition="${outroTransitionRef}"${style}><!-- data-part="${capsulePartId}" --></div>`
}

/** Serializes builder-owned inline style values for static scene markup. */
function serializeStyle(value: unknown): string {
  if (value === null || typeof value !== 'object') return ''
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, propertyValue]) => typeof propertyValue === 'string' || typeof propertyValue === 'number')
    .map(([property, propertyValue]) => `${toKebabCase(property)}:${String(propertyValue)}`)
  return entries.length === 0 ? '' : ` style="${entries.join(';')}"`
}

/** Converts one authored JavaScript style property to its CSS property spelling. */
function toKebabCase(property: string): string {
  return property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

/** Creates a Card layout root with its Capsule transition actions. */
function createCarouselCardPersos(
  prefix: string,
  capsulePartId: string,
  child: ReturnType<AutoCapsule['resolve']>['children'][number],
  bdc: Bdc,
  cardBuild: CarouselViewBuild,
  firstCardBdcId: string | null,
  photoMediaRoot: boolean,
): readonly PersoDoc<string>[] {
  const selectedEvent = `${prefix}:card:${bdc.id}:selected`
  const unselectedEvent = `${prefix}:card:${bdc.id}:unselected`
  const introEvent = child.events.intro
  const outroEvent = child.events.outro
  const actions: Record<string, unknown> = {
    [selectedEvent]: {
      className: { add: 'elce-carousel-view--visible', remove: 'elce-carousel-view--hidden' },
      attr: { 'aria-hidden': 'false', inert: false },
          ...(introEvent === undefined ? {} : createResolvedRevelationAction(introEvent)),
    },
    [unselectedEvent]: {
      className: { add: 'elce-carousel-view--hidden', remove: 'elce-carousel-view--visible' },
      attr: { 'aria-hidden': 'true', inert: true },
          ...(outroEvent === undefined ? {} : createResolvedRevelationAction(outroEvent)),
    },
  }
  for (const event of Object.values(child.events)) {
    switch (event.action) {
      case EVENT_ACTION.intro:
        actions[event.name] = {
          className: { add: 'elce-carousel-view--visible', remove: 'elce-carousel-view--hidden' },
          attr: { 'aria-hidden': 'false', inert: false },
          ...createResolvedRevelationAction(event),
        }
        break
      case EVENT_ACTION.outro:
        actions[event.name] = {
          className: { add: 'elce-carousel-view--hidden', remove: 'elce-carousel-view--visible' },
          attr: { 'aria-hidden': 'true', inert: true },
          ...createResolvedRevelationAction(event),
        }
        break
      default:
        throw new Error(`Action de transition Carousel non prise en charge : ${event.action}`)
    }
  }
  const imagePosition = bdc.card?.imagePosition
  const className = [
    child.className,
    cardBuild.rootClassName,
    photoMediaRoot && bdc.presetId === DEFAULT_PRESET_ID.PHOTO ? 'elce-carousel-photo__media' : null,
    firstCardBdcId === bdc.id ? 'elce-carousel-view--visible' : 'elce-carousel-view--hidden',
    bdc.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE
      ? imagePosition === CAROUSEL_IMAGE_POSITION.RIGHT
        ? 'elce-carousel-view--image-right'
        : 'elce-carousel-view--image-left'
      : null,
  ].filter(Boolean).join(' ')
  const cardRoot: PersoDoc<string> = {
    id: `${prefix}-card-${bdc.id}`,
    type: 'layout',
    initial: {
      move: { target: capsulePartId },
      className,
      attr: { 'aria-hidden': firstCardBdcId !== bdc.id, inert: firstCardBdcId !== bdc.id },
      style: {
        ...child.inlineStyle,
        opacity: firstCardBdcId === bdc.id ? 1 : 0,
        x: 0,
        y: 0,
        scale: 1,
      },
      markup: cardBuild.markup,
    },
    actions,
  }
  return [cardRoot, ...cardBuild.contentPersos]
}

/** Creates the CodPlay button that selects one Card BDC in either playback mode. */
function createCarouselNavigationPerso(
  prefix: string,
  navigationPartId: string,
  child: ReturnType<AutoCapsule['resolve']>['children'][number],
  bdc: Bdc,
  index: number,
  firstCardBdcId: string | null,
  selectionEvent: string,
): PersoDoc<string> {
  const selectedEvent = `${prefix}:card:${bdc.id}:selected`
  const unselectedEvent = `${prefix}:card:${bdc.id}:unselected`
  const isFirstCard = firstCardBdcId === bdc.id
  const selectedAttributes = { type: 'button', 'aria-label': `Aller à la vue ${index + 1}`, 'aria-current': 'true' }
  const unselectedAttributes = { type: 'button', 'aria-label': `Aller à la vue ${index + 1}`, 'aria-current': 'false' }
  const actions: Record<string, unknown> = {
    [selectedEvent]: { className: { add: 'elce-carousel-dot--active', remove: 'elce-carousel-dot--inactive' }, attr: selectedAttributes },
    [unselectedEvent]: { className: { add: 'elce-carousel-dot--inactive', remove: 'elce-carousel-dot--active' }, attr: unselectedAttributes },
  }
  for (const event of Object.values(child.events)) {
    switch (event.action) {
      case EVENT_ACTION.intro:
        actions[event.name] = { className: { add: 'elce-carousel-dot--active', remove: 'elce-carousel-dot--inactive' }, attr: selectedAttributes }
        break
      case EVENT_ACTION.outro:
        actions[event.name] = { className: { add: 'elce-carousel-dot--inactive', remove: 'elce-carousel-dot--active' }, attr: unselectedAttributes }
        break
      default:
        throw new Error(`Action de navigation Carousel non prise en charge : ${event.action}`)
    }
  }
  return {
    id: `${prefix}-dot-${bdc.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: '•',
      className: isFirstCard ? 'elce-carousel-dot elce-carousel-dot--active' : 'elce-carousel-dot elce-carousel-dot--inactive',
      attr: isFirstCard ? selectedAttributes : unselectedAttributes,
      move: { target: navigationPartId },
    },
    emit: { click: { event: { name: selectionEvent, data: { cardBdcId: bdc.id }, visibility: 'story' } } },
    actions,
  }
}

/** Builds the strap that selects a Card and interrupts scheduled playback after a manual choice. */
function createSelectionStrap(
  prefix: string,
  content: CarouselContent,
  storyId: string,
  expandableViews: readonly ViewportExpansionCarouselView[],
): StrapFunction {
  return ({ event, state }) => {
    let selectedBdcId = typeof event.data?.cardBdcId === 'string' ? event.data.cardBdcId : undefined
    const direction = event.data?.direction
    if (selectedBdcId === undefined && (direction === 'previous' || direction === 'next')) {
      const activeBdcId = typeof state.activeCardBdcId === 'string' ? state.activeCardBdcId : undefined
      const currentViewIndex = expandableViews.findIndex((view) => view.bdcId === activeBdcId)
      const nextViewIndex = currentViewIndex + (direction === 'next' ? 1 : -1)
      if (currentViewIndex < 0 || nextViewIndex < 0 || nextViewIndex >= expandableViews.length) return undefined
      selectedBdcId = expandableViews[nextViewIndex]?.bdcId
    }
    if (selectedBdcId === undefined) return undefined
    const selectedEntry = content.cards.find((entry) => entry.bdcId === selectedBdcId)
    if (selectedEntry === undefined) return undefined
    const selectedView = expandableViews.find((view) => view.bdcId === selectedEntry.bdcId)
    const expandedContentId = typeof state.expandedContentId === 'string' ? state.expandedContentId : undefined
    if (expandedContentId !== undefined && selectedView === undefined) return undefined
    const previousView = expandedContentId === undefined
      ? undefined
      : expandableViews.find((view) => view.persoId === expandedContentId)
    const expandedEvents = expandedContentId === undefined || selectedView === undefined
      ? []
      : [
          ...(previousView === undefined || previousView.bdcId === selectedView.bdcId
            ? []
            : [{ name: carouselViewCollapsedEvent(storyId, previousView.bdcId) }]),
          ...(previousView?.bdcId === selectedView.bdcId
            ? []
            : [{ name: carouselViewExpandedEvent(storyId, selectedView.bdcId) }]),
          { name: carouselViewportCurrentEvent(storyId, selectedView.bdcId) },
        ]
    return {
      update: {
        activeCardBdcId: selectedEntry.bdcId,
        manualCarouselSelection: true,
        ...(expandedContentId === undefined || selectedView === undefined ? {} : { expandedContentId: selectedView.persoId }),
      },
      events: [
        ...content.cards.map((entry) => ({
          name: `${prefix}:card:${entry.bdcId}:${entry.bdcId === selectedEntry.bdcId ? 'selected' : 'unselected'}`,
        })),
        ...expandedEvents,
        ...(content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
          ? [{
            name: TRACK_EVENT_DEACTIVATE,
            data: { trackIds: [storyId] },
            visibility: 'scene' as const,
          }]
          : []),
      ],
    }
  }
}

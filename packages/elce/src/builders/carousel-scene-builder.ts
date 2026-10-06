import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION, type AutoCapsuleResolvedEvent } from '@codplay/capsule-automation'
import { CapsuleDistribution } from '@codplay/scene-factory/capsule-distribution'
import { CapsulePreset } from '@codplay/scene-factory/capsule-preset'
import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import type { StrapFunction } from 'codplay/runtime/player'
import { CAROUSEL_CONFIG, CAROUSEL_IMAGE_POSITION, CAROUSEL_PLAYBACK_MODE, DEFAULT_PRESET_ID } from '../config/document-config'
import type { CarouselContent, CarouselCardEntry } from '../domain/carousel-types'
import type { Bdc } from '../domain/document-types'
import { ElceCardPresetBuilder } from './card-preset-builder'
import { ElceCardBdcSceneBuilder } from './card-bdc-scene-builder'
import type { CardBdcSceneBuild } from './card-bdc-scene-builder'
import type { CarouselSceneBuild, CarouselSceneBuildInput } from './carousel-scene-builder-types'

const cardPresetBuilder = new ElceCardPresetBuilder()
const cardBdcSceneBuilder = new ElceCardBdcSceneBuilder()

type ScheduledCard = Readonly<{
  readonly entry: CarouselCardEntry
  readonly bdc: Bdc
  readonly startMs: number
  readonly endMs: number
}>

/** Builds a Carousel scene whose ordered children are first-class Card BDCs. */
export class ElceCarouselSceneBuilder {
  /** Projects Carousel settings and Card BDCs into a CodPlay story. */
  public build(input: CarouselSceneBuildInput): CarouselSceneBuild {
    const { pageId, bdcId, content } = input
    const prefix = `${pageId}:${bdcId}`
    const rootId = `${pageId}-${bdcId}`
    const capsulePartId = `${prefix}:carousel:capsule`
    const navigationPartId = `${prefix}:carousel:navigation`
    const schedule = resolveCardSchedule(input)
    const capsule = new AutoCapsule({
      capsule: {
        id: `${rootId}-capsule`,
        type: CAPSULE_TYPE.carousel,
        className: 'elce-carousel-capsule',
        grid: { className: 'elce-carousel-capsule__grid' },
        style: { aspectRatio: `${content.aspectRatio.width} / ${content.aspectRatio.height}` },
        defaults: {
          introTransitionRef: content.transition,
          outroTransitionRef: content.transition,
          generateDefaultOutro: true,
        },
      },
      children: schedule.map((entry, index) => ({
        id: entry.bdc.id,
        order: index,
        timeRange: { startMs: entry.startMs, endMs: entry.endMs },
        className: 'elce-carousel-view',
        events: {
          intro: { name: `${prefix}:card:${entry.bdc.id}:intro`, action: EVENT_ACTION.intro, ref: content.transition },
          outro: { name: `${prefix}:card:${entry.bdc.id}:outro`, action: EVENT_ACTION.outro, ref: content.transition },
        },
      })),
    })
    const capsuleResult = capsule.resolve()
    const firstCardBdcId = content.cards[0]?.bdcId ?? null
    const cardBuilds = new Map(schedule.map((entry) => [entry.bdc.id, buildCard(input, entry.bdc)]))
    const cardPersos = capsuleResult.children.flatMap((child) => {
      const entry = schedule.find((candidate) => candidate.bdc.id === child.id)
      const cardBuild = cardBuilds.get(child.id)
      if (entry === undefined || cardBuild === undefined) throw new Error(`La carte Carousel ${child.id} est introuvable.`)
      return createCarouselCardPersos(prefix, capsulePartId, child, entry.bdc, cardBuild, firstCardBdcId)
    })
    const selectionEvent = `${prefix}:select-card`
    const navigationPersos = content.cards.map((entry, index) => {
      const child = capsuleResult.children.find((candidate) => candidate.id === entry.bdcId)
      const bdc = input.cards.find((candidate) => candidate.id === entry.bdcId)
      if (child === undefined || bdc === undefined) throw new Error(`La carte Carousel ${entry.bdcId} n’a pas de placement résolu.`)
      return createCarouselNavigationPerso(prefix, navigationPartId, child, bdc, index, firstCardBdcId, selectionEvent)
    })
    const card = cardPresetBuilder.build(
      DEFAULT_PRESET_ID.CAROUSEL,
      rootId,
      `${pageId}:${bdcId}:carousel`,
      {
        frame: createCapsuleMarkup(rootId, capsulePartId, capsuleResult, content.transition),
        navigation: '',
      },
    )
    const story: StoryDoc<string> = {
      id: `${pageId}-${bdcId}`,
      state: { activeCardBdcId: firstCardBdcId },
      persos: [...cardPersos, ...navigationPersos],
      eventimes: content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
        ? createAutomaticEventimes(content, capsuleResult.children, schedule[schedule.length - 1]?.endMs ?? 0)
        : [],
      straps: { [selectionEvent]: createSelectionStrap(prefix, content) },
      listen: [{ on: selectionEvent, straps: [selectionEvent] }],
    }
    return {
      markup: card.markup,
      story,
      mediaPersos: [...cardBuilds.values()].flatMap((build) => build.mediaPersos),
      styleSheet: capsuleResult.styleSheet,
    }
  }
}

/** Resolves Carousel entry durations into the ranges consumed by CapsuleDistribution. */
function resolveCardSchedule(input: CarouselSceneBuildInput): readonly ScheduledCard[] {
  const cardById = new Map(input.cards.map((bdc) => [bdc.id, bdc]))
  let endMs = 0
  const authoredBounds = input.content.cards.map((entry) => {
    const bdc = cardById.get(entry.bdcId)
    if (bdc === undefined || bdc.type !== 'card') throw new Error(`Le BDC Carte ${entry.bdcId} est introuvable.`)
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

/** Builds one Card layout and content projection using the shared Card BDC builder. */
function buildCard(input: CarouselSceneBuildInput, bdc: Bdc): CardBdcSceneBuild {
  return cardBdcSceneBuilder.build({
    pageId: input.pageId,
    containerBdcId: input.bdcId,
    bdc,
    mediaSources: input.mediaSources,
    mediaTypes: input.mediaTypes,
  })
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
  transition: CarouselContent['transition'],
): string {
  const style = serializeStyle(result.capsule.inlineStyle)
  return `<div id="${rootId}-capsule" class="${result.capsule.className}" data-part="${capsulePartId}" data-transition="${transition}"${style}></div>`
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
  framePartId: string,
  child: ReturnType<AutoCapsule['resolve']>['children'][number],
  bdc: Bdc,
  cardBuild: CardBdcSceneBuild,
  firstCardBdcId: string | null,
): readonly PersoDoc<string>[] {
  const selectedEvent = `${prefix}:card:${bdc.id}:selected`
  const unselectedEvent = `${prefix}:card:${bdc.id}:unselected`
  const introEvent = child.events.intro
  const outroEvent = child.events.outro
  const actions: Record<string, unknown> = {
    [selectedEvent]: {
      className: { add: 'elce-carousel-view--visible', remove: 'elce-carousel-view--hidden' },
      attr: { 'aria-hidden': 'false', inert: false },
      ...(introEvent === undefined ? {} : eventStyleAction(introEvent)),
    },
    [unselectedEvent]: {
      className: { add: 'elce-carousel-view--hidden', remove: 'elce-carousel-view--visible' },
      attr: { 'aria-hidden': 'true', inert: true },
      ...(outroEvent === undefined ? {} : eventStyleAction(outroEvent)),
    },
  }
  for (const event of Object.values(child.events)) {
    switch (event.action) {
      case EVENT_ACTION.intro:
        actions[event.name] = {
          className: { add: 'elce-carousel-view--visible', remove: 'elce-carousel-view--hidden' },
          attr: { 'aria-hidden': 'false', inert: false },
          ...eventStyleAction(event),
        }
        break
      case EVENT_ACTION.outro:
        actions[event.name] = {
          className: { add: 'elce-carousel-view--hidden', remove: 'elce-carousel-view--visible' },
          attr: { 'aria-hidden': 'true', inert: true },
          ...eventStyleAction(event),
        }
        break
      default:
        throw new Error(`Action de transition Carousel non prise en charge : ${event.action}`)
    }
  }
  const imagePosition = bdc.card?.imagePosition
  const className = [
    child.className,
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
      move: { target: framePartId },
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

/** Converts a Capsule Automation transition definition into a CodPlay style action. */
function eventStyleAction(event: AutoCapsuleResolvedEvent): Record<string, unknown> {
  const properties = event.definition?.style?.[event.action]
  if (properties === undefined) return {}
  const style = Object.fromEntries(Object.entries(properties).map(([property, tween]) => [property, {
    ...(tween.from === undefined ? {} : { from: tween.from }),
    to: tween.to,
    duration: event.durationMs,
  }]))
  return { style }
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

/** Builds the strap that records selected Card BDC identity and visibility actions. */
function createSelectionStrap(prefix: string, content: CarouselContent): StrapFunction {
  return ({ event }) => {
    const selectedBdcId = event.data?.cardBdcId
    if (typeof selectedBdcId !== 'string') return undefined
    const selectedEntry = content.cards.find((entry) => entry.bdcId === selectedBdcId)
    if (selectedEntry === undefined) return undefined
    return {
      update: { activeCardBdcId: selectedEntry.bdcId },
      events: content.cards.map((entry) => ({
        name: `${prefix}:card:${entry.bdcId}:${entry.bdcId === selectedEntry.bdcId ? 'selected' : 'unselected'}`,
      })),
    }
  }
}

import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION, type AutoCapsuleResolvedEvent } from '@codplay/capsule-automation'
import { CapsuleDistribution } from '@codplay/scene-factory/capsule-distribution'
import { CapsulePreset } from '@codplay/scene-factory/capsule-preset'
import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import type { StrapFunction } from 'codplay/runtime/player'
import { CAROUSEL_CONFIG, CAROUSEL_IMAGE_POSITION, CAROUSEL_PLAYBACK_MODE, DEFAULT_PRESET_ID, MEDIA_TYPE } from '../config/document-config'
import type { CarouselContent, CarouselView } from '../domain/carousel-types'
import type { MediaId } from '../domain/document-types'
import { ElceCardPresetBuilder } from './card-preset-builder'
import type { CarouselSceneBuild, CarouselSceneBuildInput } from './carousel-scene-builder-types'

const cardPresetBuilder = new ElceCardPresetBuilder()

/** Builds one page-level Carousel BDC using the Capsule Automation authoring path. */
export class ElceCarouselSceneBuilder {
  /** Projects the unique Elcé BDC to markup, one CodPlay story, and reusable media persos. */
  public build(input: CarouselSceneBuildInput): CarouselSceneBuild {
    const { pageId, bdcId, content } = input
    const prefix = `${pageId}:${bdcId}`
    const rootId = `${pageId}-${bdcId}`
    const capsulePartId = `${prefix}:carousel:capsule`
    const navigationPartId = `${prefix}:carousel:navigation`
    const schedule = resolveViewSchedule(content)
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
        id: entry.view.id,
        order: index,
        timeRange: { startMs: entry.startMs, endMs: entry.endMs },
        className: 'elce-carousel-view',
        events: {
          intro: { name: `${prefix}:view:${entry.view.id}:intro`, action: EVENT_ACTION.intro, ref: content.transition },
          outro: { name: `${prefix}:view:${entry.view.id}:outro`, action: EVENT_ACTION.outro, ref: content.transition },
        },
      })),
    })
    const capsuleResult = capsule.resolve()
    const viewById = new Map(content.views.map((view) => [view.id, view]))
    const firstViewId = content.views[0]?.id ?? null
    const viewPersos = capsuleResult.children.flatMap((child) => {
      const view = viewById.get(child.id)
      if (view === undefined) throw new Error(`La vue Carousel ${child.id} est introuvable.`)
      return createCarouselViewPersos(prefix, capsulePartId, child, view, firstViewId)
    })
    const selectionEvent = `${prefix}:select-view`
    const selectionStrapName = `${prefix}:select-view`
    const viewNavigationPersos = content.views.map((view, index) => {
      const child = capsuleResult.children.find((candidate) => candidate.id === view.id)
      if (child === undefined) throw new Error(`La vue Carousel ${view.id} n’a pas de placement résolu.`)
      return createCarouselNavigationPerso(prefix, navigationPartId, child, view, index, firstViewId, selectionEvent)
    })
    const selectionStrap = createSelectionStrap(prefix, content)
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
      state: { activeViewId: firstViewId },
      persos: [...viewPersos, ...viewNavigationPersos],
      eventimes: content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
        ? createAutomaticEventimes(
          content,
          capsuleResult.children,
          schedule[schedule.length - 1]?.endMs ?? 0,
        )
        : [],
      straps: { [selectionStrapName]: selectionStrap },
      listen: [{ on: selectionEvent, straps: [selectionStrapName] }],
    }
    return {
      markup: card.markup,
      story,
      mediaPersos: content.views.flatMap((view) => createCarouselMediaPersos(input, view, prefix)),
      styleSheet: capsuleResult.styleSheet,
    }
  }
}

/** Converts per-view durations into the explicit bounds consumed by CapsuleDistribution. */
function resolveViewSchedule(content: CarouselContent): readonly Readonly<{ view: CarouselView; startMs: number; endMs: number }>[] {
  let endMs = 0
  const authoredBounds = content.views.map((view) => {
    const durationMs = view.durationMs ?? content.defaultViewDurationMs
    const startMs = endMs
    endMs += durationMs
    return { view, startMs, endMs }
  })
  const distribution = CapsuleDistribution.compute({
    clipDurationMs: endMs,
    mode: CapsulePreset.resolve({ capsuleType: CAPSULE_TYPE.carousel }).mode,
    children: authoredBounds.map(({ view, startMs, endMs: viewEndMs }) => ({
      trackId: view.id,
      lockedIntroMs: startMs,
      lockedOutroMs: viewEndMs,
    })),
  })
  const distributedById = new Map(distribution.children.map((child) => [child.trackId, child]))
  return authoredBounds.map(({ view }) => {
    const range = distributedById.get(view.id)
    if (range === undefined) throw new Error(`CapsuleDistribution n’a pas résolu la vue ${view.id}.`)
    return { view, startMs: range.introMs, endMs: range.outroMs }
  })
}

/** Expands Capsule Automation's finite view schedule into the configured repeat count. */
function createAutomaticEventimes(
  content: CarouselContent,
  children: ReturnType<AutoCapsule['resolve']>['children'],
  cycleDurationMs: number,
): NonNullable<StoryDoc<string>['eventimes']> {
  const repeatCount = content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount
  return Array.from({ length: repeatCount + 1 }, (_, repetitionIndex) =>
    children.flatMap((child, viewIndex) => Object.values(child.events)
      .filter((event) => repetitionIndex < repeatCount
        || viewIndex < children.length - 1
        || event.action !== EVENT_ACTION.outro)
      .map((event) => ({
        name: event.name,
        startAt: event.triggerMs + cycleDurationMs * repetitionIndex,
      })))
  ).flat()
}

/** Creates the fixed AutoCapsule host and each preset-card view inside it. */
function createCapsuleMarkup(
  rootId: string,
  capsulePartId: string,
  result: ReturnType<AutoCapsule['resolve']>,
  transition: CarouselContent['transition'],
): string {
  const style = serializeStyle(result.capsule.inlineStyle)
  return `<div id="${rootId}-capsule" class="${result.capsule.className}" data-part="${capsulePartId}" data-transition="${transition}"${style}></div>`
}

/** Serializes builder-owned inline style values for the static card markup. */
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

/** Creates a view layout with its generated automatic and manual selection actions. */
function createCarouselViewPersos(
  prefix: string,
  framePartId: string,
  child: ReturnType<AutoCapsule['resolve']>['children'][number],
  view: CarouselView,
  firstViewId: string | null,
): readonly PersoDoc<string>[] {
  const card = cardPresetBuilder.build(view.presetId, `${prefix}-view-${view.id}`, `${prefix}:view:${view.id}`)
  const selectedEvent = `${prefix}:view:${view.id}:selected`
  const unselectedEvent = `${prefix}:view:${view.id}:unselected`
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
  const initialEvents = Object.values(child.events)
  for (const event of initialEvents) {
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
  const className = [
    child.className,
    firstViewId === view.id ? 'elce-carousel-view--visible' : 'elce-carousel-view--hidden',
    imagePositionClass(view),
  ].filter(Boolean).join(' ')
  const viewRoot: PersoDoc<string> = {
    id: `${prefix}-view-${view.id}`,
    type: 'layout',
    initial: {
      move: { target: framePartId },
      className,
      attr: { 'aria-hidden': firstViewId !== view.id, inert: firstViewId !== view.id },
      style: {
        ...child.inlineStyle,
        opacity: firstViewId === view.id ? 1 : 0,
        x: 0,
        y: 0,
        scale: 1,
      },
      markup: card.markup,
    },
    actions,
  }
  return [viewRoot, ...createCarouselViewTextPersos(prefix, view, card.zonePartIds)]
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

/** Creates CodPlay text persos for the text zones of one fixed card preset. */
function createCarouselViewTextPersos(
  prefix: string,
  view: CarouselView,
  zonePartIds: Readonly<Record<string, string>>,
): readonly PersoDoc<string>[] {
  switch (view.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return [
        createCarouselTextPerso(prefix, view.id, 'overline', 'p', view.text.overline, zonePartIds.overline),
        createCarouselTextPerso(prefix, view.id, 'title', 'h2', view.text.title, zonePartIds.title),
        createCarouselTextPerso(prefix, view.id, 'description', 'p', view.text.description, zonePartIds.description),
        createCarouselTextPerso(prefix, view.id, 'message', 'p', view.text.message, zonePartIds.message),
        createCarouselTextPerso(prefix, view.id, 'note', 'footer', view.text.note, zonePartIds.note),
      ]
    case DEFAULT_PRESET_ID.PHOTO:
      return []
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return [createCarouselTextPerso(prefix, view.id, 'caption', 'p', view.text.caption, zonePartIds.caption)]
  }
}

/** Places an optional plain-text field in its configured preset zone. */
function createCarouselTextPerso(
  prefix: string,
  viewId: string,
  zone: string,
  tag: string,
  content: string,
  target: string | undefined,
): PersoDoc<string> {
  switch (target) {
    case undefined:
      throw new Error(`La zone ${zone} manque à la vue Carousel ${viewId}.`)
    default:
      break
  }
  return {
    id: `${prefix}-view-${viewId}-${zone}`,
    type: 'tag',
    initial: {
      tag,
      content,
      attr: { hidden: content.length === 0 },
      move: { target },
    },
  }
}

/** Creates one CodPlay button that selects its corresponding view in either mode. */
function createCarouselNavigationPerso(
  prefix: string,
  navigationPartId: string,
  child: ReturnType<AutoCapsule['resolve']>['children'][number],
  view: CarouselView,
  index: number,
  firstViewId: string | null,
  selectionEvent: string,
): PersoDoc<string> {
  const selectedEvent = `${prefix}:view:${view.id}:selected`
  const unselectedEvent = `${prefix}:view:${view.id}:unselected`
  const isFirstView = firstViewId === view.id
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
    id: `${prefix}-dot-${view.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: '•',
      className: isFirstView ? 'elce-carousel-dot elce-carousel-dot--active' : 'elce-carousel-dot elce-carousel-dot--inactive',
      attr: isFirstView ? selectedAttributes : unselectedAttributes,
      move: { target: navigationPartId },
    },
    emit: { click: { event: { name: selectionEvent, data: { viewId: view.id }, visibility: 'story' } } },
    actions: {
      ...actions,
    },
  }
}

/** Builds the story strap that records point selection and updates all view states. */
function createSelectionStrap(
  prefix: string,
  content: CarouselContent,
): StrapFunction {
  return ({ event }) => {
    const selectedViewId = event.data?.viewId
    switch (typeof selectedViewId) {
      case 'string':
        break
      default:
        return undefined
    }
    const selectedView = content.views.find((view) => view.id === selectedViewId)
    switch (selectedView) {
      case undefined:
        return undefined
      default:
        return {
          update: { activeViewId: selectedView.id },
          events: content.views.map((view) => ({
            name: `${prefix}:view:${view.id}:${view.id === selectedView.id ? 'selected' : 'unselected'}`,
          })),
        }
    }
  }
}

/** Creates the image or video perso that fills one preset's media part. */
function createCarouselMediaPersos(
  input: CarouselSceneBuildInput,
  view: CarouselView,
  prefix: string,
): readonly PersoDoc<string>[] {
  switch (view.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return []
    case DEFAULT_PRESET_ID.PHOTO:
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      break
  }
  switch (view.mediaId) {
    case null:
      return []
    default:
      break
  }
  const source = input.mediaSources[view.mediaId]
  switch (source) {
    case undefined:
      return []
    default:
      break
  }
  const type = input.mediaTypes[view.mediaId]
  const partId = carouselMediaPartId(prefix, view)
  switch (type) {
    case MEDIA_TYPE.IMAGE:
      return [createCarouselImagePerso(prefix, view.id, view.mediaId, source, partId)]
    case MEDIA_TYPE.VIDEO:
      switch (view.presetId) {
        case DEFAULT_PRESET_ID.PHOTO:
          return [createCarouselVideoPerso(prefix, view.id, view.mediaId, source, partId)]
        default:
          return []
      }
    default:
      return []
  }
}

/** Resolves the media target emitted by the view's fixed card preset. */
function carouselMediaPartId(prefix: string, view: CarouselView): string {
  switch (view.presetId) {
    case DEFAULT_PRESET_ID.PHOTO:
      return `${prefix}:view:${view.id}:media`
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return `${prefix}:view:${view.id}:image`
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return `${prefix}:view:${view.id}:image`
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      throw new Error(`La vue Texte court ${view.id} ne comporte pas de zone média.`)
  }
}

/** Adds the selected image-side class to a Text-image view wrapper. */
function imagePositionClass(view: CarouselView): string | null {
  switch (view.presetId) {
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      switch (view.imagePosition) {
        case CAROUSEL_IMAGE_POSITION.LEFT:
          return 'elce-carousel-view--image-left'
        case CAROUSEL_IMAGE_POSITION.RIGHT:
          return 'elce-carousel-view--image-right'
      }
    default:
      return null
  }
}

/** Creates the CodPlay image component for a Carousel view's fixed media zone. */
function createCarouselImagePerso(prefix: string, viewId: string, mediaId: MediaId, source: string, target: string): PersoDoc<string> {
  return {
    id: `${prefix}-view-${viewId}-media-${mediaId}`,
    type: 'img',
    initial: {
      src: source,
      alt: '',
      className: 'elce-carousel-media',
      img: { style: { display: 'block', width: '100%', height: '100%', objectFit: 'cover' } },
      move: { target },
    },
  }
}

/** Creates the CodPlay video component for a full-frame Carousel media zone. */
function createCarouselVideoPerso(prefix: string, viewId: string, mediaId: MediaId, source: string, target: string): PersoDoc<string> {
  return {
    id: `${prefix}-view-${viewId}-media-${mediaId}`,
    type: 'media',
    initial: {
      tag: 'video',
      src: source,
      controls: true,
      master: false,
      className: 'elce-carousel-media',
      video: { style: { display: 'block', width: '100%', height: '100%', objectFit: 'cover' } },
      move: { target },
    },
  }
}

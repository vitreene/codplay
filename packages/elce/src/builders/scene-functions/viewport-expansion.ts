import type { StrapExecutionInput, StrapRuntimeOutput } from 'codplay/runtime/player'

export const ELCE_VIEWPORT_EXPANSION_RUNTIME_KEY = 'elceViewportExpansionRuntime'
export const VIEWPORT_EXPANSION_SCROLL_LOCK_EVENT = 'elce:viewport-expansion:scroll-lock'
export const VIEWPORT_EXPANSION_SCROLL_UNLOCK_EVENT = 'elce:viewport-expansion:scroll-unlock'
export const VIEWPORT_EXPANSION_CONTENT_ATTR = 'data-elce-viewport-content'
export const VIEWPORT_EXPANSION_SCROLL_LOCK_REQUEST_EVENT = 'elce:viewport-expansion:request-scroll-lock'
export const VIEWPORT_EXPANSION_SCROLL_UNLOCK_REQUEST_EVENT = 'elce:viewport-expansion:request-scroll-unlock'

const SWIPE_THRESHOLD_PX = 48
const TAP_TOLERANCE_PX = 8

type CarouselRuntimeConfiguration = Readonly<{
  selectionEvent: string
  automatic: boolean
  trackId: string
  trackActivateEvent: string
  trackDeactivateEvent: string
}>

type ViewportExpansionRuntimeConfiguration = Readonly<{
  storyId: string
  hostId: string
  previousControlId?: string
  nextControlId?: string
  contentIds: readonly string[]
  views: readonly Readonly<{ bdcId: string; persoId: string }>[]
  carousel?: CarouselRuntimeConfiguration
  gestureEndEvent: string
  keyboardToggleEvent: string
  escapeEvent: string
  openHostEvent: string
  closeHostEvent: string
  finishCloseHostEvent: string
  focusReadyEvent: string
}>

/** Initializes one pointer gesture's movement accumulator. */
export function initializeViewportGestureCapture(): Readonly<{ deltaX: number; deltaY: number }> {
  return { deltaX: 0, deltaY: 0 }
}

/** Adds one pointer movement sample to the capture's accumulated displacement. */
export function trackViewportGesture(input: Readonly<{
  sample: Readonly<Record<string, unknown>>
  captureState: Readonly<Record<string, unknown>>
}>): Readonly<{ captureState: Readonly<{ deltaX: number; deltaY: number }> }> {
  return {
    captureState: {
      deltaX: readNumber(input.captureState.deltaX) + readNumber(input.sample.movementX),
      deltaY: readNumber(input.captureState.deltaY) + readNumber(input.sample.movementY),
    },
  }
}

/** Resolves viewport gestures and commands from the current story state. */
export function viewportExpansionStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readViewportExpansionConfiguration(input.state)
  if (configuration === undefined) return undefined

  const expandedContentId = typeof input.state.expandedContentId === 'string' ? input.state.expandedContentId : undefined
  const closingContentId = typeof input.state.closingContentId === 'string' ? input.state.closingContentId : undefined
  const sourceId = typeof input.event.data?.sourceId === 'string' ? input.event.data.sourceId : undefined
  const keyboardContentId = typeof input.event.data?.contentPersoId === 'string' ? input.event.data.contentPersoId : undefined

  if (input.event.name === configuration.focusReadyEvent) {
    if (expandedContentId !== undefined || closingContentId === undefined) return undefined
    return {
      update: { closingContentId: null },
      events: [
        { name: configuration.finishCloseHostEvent, visibility: 'story' },
        { name: VIEWPORT_EXPANSION_SCROLL_UNLOCK_REQUEST_EVENT, visibility: 'scene' },
        { name: viewportFocusEvent(configuration.storyId, closingContentId), visibility: 'story' },
        ...(configuration.carousel?.automatic !== true || input.state.manualCarouselSelection === true
          ? []
          : [{ name: configuration.carousel.trackActivateEvent, data: { trackIds: [configuration.carousel.trackId] }, visibility: 'scene' as const }]),
      ],
    }
  }

  if (input.event.name === configuration.escapeEvent) {
    return expandedContentId === undefined
      ? undefined
      : closeExpansion(expandedContentId, expandedCardId(expandedContentId, configuration), configuration)
  }

  if (input.event.name === configuration.keyboardToggleEvent) {
    if (keyboardContentId === undefined || !configuration.contentIds.includes(keyboardContentId)) return undefined
    if (expandedContentId === keyboardContentId) {
      return closeExpansion(keyboardContentId, expandedCardId(keyboardContentId, configuration), configuration)
    }
    if (expandedContentId !== undefined || (closingContentId !== undefined && closingContentId !== keyboardContentId)) return undefined
    return openExpansion(keyboardContentId, configuration)
  }

  if (input.event.name !== configuration.gestureEndEvent || sourceId === undefined) return undefined
  const captureState = asRecord(input.event.data?.captureState)
  const deltaX = readNumber(captureState.deltaX)
  const deltaY = readNumber(captureState.deltaY)
  const horizontalSwipe = Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY)
  if (horizontalSwipe) {
    if (expandedContentId === undefined || configuration.carousel === undefined) return undefined
    return {
      events: [{ name: configuration.carousel.selectionEvent, data: { direction: deltaX < 0 ? 'next' : 'previous' }, visibility: 'story' }],
    }
  }

  if (Math.abs(deltaX) >= TAP_TOLERANCE_PX || Math.abs(deltaY) >= TAP_TOLERANCE_PX) return undefined
  const controlDirection = sourceId === configuration.previousControlId
    ? 'previous'
    : sourceId === configuration.nextControlId ? 'next' : undefined
  if (controlDirection !== undefined) {
    if (expandedContentId === undefined) {
      return closingContentId === undefined ? undefined : openExpansion(closingContentId, configuration)
    }
    return configuration.carousel === undefined
      ? undefined
      : { events: [{ name: configuration.carousel.selectionEvent, data: { direction: controlDirection }, visibility: 'story' }] }
  }

  if (expandedContentId !== undefined) {
    return sourceId === configuration.hostId || sourceId === expandedContentId
      ? closeExpansion(expandedContentId, expandedCardId(expandedContentId, configuration), configuration)
      : undefined
  }
  if (closingContentId !== undefined) {
    return sourceId === configuration.hostId || sourceId === closingContentId
      ? openExpansion(closingContentId, configuration)
      : undefined
  }
  return configuration.contentIds.includes(sourceId) ? openExpansion(sourceId, configuration) : undefined
}

/** Names one Carousel view expansion action. */
export function carouselViewExpandedEvent(storyId: string, bdcId: string): string {
  return `${storyId}:viewport:carousel:${bdcId}:expanded`
}

/** Names one Carousel view collapse action. */
export function carouselViewCollapsedEvent(storyId: string, bdcId: string): string {
  return `${storyId}:viewport:carousel:${bdcId}:collapsed`
}

/** Names the Carousel view used to update expanded navigation controls. */
export function carouselViewportCurrentEvent(storyId: string, bdcId: string): string {
  return `${storyId}:viewport:carousel:${bdcId}:current`
}

/** Reads and validates the compact viewport parameters carried by story state. */
function readViewportExpansionConfiguration(
  state: Readonly<Record<string, unknown>>,
): ViewportExpansionRuntimeConfiguration | undefined {
  const value = state[ELCE_VIEWPORT_EXPANSION_RUNTIME_KEY]
  if (!isRecord(value)
    || typeof value.storyId !== 'string'
    || typeof value.hostId !== 'string'
    || (value.previousControlId !== undefined && typeof value.previousControlId !== 'string')
    || (value.nextControlId !== undefined && typeof value.nextControlId !== 'string')
    || !isStringArray(value.contentIds)
    || !Array.isArray(value.views)
    || value.views.some((view) => !isRecord(view) || typeof view.bdcId !== 'string' || typeof view.persoId !== 'string')
    || !isStringArray([
      value.gestureEndEvent,
      value.keyboardToggleEvent,
      value.escapeEvent,
      value.openHostEvent,
      value.closeHostEvent,
      value.finishCloseHostEvent,
      value.focusReadyEvent,
    ])
    || (value.carousel !== undefined && !isCarouselConfiguration(value.carousel))) {
    return undefined
  }
  return value as ViewportExpansionRuntimeConfiguration
}

/** Resolves a configured Carousel runtime object from serialized story state. */
function isCarouselConfiguration(value: unknown): value is CarouselRuntimeConfiguration {
  return isRecord(value)
    && typeof value.selectionEvent === 'string'
    && typeof value.automatic === 'boolean'
    && typeof value.trackId === 'string'
    && typeof value.trackActivateEvent === 'string'
    && typeof value.trackDeactivateEvent === 'string'
}

/** Opens one content perso and records the selected Carousel view when applicable. */
function openExpansion(
  contentId: string,
  configuration: ViewportExpansionRuntimeConfiguration,
): StrapRuntimeOutput {
  const view = configuration.views.find((candidate) => candidate.persoId === contentId)
  return {
    update: {
      expandedContentId: contentId,
      closingContentId: null,
      ...(view === undefined ? {} : { activeCardBdcId: view.bdcId }),
    },
    events: [
      { name: contentOpenEvent(configuration.storyId, contentId), visibility: 'story' },
      { name: configuration.openHostEvent, visibility: 'story' },
      { name: VIEWPORT_EXPANSION_SCROLL_LOCK_REQUEST_EVENT, visibility: 'scene' },
      ...(view === undefined ? [] : [{ name: carouselViewportCurrentEvent(configuration.storyId, view.bdcId), visibility: 'story' as const }]),
      ...(configuration.carousel?.automatic !== true
        ? []
        : [{ name: configuration.carousel.trackDeactivateEvent, data: { trackIds: [configuration.carousel.trackId] }, visibility: 'scene' as const }]),
    ],
  }
}

/** Closes one content perso and starts the existing transition and focus cycle. */
function closeExpansion(
  contentId: string,
  cardBdcId: string | undefined,
  configuration: ViewportExpansionRuntimeConfiguration,
): StrapRuntimeOutput {
  return {
    update: { expandedContentId: null, closingContentId: contentId },
    events: [
      { name: contentCloseEvent(configuration.storyId, contentId), visibility: 'story' },
      { name: configuration.closeHostEvent, visibility: 'story' },
      ...(cardBdcId === undefined ? [] : [{ name: `${configuration.storyId}:viewport:carousel:close`, visibility: 'story' as const }]),
    ],
  }
}

/** Resolves one content's owning Carousel card identity. */
function expandedCardId(contentId: string, configuration: ViewportExpansionRuntimeConfiguration): string | undefined {
  return configuration.views.find((view) => view.persoId === contentId)?.bdcId
}

/** Names the event that moves one expandable content perso to its host. */
export function contentOpenEvent(storyId: string, contentId: string): string {
  return `${storyId}:viewport:content:${contentId}:open`
}

/** Names the event that returns one expandable content perso to its source. */
export function contentCloseEvent(storyId: string, contentId: string): string {
  return `${storyId}:viewport:content:${contentId}:close`
}

/** Names the focus restoration emitted after the return motion settles. */
export function viewportFocusEvent(storyId: string, contentId: string): string {
  return `${storyId}:viewport:content:${contentId}:focus`
}

/** Accepts only a non-array object from compiled state. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Accepts only string identifiers from compiled state. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/** Reads one finite numeric pointer displacement. */
function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Reads one optional event payload as a plain record. */
function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

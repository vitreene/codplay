import type { StrapExecutionInput, StrapRuntimeOutput } from 'codplay/runtime/player'
import {
  carouselViewCollapsedEvent,
  carouselViewExpandedEvent,
  carouselViewportCurrentEvent,
} from './viewport-expansion'

export const ELCE_CAROUSEL_RUNTIME_KEY = 'elceCarouselRuntime'

type CarouselRuntimeConfiguration = Readonly<{
  prefix: string
  storyId: string
  cardIds: readonly string[]
  selectionEvent: string
  automatic: boolean
  trackId: string
  trackDeactivateEvent: string
  views: readonly Readonly<{ bdcId: string; persoId: string }>[]
}>

/** Selects a Carousel card from its current scene-state parameters and event. */
export function selectCarouselCardStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readCarouselConfiguration(input.state)
  if (configuration === undefined) return undefined

  let selectedBdcId = typeof input.event.data?.cardBdcId === 'string' ? input.event.data.cardBdcId : undefined
  const direction = input.event.data?.direction
  if (selectedBdcId === undefined && (direction === 'previous' || direction === 'next')) {
    const activeBdcId = typeof input.state.activeCardBdcId === 'string' ? input.state.activeCardBdcId : undefined
    const currentViewIndex = configuration.views.findIndex((view) => view.bdcId === activeBdcId)
    const nextViewIndex = currentViewIndex + (direction === 'next' ? 1 : -1)
    if (currentViewIndex < 0 || nextViewIndex < 0 || nextViewIndex >= configuration.views.length) return undefined
    selectedBdcId = configuration.views[nextViewIndex]?.bdcId
  }
  if (selectedBdcId === undefined || !configuration.cardIds.includes(selectedBdcId)) return undefined

  const selectedView = configuration.views.find((view) => view.bdcId === selectedBdcId)
  const expandedContentId = typeof input.state.expandedContentId === 'string' ? input.state.expandedContentId : undefined
  if (expandedContentId !== undefined && selectedView === undefined) return undefined
  const previousView = expandedContentId === undefined
    ? undefined
    : configuration.views.find((view) => view.persoId === expandedContentId)
  const expandedEvents = expandedContentId === undefined || selectedView === undefined
    ? []
    : [
        ...(previousView === undefined || previousView.bdcId === selectedView.bdcId
          ? []
          : [{ name: carouselViewCollapsedEvent(configuration.storyId, previousView.bdcId) }]),
        ...(previousView?.bdcId === selectedView.bdcId
          ? []
          : [{ name: carouselViewExpandedEvent(configuration.storyId, selectedView.bdcId) }]),
        { name: carouselViewportCurrentEvent(configuration.storyId, selectedView.bdcId) },
      ]
  return {
    update: {
      activeCardBdcId: selectedBdcId,
      manualCarouselSelection: true,
      ...(expandedContentId === undefined || selectedView === undefined ? {} : { expandedContentId: selectedView.persoId }),
    },
    events: [
      ...configuration.cardIds.map((bdcId) => ({
        name: `${configuration.prefix}:card:${bdcId}:${bdcId === selectedBdcId ? 'selected' : 'unselected'}`,
      })),
      ...expandedEvents,
      ...(configuration.automatic
        ? [{
            name: configuration.trackDeactivateEvent,
            data: { trackIds: [configuration.trackId] },
            visibility: 'scene' as const,
          }]
        : []),
    ],
  }
}

/** Reads the compact Carousel parameters stored in its story state. */
function readCarouselConfiguration(state: Readonly<Record<string, unknown>>): CarouselRuntimeConfiguration | undefined {
  const value = state[ELCE_CAROUSEL_RUNTIME_KEY]
  if (!isRecord(value)
    || typeof value.prefix !== 'string'
    || typeof value.storyId !== 'string'
    || !isStringArray(value.cardIds)
    || typeof value.selectionEvent !== 'string'
    || typeof value.automatic !== 'boolean'
    || typeof value.trackId !== 'string'
    || typeof value.trackDeactivateEvent !== 'string'
    || !Array.isArray(value.views)
    || value.views.some((view) => !isRecord(view) || typeof view.bdcId !== 'string' || typeof view.persoId !== 'string')) {
    return undefined
  }
  return value as CarouselRuntimeConfiguration
}

/** Checks a non-array object received from serialized scene state. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks a string list received from serialized scene state. */
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

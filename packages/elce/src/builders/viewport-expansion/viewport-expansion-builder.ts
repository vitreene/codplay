import type { AuthorRecord, PersoDoc, SceneDoc, StoryDoc } from 'codplay/scene/types'
import type { StrapFunction, StrapRuntimeOutput } from 'codplay/runtime/player'
import { TRACK_EVENT_ACTIVATE, TRACK_EVENT_DEACTIVATE } from 'codplay/runtime/player'
import { ELCE_VIEWPORT_EXPANSION_DURATION_MS } from './viewport-expansion-style.ts'

const SWIPE_THRESHOLD_PX = 48
const TAP_TOLERANCE_PX = 8

export const VIEWPORT_EXPANSION_SCROLL_LOCK_EVENT = 'elce:viewport-expansion:scroll-lock'
export const VIEWPORT_EXPANSION_SCROLL_UNLOCK_EVENT = 'elce:viewport-expansion:scroll-unlock'
export const VIEWPORT_EXPANSION_CONTENT_ATTR = 'data-elce-viewport-content'
const VIEWPORT_EXPANSION_SCROLL_LOCK_REQUEST_EVENT = 'elce:viewport-expansion:request-scroll-lock'
const VIEWPORT_EXPANSION_SCROLL_UNLOCK_REQUEST_EVENT = 'elce:viewport-expansion:request-scroll-unlock'

export type ViewportExpansionCarouselView = Readonly<{
  readonly bdcId: string
  readonly persoId: string
}>

export type ViewportExpansionCarousel = Readonly<{
  readonly selectionEvent: string
  readonly views: readonly ViewportExpansionCarouselView[]
  readonly automatic: boolean
  readonly trackId: string
}>

type ViewportExpansionPersoDoc = Readonly<{
  id: string
  type: string
  initial?: AuthorRecord
  actions?: Readonly<Record<string, unknown>>
  emit?: NonNullable<PersoDoc<string>['emit']>
}>

type ViewportExpansionContentKind = 'image' | 'graph'

/** Adds the viewport target and its interactions to a story containing expandable Elcé content. */
export function addViewportExpansionToStory(
  story: StoryDoc<string>,
  carousel?: ViewportExpansionCarousel,
): StoryDoc<string> {
  const contents = story.persos.filter(isViewportExpansionPerso)
  if (contents.length === 0) return story

  const hostId = `${story.id}-viewport-expansion`
  if (story.persos.some((perso) => perso.id === `${hostId}-host`)) return story

  if (Array.isArray(story.straps)) {
    throw new Error(`La story ${story.id} utilise des straps référencés et ne peut pas recevoir le strap d’agrandissement local.`)
  }

  const hostPartId = `${story.id}:viewport-expansion:media`
  const gestureEndEvent = `${story.id}:viewport-expansion:gesture-ended`
  const keyboardToggleEvent = `${story.id}:viewport-expansion:keyboard-toggle`
  const escapeEvent = `${story.id}:viewport-expansion:escape`
  const openHostEvent = `${story.id}:viewport-expansion:open-host`
  const closeHostEvent = `${story.id}:viewport-expansion:close-host`
  const finishCloseHostEvent = `${story.id}:viewport-expansion:finish-close-host`
  const focusReadyEvent = `${story.id}:viewport-expansion:focus-ready`
  const strapName = `${story.id}:viewport-expansion`
  const contentById = new Map(contents.map((content) => [content.id, content]))
  const viewByContentId = new Map((carousel?.views ?? []).map((view) => [view.persoId, view]))
  const contentIds = new Set(contentById.keys())

  const expandedContents = contents.map((content) => {
    const kind = viewportExpansionContentKind(content)
    if (kind === undefined) throw new Error(`Le perso ${content.id} n’est pas un contenu d’agrandissement pris en charge.`)
    const sourceTarget = readMoveTarget(asRecord(content.initial).move, content.id)
    const openEvent = contentOpenEvent(story.id, content.id)
    const closeEvent = contentCloseEvent(story.id, content.id)
    const focusEvent = viewportFocusEvent(story.id, content.id)
    const view = viewByContentId.get(content.id)
    const actions: Record<string, unknown> = {
      ...content.actions,
      [openEvent]: createContentMoveAction(hostPartId, kind, true),
      [closeEvent]: createContentMoveAction(sourceTarget, kind, false),
      [focusEvent]: { htmlElementMethod: ['focus', 'preventscroll'] },
    }

    if (view !== undefined) {
      actions[carouselViewExpandedEvent(story.id, view.bdcId)] = createContentMoveAction(hostPartId, kind, true)
      actions[carouselViewCollapsedEvent(story.id, view.bdcId)] = createContentMoveAction(sourceTarget, kind, false)
    }

    return {
      ...content,
      initial: {
        ...content.initial,
        attr: {
          ...asRecord(asRecord(content.initial).attr),
          ...initialContentAttributes(kind),
        },
      },
      emit: {
        ...content.emit,
        pointerdown: createPointerGestureRule(content.id, gestureEndEvent),
        ...(['image', 'graph'].includes(kind) ? {
          keydown: [
            ...asEventRules(content.emit?.keydown),
            { keyCode: 'Enter', preventDefault: true, event: { name: keyboardToggleEvent, data: { contentPersoId: content.id }, visibility: 'story' } },
            { keyCode: 'Space', preventDefault: true, event: { name: keyboardToggleEvent, data: { contentPersoId: content.id }, visibility: 'story' } },
            { keyCode: 'Escape', preventDefault: true, event: { name: escapeEvent, visibility: 'story' } },
          ],
        } : {}),
      } as NonNullable<PersoDoc<string>['emit']>,
      actions,
    } satisfies PersoDoc<string>
  })

  const navigationPersos = carousel === undefined
    ? []
    : createCarouselNavigationPersos(story.id, hostId, carousel, gestureEndEvent, escapeEvent)
  const controlDirections = new Map(navigationPersos.map((perso) => [perso.id, perso.id.endsWith('-previous') ? 'previous' : 'next'] as const))
  const host: PersoDoc<string> = {
    id: `${hostId}-host`,
    type: 'layout',
    initial: {
      move: '@root',
      className: 'elce-viewport-expansion-host elce-viewport-expansion-host--closed',
      attr: {
        role: 'dialog',
        'aria-label': 'Affichage agrandi',
        'aria-hidden': 'true',
        inert: true,
        tabindex: '-1',
      },
      style: {
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483647,
        boxSizing: 'border-box',
        overflow: 'hidden',
      },
      markup: `<div id="${hostId}-frame" class="elce-viewport-expansion-host__frame"><!-- data-part="${hostPartId}" --><!-- data-part="${hostId}:previous" --><!-- data-part="${hostId}:next" --></div>`,
    },
    actions: {
      [openHostEvent]: {
        className: {
          add: 'elce-viewport-expansion-host--open',
          remove: 'elce-viewport-expansion-host--closed elce-viewport-expansion-host--closing',
        },
        attr: { 'aria-hidden': 'false', inert: false },
        htmlElementMethod: ['focus', 'preventscroll'],
      },
      [closeHostEvent]: {
        className: { add: 'elce-viewport-expansion-host--closing', remove: 'elce-viewport-expansion-host--open' },
      },
      [finishCloseHostEvent]: {
        className: { add: 'elce-viewport-expansion-host--closed', remove: 'elce-viewport-expansion-host--closing elce-viewport-expansion-host--open' },
        attr: { 'aria-hidden': 'true', inert: true },
      },
    },
    emit: {
      pointerdown: createPointerGestureRule(`${hostId}-host`, gestureEndEvent),
      keydown: { keyCode: 'Escape', preventDefault: true, event: { name: escapeEvent, visibility: 'story' } },
      transitionend: { event: { name: focusReadyEvent, visibility: 'story' } },
    },
  }

  const expansionStrap = createViewportExpansionStrap({
    storyId: story.id,
    hostId: `${hostId}-host`,
    contentIds,
    viewByContentId,
    controlDirections,
    carousel,
    gestureEndEvent,
    keyboardToggleEvent,
    escapeEvent,
    openHostEvent,
    closeHostEvent,
    finishCloseHostEvent,
    focusReadyEvent,
    hostPartId,
  })

  return {
    ...story,
    state: {
      ...story.state,
      expandedContentId: null,
      closingContentId: null,
    },
    persos: [
      ...story.persos.map((perso) => expandedContents.find((content) => content.id === perso.id) ?? perso),
      host,
      ...navigationPersos,
    ],
    straps: { ...story.straps, [strapName]: expansionStrap },
    listen: [
      ...story.listen ?? [],
      { on: gestureEndEvent, straps: [strapName] },
      { on: keyboardToggleEvent, straps: [strapName] },
      { on: escapeEvent, straps: [strapName] },
      { on: focusReadyEvent, straps: [strapName] },
    ],
  }
}

/** Adds viewport expansion behavior to stories and locks their scene scrollports. */
export function addViewportExpansionToScene(scene: SceneDoc<string>): SceneDoc<string> {
  const stories = Object.fromEntries(Object.entries(scene.stories).map(([storyId, story]) => [
    storyId,
    addViewportExpansionToStory(story),
  ]))
  const hasExpansion = Object.values(stories).some((story) => story.persos.some((perso) => perso.id.endsWith('-viewport-expansion-host')))
  if (!hasExpansion) return { ...scene, stories }

  return {
    ...scene,
    stories: Object.fromEntries(Object.entries(stories).map(([storyId, story]) => [
      storyId,
      {
        ...story,
        persos: story.persos.map((perso) => perso.type !== 'scroll-container' ? perso : {
          ...perso,
          actions: {
            ...perso.actions,
            [VIEWPORT_EXPANSION_SCROLL_LOCK_EVENT]: {
              className: { add: 'elce-viewport-scroll-locked' },
              attr: { 'aria-hidden': 'true', inert: true },
            },
            [VIEWPORT_EXPANSION_SCROLL_UNLOCK_EVENT]: {
              className: { remove: 'elce-viewport-scroll-locked' },
              attr: { 'aria-hidden': 'false', inert: false },
            },
          },
        }),
      },
    ])),
    listen: [
      ...scene.listen ?? [],
      {
        on: VIEWPORT_EXPANSION_SCROLL_LOCK_REQUEST_EVENT,
        emit: [{ name: VIEWPORT_EXPANSION_SCROLL_LOCK_EVENT, visibility: 'scene' }],
      },
      {
        on: VIEWPORT_EXPANSION_SCROLL_UNLOCK_REQUEST_EVENT,
        emit: [{ name: VIEWPORT_EXPANSION_SCROLL_UNLOCK_EVENT, visibility: 'scene' }],
      },
    ],
  }
}

/** Tells Carousel which scene persos can occupy the viewport projection. */
export function isViewportExpansionPerso(perso: PersoDoc<string>): perso is ViewportExpansionPersoDoc {
  return viewportExpansionContentKind(perso) !== undefined
}

/** Builds one move action and its presentation state for a viewport content perso. */
function createContentMoveAction(
  target: string,
  kind: ViewportExpansionContentKind,
  expanded: boolean,
): Readonly<Record<string, unknown>> {
  const className = expanded
    ? { add: 'elce-viewport-content--expanded' }
    : { remove: 'elce-viewport-content--expanded' }
  const attr = {
    [VIEWPORT_EXPANSION_CONTENT_ATTR]: kind,
    ...(kind === 'image' ? {
      role: 'button',
      tabindex: expanded ? '-1' : '0',
      'aria-label': expanded ? 'Réduire l’image' : 'Agrandir l’image',
      'aria-pressed': expanded ? 'true' : 'false',
      draggable: false,
    } : {
      role: 'group',
      tabindex: expanded ? '-1' : '0',
    }),
  }
  return {
    move: {
      target,
      reparent: true,
      transition: { duration: ELCE_VIEWPORT_EXPANSION_DURATION_MS, ease: 'outCubic' },
    },
    className,
    attr,
  }
}

/** Returns the initial accessibility attributes for one expandable content kind. */
function initialContentAttributes(kind: ViewportExpansionContentKind): Readonly<Record<string, string | boolean>> {
  if (kind === 'image') {
    return {
      [VIEWPORT_EXPANSION_CONTENT_ATTR]: kind,
      role: 'button',
      tabindex: '0',
      'aria-label': 'Agrandir l’image',
      'aria-pressed': 'false',
      draggable: false,
    }
  }
  return { [VIEWPORT_EXPANSION_CONTENT_ATTR]: kind }
}

/** Resolves the feature kind from a scene persona's existing component or graph marker. */
function viewportExpansionContentKind(perso: PersoDoc<string>): ViewportExpansionContentKind | undefined {
  if (perso.type === 'img') return 'image'
  if (perso.type === 'layout' && asRecord(asRecord(perso.initial).attr)[VIEWPORT_EXPANSION_CONTENT_ATTR] === 'graph') return 'graph'
  return undefined
}

/** Keeps existing keydown emit rules when a scene persona gains viewport commands. */
function asEventRules(value: unknown): readonly unknown[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

/** Names one Carousel view move triggered only while its viewport is expanded. */
export function carouselViewExpandedEvent(storyId: string, bdcId: string): string {
  return `${storyId}:viewport:carousel:${bdcId}:expanded`
}

/** Names one Carousel view return triggered only while its viewport is expanded. */
export function carouselViewCollapsedEvent(storyId: string, bdcId: string): string {
  return `${storyId}:viewport:carousel:${bdcId}:collapsed`
}

/** Names the Carousel view used to update the expanded navigation edge controls. */
export function carouselViewportCurrentEvent(storyId: string, bdcId: string): string {
  return `${storyId}:viewport:carousel:${bdcId}:current`
}

/** Builds a pointer capture that measures the movement from one pointer gesture. */
function createPointerGestureRule(sourceId: string, endEventName: string) {
  return {
    event: { name: `${endEventName}:start`, data: { sourceId }, visibility: 'story' as const },
    capture: {
      stateScope: 'story' as const,
      trackOn: ['pointermove'],
      endOn: ['pointerup'],
      initCaptureState: () => ({ deltaX: 0, deltaY: 0 }),
      trackCommand: ({ sample, captureState }: {
        readonly sample: Readonly<Record<string, unknown>>
        readonly captureState: Readonly<Record<string, unknown>>
      }) => ({
        captureState: {
          deltaX: readNumber(captureState.deltaX) + readNumber(sample.movementX),
          deltaY: readNumber(captureState.deltaY) + readNumber(sample.movementY),
        },
      }),
      endEmit: { name: endEventName, data: { sourceId }, visibility: 'story' as const },
    },
  }
}

/** Creates accessible Carousel navigation buttons that use the existing selection event. */
function createCarouselNavigationPersos(
  storyId: string,
  hostId: string,
  carousel: ViewportExpansionCarousel,
  gestureEndEvent: string,
  escapeEvent: string,
): readonly PersoDoc<string>[] {
  return (['previous', 'next'] as const).map((direction) => {
    const previousDirection = direction === 'previous'
    const buttonId = `${hostId}-${direction}`
    const currentActions = Object.fromEntries(carousel.views.map((view, index) => [
      carouselViewportCurrentEvent(storyId, view.bdcId),
      {
        attr: {
          type: 'button',
          disabled: previousDirection ? index === 0 : index === carousel.views.length - 1,
        },
      },
    ]))
    return {
      id: buttonId,
      type: 'tag',
      initial: {
        tag: 'button',
        content: previousDirection ? '‹' : '›',
        className: `elce-viewport-expansion__arrow elce-viewport-expansion__arrow--${direction}`,
        attr: {
          type: 'button',
          'aria-label': previousDirection ? 'Vue précédente' : 'Vue suivante',
          disabled: true,
        },
        move: { target: `${hostId}:${direction}` },
      },
      emit: {
        pointerdown: createPointerGestureRule(buttonId, gestureEndEvent),
        keydown: [
          { keyCode: 'Enter', preventDefault: true, event: { name: carousel.selectionEvent, data: { direction }, visibility: 'story' } },
          { keyCode: 'Space', preventDefault: true, event: { name: carousel.selectionEvent, data: { direction }, visibility: 'story' } },
          { keyCode: 'Escape', preventDefault: true, event: { name: escapeEvent, visibility: 'story' } },
        ],
      },
      actions: {
        ...currentActions,
        [`${storyId}:viewport:carousel:close`]: { attr: { type: 'button', disabled: true } },
      },
    } satisfies PersoDoc<string>
  })
}

/** Resolves tap, swipe, keyboard toggle, and Escape through the owning story's strap. */
function createViewportExpansionStrap(input: Readonly<{
  storyId: string
  hostId: string
  contentIds: ReadonlySet<string>
  viewByContentId: ReadonlyMap<string, ViewportExpansionCarouselView>
  controlDirections: ReadonlyMap<string, 'previous' | 'next'>
  carousel?: ViewportExpansionCarousel
  gestureEndEvent: string
  keyboardToggleEvent: string
  escapeEvent: string
  openHostEvent: string
  closeHostEvent: string
  finishCloseHostEvent: string
  focusReadyEvent: string
  hostPartId: string
}>): StrapFunction {
  return ({ event, state }) => {
    const expandedContentId = typeof state.expandedContentId === 'string' ? state.expandedContentId : undefined
    const closingContentId = typeof state.closingContentId === 'string' ? state.closingContentId : undefined
    const sourceId = typeof event.data?.sourceId === 'string' ? event.data.sourceId : undefined
    const keyboardContentId = typeof event.data?.contentPersoId === 'string' ? event.data.contentPersoId : undefined

    if (event.name === input.focusReadyEvent) {
      if (expandedContentId !== undefined || closingContentId === undefined) return undefined
      const contentId = closingContentId
      return {
        update: { closingContentId: null },
        events: [
          { name: input.finishCloseHostEvent, visibility: 'story' },
          { name: VIEWPORT_EXPANSION_SCROLL_UNLOCK_REQUEST_EVENT, visibility: 'scene' },
          { name: viewportFocusEvent(input.storyId, contentId), visibility: 'story' },
          ...(input.carousel?.automatic !== true || input.carousel === undefined || state.manualCarouselSelection === true
            ? []
            : [{ name: TRACK_EVENT_ACTIVATE, data: { trackIds: [input.carousel.trackId] }, visibility: 'scene' as const }]),
        ],
      }
    }

    if (event.name === input.escapeEvent) {
      return expandedContentId === undefined
        ? undefined
        : closeExpansion(expandedContentId, expandedCardId(expandedContentId), input)
    }

    if (event.name === input.keyboardToggleEvent) {
      if (keyboardContentId === undefined || !input.contentIds.has(keyboardContentId)) return undefined
      if (expandedContentId === keyboardContentId) {
        return closeExpansion(keyboardContentId, expandedCardId(keyboardContentId), input)
      }
      if (expandedContentId !== undefined || (closingContentId !== undefined && closingContentId !== keyboardContentId)) return undefined
      return openExpansion(keyboardContentId, input)
    }

    if (event.name !== input.gestureEndEvent || sourceId === undefined) return undefined
    const captureState = asRecord(event.data?.captureState)
    const deltaX = readNumber(captureState.deltaX)
    const deltaY = readNumber(captureState.deltaY)
    const horizontalSwipe = Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY)
    if (horizontalSwipe) {
      if (expandedContentId === undefined || input.carousel === undefined) return undefined
      const direction = deltaX < 0 ? 'next' : 'previous'
      return { events: [{ name: input.carousel.selectionEvent, data: { direction }, visibility: 'story' }] }
    }

    if (Math.abs(deltaX) >= TAP_TOLERANCE_PX || Math.abs(deltaY) >= TAP_TOLERANCE_PX) return undefined
    const controlDirection = input.controlDirections.get(sourceId)
    if (controlDirection !== undefined) {
      if (expandedContentId === undefined) {
        return closingContentId === undefined ? undefined : openExpansion(closingContentId, input)
      }
      return input.carousel === undefined
        ? undefined
        : { events: [{ name: input.carousel.selectionEvent, data: { direction: controlDirection }, visibility: 'story' }] }
    }

    if (expandedContentId !== undefined) {
      return sourceId === input.hostId || sourceId === expandedContentId
        ? closeExpansion(expandedContentId, expandedCardId(expandedContentId), input)
        : undefined
    }
    if (closingContentId !== undefined) {
      return sourceId === input.hostId || sourceId === closingContentId
        ? openExpansion(closingContentId, input)
        : undefined
    }
    return input.contentIds.has(sourceId) ? openExpansion(sourceId, input) : undefined
  }

  function expandedCardId(contentId: string): string | undefined {
    return input.viewByContentId.get(contentId)?.bdcId
  }
}

/** Opens one content perso and records the selected Carousel view when applicable. */
function openExpansion(
  contentId: string,
  input: Parameters<typeof createViewportExpansionStrap>[0],
): StrapRuntimeOutput {
  const view = input.viewByContentId.get(contentId)
  const events = [
    { name: contentOpenEvent(input.storyId, contentId), visibility: 'story' as const },
    { name: input.openHostEvent, visibility: 'story' as const },
    { name: VIEWPORT_EXPANSION_SCROLL_LOCK_REQUEST_EVENT, visibility: 'scene' as const },
    ...(view === undefined ? [] : [{ name: carouselViewportCurrentEvent(input.storyId, view.bdcId), visibility: 'story' as const }]),
    ...(input.carousel?.automatic !== true || input.carousel === undefined
      ? []
      : [{ name: TRACK_EVENT_DEACTIVATE, data: { trackIds: [input.carousel.trackId] }, visibility: 'scene' as const }]),
  ]
  return {
    update: {
      expandedContentId: contentId,
      closingContentId: null,
      ...(view === undefined ? {} : { activeCardBdcId: view.bdcId }),
    },
    events,
  }
}

/** Closes one content perso, restores focus, and resumes automatic Carousel playback when allowed. */
function closeExpansion(
  contentId: string,
  cardBdcId: string | undefined,
  input: Parameters<typeof createViewportExpansionStrap>[0],
): StrapRuntimeOutput {
  return {
    update: { expandedContentId: null, closingContentId: contentId },
    events: [
      { name: contentCloseEvent(input.storyId, contentId), visibility: 'story' as const },
      { name: input.closeHostEvent, visibility: 'story' as const },
      ...(cardBdcId === undefined ? [] : [{ name: `${input.storyId}:viewport:carousel:close`, visibility: 'story' as const }]),
    ],
  }
}

/** Returns one viewport content source event identity. */
function contentOpenEvent(storyId: string, contentId: string): string {
  return `${storyId}:viewport:content:${contentId}:open`
}

/** Returns one viewport content return event identity. */
function contentCloseEvent(storyId: string, contentId: string): string {
  return `${storyId}:viewport:content:${contentId}:close`
}

/** Names the focus restoration emitted after the content return motion settles. */
function viewportFocusEvent(storyId: string, contentId: string): string {
  return `${storyId}:viewport:content:${contentId}:focus`
}

/** Reads one move target without changing the authored source placement. */
function readMoveTarget(move: unknown, contentId: string): string {
  if (typeof move === 'string') return move
  const target = asRecord(move).target
  if (typeof target === 'string') return target
  throw new Error(`Le perso ${contentId} n’a pas de cible de retour résolue.`)
}

/** Reads an author or runtime record without accepting arrays or null. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Reads one finite numeric movement sample. */
function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

import type { AuthorRecord, PersoDoc, SceneDoc, StoryDoc } from 'codplay/scene/types'
import { TRACK_EVENT_ACTIVATE, TRACK_EVENT_DEACTIVATE } from 'codplay/runtime/player'
import type { ElceResolvedPlayerSettings } from '../../domain/editor-settings/editor-settings-types'
import {
  carouselViewCollapsedEvent,
  carouselViewExpandedEvent,
  carouselViewportCurrentEvent,
  contentCloseEvent,
  contentOpenEvent,
  ELCE_VIEWPORT_EXPANSION_RUNTIME_KEY,
  initializeViewportGestureCapture,
  trackViewportGesture,
  viewportFocusEvent,
  viewportExpansionStrap,
  VIEWPORT_EXPANSION_CONTENT_ATTR,
  VIEWPORT_EXPANSION_SCROLL_LOCK_EVENT,
  VIEWPORT_EXPANSION_SCROLL_LOCK_REQUEST_EVENT,
  VIEWPORT_EXPANSION_SCROLL_UNLOCK_EVENT,
  VIEWPORT_EXPANSION_SCROLL_UNLOCK_REQUEST_EVENT,
} from '../scene-functions/viewport-expansion'

export {
  carouselViewCollapsedEvent,
  carouselViewExpandedEvent,
  carouselViewportCurrentEvent,
  VIEWPORT_EXPANSION_CONTENT_ATTR,
  VIEWPORT_EXPANSION_SCROLL_LOCK_EVENT,
  VIEWPORT_EXPANSION_SCROLL_UNLOCK_EVENT,
} from '../scene-functions/viewport-expansion'

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
  settings: ElceResolvedPlayerSettings['interactions']['viewportExpansion'],
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
      [openEvent]: createContentMoveAction(hostPartId, kind, true, settings),
      [closeEvent]: createContentMoveAction(sourceTarget, kind, false, settings),
      [focusEvent]: { htmlElementMethod: ['focus', 'preventscroll'] },
    }

    if (view !== undefined) {
      actions[carouselViewExpandedEvent(story.id, view.bdcId)] = createContentMoveAction(hostPartId, kind, true, settings)
      actions[carouselViewCollapsedEvent(story.id, view.bdcId)] = createContentMoveAction(sourceTarget, kind, false, settings)
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
      style: { opacity: 1 },
      markup: `<div id="${hostId}-frame" class="elce-viewport-expansion-host__frame"><!-- data-part="${hostPartId}" --><!-- data-part="${hostId}:previous" --><!-- data-part="${hostId}:next" --></div>`,
    },
    actions: {
      [openHostEvent]: {
        className: {
          add: 'elce-viewport-expansion-host--open',
          remove: 'elce-viewport-expansion-host--closed elce-viewport-expansion-host--closing',
        },
        style: { opacity: 1 },
        attr: { 'aria-hidden': 'false', inert: false },
        htmlElementMethod: ['focus', 'preventscroll'],
      },
      [closeHostEvent]: {
        className: { add: 'elce-viewport-expansion-host--closing', remove: 'elce-viewport-expansion-host--open' },
        style: {
          opacity: {
            from: 1,
            to: 0,
            duration: settings.backdropClose.durationMs,
            ease: settings.backdropClose.ease,
          },
        },
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

  return {
    ...story,
    state: {
      ...story.state,
      expandedContentId: null,
      closingContentId: null,
      [ELCE_VIEWPORT_EXPANSION_RUNTIME_KEY]: {
        storyId: story.id,
        hostId: `${hostId}-host`,
        ...(carousel === undefined ? {} : {
          previousControlId: `${hostId}-previous`,
          nextControlId: `${hostId}-next`,
        }),
        contentIds: [...contentIds],
        views: [...viewByContentId].map(([persoId, view]) => ({ persoId, bdcId: view.bdcId })),
        ...(carousel === undefined ? {} : {
          carousel: {
            selectionEvent: carousel.selectionEvent,
            automatic: carousel.automatic,
            trackId: carousel.trackId,
            trackActivateEvent: TRACK_EVENT_ACTIVATE,
            trackDeactivateEvent: TRACK_EVENT_DEACTIVATE,
          },
        }),
        gestureEndEvent,
        keyboardToggleEvent,
        escapeEvent,
        openHostEvent,
        closeHostEvent,
        finishCloseHostEvent,
        focusReadyEvent,
      },
    },
    persos: [
      ...story.persos.map((perso) => expandedContents.find((content) => content.id === perso.id) ?? perso),
      host,
      ...navigationPersos,
    ],
    straps: { ...story.straps, [strapName]: viewportExpansionStrap },
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
export function addViewportExpansionToScene(
  scene: SceneDoc<string>,
  settings: ElceResolvedPlayerSettings['interactions']['viewportExpansion'],
): SceneDoc<string> {
  const stories = Object.fromEntries(Object.entries(scene.stories).map(([storyId, story]) => [
    storyId,
    addViewportExpansionToStory(story, settings),
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
  settings: ElceResolvedPlayerSettings['interactions']['viewportExpansion'],
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
      transition: { duration: settings.durationMs, ease: settings.moveEase },
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

/** Builds a pointer capture that measures the movement from one pointer gesture. */
function createPointerGestureRule(sourceId: string, endEventName: string) {
  return {
    event: { name: `${endEventName}:start`, data: { sourceId }, visibility: 'story' as const },
    capture: {
      stateScope: 'story' as const,
      trackOn: ['pointermove'],
      endOn: ['pointerup'],
      initCaptureState: initializeViewportGestureCapture,
      trackCommand: trackViewportGesture,
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

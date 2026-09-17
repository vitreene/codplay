import type { SceneDoc } from 'codplay/scene/types'
import type {
  PlannedStrapOccurrence,
  StrapEvent,
  StrapFunction,
  StrapReturnValue,
  StrapStep,
} from 'codplay/runtime/player'
import {
  EVENTS_ACTION_OFFSET_MS,
  EVENTS_ANIMATION_OFFSET_MS,
  EVENTS_ARROW_OFFSET_MS,
  EVENTS_DOWN,
  EVENTS_EVENT_OFFSET_MS,
  EVENTS_FRAME_DURATION_MS,
  EVENTS_FRAME_EVENTS,
  EVENTS_FRAME_ONE_ID,
  EVENTS_FRAME_STORY_IDS,
  EVENTS_LIGHT_DELAY_MS,
  EVENTS_UP,
  createEventsAnimationContexts,
  type EventsAnimationContext,
  type EventsAnimationContexts,
  type EventsFrameEventNames,
  type EventsFrameStoryId,
} from './constants'
import { createEventsAnimationPersos } from './animation-stories'

type EventsPerso = SceneDoc['stories']['main']['persos'][number]
type EventsStory = SceneDoc['stories'][string]

type FrameRowDefinition = Readonly<{
  id: string
  text: string
  tag?: 'p' | 'code'
  arrow?: 'barrier' | 'signal'
  textInitialOpacity?: number
  arrowInitialOpacity?: number
  textActions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
  arrowActions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}>

type FrameDispatchMode = 'barrier' | 'distribution' | 'interactive' | 'delayed'

/** Complete authored content and event behavior for one explanatory frame. */
type FrameDefinition = Readonly<{
  storyId: EventsFrameStoryId
  number: string
  title: string
  summary: string
  animation: EventsAnimationContext
  rows: readonly FrameRowDefinition[]
  dispatchMode: FrameDispatchMode
  scheduledUp: boolean
  buttons: boolean
}>

/** Returns a simple opacity tween that reveals one authored explanation. */
function revealAction(): Readonly<Record<string, unknown>> {
  return { style: { opacity: { from: 0, to: 1, duration: 300, ease: 'outCubic' } } }
}

/** Returns a simple opacity tween that reveals one frame arrow. */
function revealArrowAction(): Readonly<Record<string, unknown>> {
  return {
    style: {
      opacity: { from: 0, to: 1, duration: 300, ease: 'outCubic' },
      translateX: { from: -32, to: 0, duration: 300, ease: 'outCubic' },
      scaleX: 1.55,
    },
  }
}

/** Creates the four frame definitions consumed by the story factory. */
export function createEventsFrameDefinitions(
  animationContexts: EventsAnimationContexts = createEventsAnimationContexts(),
): readonly FrameDefinition[] {
  const frameOne = EVENTS_FRAME_EVENTS[EVENTS_FRAME_ONE_ID]
  const frameTwo = EVENTS_FRAME_EVENTS[EVENTS_FRAME_STORY_IDS[1]]

  return [
    {
      storyId: EVENTS_FRAME_ONE_ID,
      animation: animationContexts[EVENTS_FRAME_ONE_ID],
      number: '01',
      title: 'Un event est émis',
      summary: 'Une émission devient le point de départ d’une action.',
      dispatchMode: 'barrier',
      scheduledUp: true,
      buttons: false,
      rows: [
        {
          id: 'event',
          text: 'À 2 secondes, l’event « up » est émis.',
          textInitialOpacity: 0,
          textActions: { [EVENTS_UP]: revealAction() },
        },
        {
          id: 'event-name',
          text: 'event : up',
          tag: 'code',
          textInitialOpacity: 0,
          textActions: { [frameOne.eventMessage]: revealAction() },
        },
        {
          id: 'barrier-action',
          text: 'action up : { rotate: 70deg }',
          tag: 'code',
          arrow: 'barrier',
          textInitialOpacity: 0,
          arrowInitialOpacity: 0,
          textActions: { [frameOne.actionBarrier]: revealAction() },
          arrowActions: { [frameOne.arrowBarrier]: revealArrowAction() },
        },
      ],
    },
    {
      storyId: EVENTS_FRAME_STORY_IDS[1],
      animation: animationContexts[EVENTS_FRAME_STORY_IDS[1]],
      number: '02',
      title: 'Un event se distribue',
      summary: 'Le même event atteint plusieurs animations.',
      dispatchMode: 'distribution',
      scheduledUp: true,
      buttons: false,
      rows: [
        {
          id: 'event',
          text: 'event : up',
          tag: 'code',
          textInitialOpacity: 0,
          textActions: { [EVENTS_UP]: revealAction() },
        },
        {
          id: 'signal-action',
          text: 'perso feu — action up : { color: rouge }',
          tag: 'code',
          arrow: 'signal',
          textInitialOpacity: 0,
          arrowInitialOpacity: 0,
          textActions: { [frameTwo.actionSignal]: revealAction() },
          arrowActions: { [frameTwo.arrowSignal]: revealArrowAction() },
        },
        {
          id: 'barrier-action',
          text: 'perso barrière — action up : { rotate: 70deg }',
          tag: 'code',
          arrow: 'barrier',
          textInitialOpacity: 0,
          arrowInitialOpacity: 0,
          textActions: { [frameTwo.actionBarrier]: revealAction() },
          arrowActions: { [frameTwo.arrowBarrier]: revealArrowAction() },
        },
      ],
    },
    {
      storyId: EVENTS_FRAME_STORY_IDS[2],
      animation: animationContexts[EVENTS_FRAME_STORY_IDS[2]],
      number: '03',
      title: 'Les boutons émettent les events',
      summary: 'Les contrôles produisent up et down ; les animations écoutent.',
      dispatchMode: 'interactive',
      scheduledUp: false,
      buttons: true,
      rows: [
        {
          id: 'event',
          text: 'event : en attente',
          tag: 'code',
          textActions: {
            [EVENTS_UP]: { content: 'event : up', style: { color: '#b42318' } },
            [EVENTS_DOWN]: { content: 'event : down', style: { color: '#176b3a' } },
          },
        },
        {
          id: 'barrier-action',
          text: 'action up / down : { rotate: 70deg / 0deg }',
          tag: 'code',
          arrow: 'barrier',
          textActions: {
            [EVENTS_UP]: { content: 'action up : { rotate: 70deg }' },
            [EVENTS_DOWN]: { content: 'action down : { rotate: 0deg }' },
          },
        },
        {
          id: 'signal-action',
          text: 'action up / down : { color: rouge / vert }',
          tag: 'code',
          arrow: 'signal',
          textActions: {
            [EVENTS_UP]: { content: 'action up : { color: rouge }' },
            [EVENTS_DOWN]: { content: 'action down : { color: vert }' },
          },
        },
      ],
    },
    {
      storyId: EVENTS_FRAME_STORY_IDS[3],
      animation: animationContexts[EVENTS_FRAME_STORY_IDS[3]],
      number: '04',
      title: 'Les events peuvent être différés',
      summary: 'Un strap séquence les actions du feu avec un délai d’une seconde.',
      dispatchMode: 'delayed',
      scheduledUp: false,
      buttons: true,
      rows: [
        {
          id: 'event',
          text: 'event : up',
          tag: 'code',
          textActions: {
            [EVENTS_UP]: revealAction(),
            [EVENTS_DOWN]: { content: 'event : down' },
          },
        },
        {
          id: 'barrier-action',
          text: 'action up / down : { rotate: 70deg / 0deg }',
          tag: 'code',
          arrow: 'barrier',
          textActions: {
            [EVENTS_UP]: { content: 'action up : { rotate: 70deg }' },
            [EVENTS_DOWN]: { content: 'action down : { rotate: 0deg }' },
          },
        },
        {
          id: 'signal-action',
          text: 'action down → changing → up',
          tag: 'code',
          arrow: 'signal',
          textActions: {
            [EVENTS_UP]: { content: 'action changing → up : { color: orange → rouge }' },
            [EVENTS_DOWN]: { content: 'action down : { color: vert }' },
          },
        },
      ],
    },
  ]
}

/** Creates all frame stories without changing the shared V2 layout. */
export function createEventsFrameStories(
  animationContexts: EventsAnimationContexts = createEventsAnimationContexts(),
): Readonly<Record<EventsFrameStoryId, EventsStory>> {
  return Object.fromEntries(createEventsFrameDefinitions(animationContexts).map((definition) => [
    definition.storyId,
    createEventsFrameStory(definition),
  ])) as Record<EventsFrameStoryId, EventsStory>
}

/** Creates one story-cadre with its explanatory persos and local event circuit. */
function createEventsFrameStory(definition: FrameDefinition): EventsStory {
  const events = EVENTS_FRAME_EVENTS[definition.storyId]
  const prefix = definition.storyId
  const startStrap = `${prefix}:start`
  const dispatchStrap = `${prefix}:dispatch`

  return {
    id: definition.storyId,
    straps: {
      [startStrap]: createFrameStartStrap(definition, events),
      [dispatchStrap]: createFrameDispatchStrap(definition),
    },
    listen: [
      { on: events.enter, active: true, reset: true, straps: [startStrap] },
      { on: events.leave, active: false },
      { on: events.reset, reset: true },
      { on: EVENTS_UP, straps: [dispatchStrap] },
      { on: EVENTS_DOWN, straps: [dispatchStrap] },
    ],
    persos: [
      createFrameRootPerso(definition, events),
      ...createEventsAnimationPersos(definition.animation, {
        includeSignal: definition.storyId !== EVENTS_FRAME_ONE_ID,
      }),
      ...createFrameHeaderPersos(definition),
      ...definition.rows.flatMap((row) => createFrameRowPersos(definition, row)),
      ...(definition.buttons ? createButtonPersos(definition.storyId) : []),
    ],
  }
}

/** Creates the stable number, title and summary shown above one frame's rows. */
function createFrameHeaderPersos(definition: FrameDefinition): readonly EventsPerso[] {
  const prefix = definition.storyId
  return [
    {
      id: `${prefix}-number`,
      type: 'tag',
      initial: {
        tag: 'span',
        content: definition.number,
        className: 'events-frame__number',
        move: { target: `${prefix}:number` },
      },
      actions: {},
    },
    {
      id: `${prefix}-title`,
      type: 'tag',
      initial: {
        tag: 'h2',
        content: definition.title,
        className: 'events-frame__title',
        move: { target: `${prefix}:title` },
      },
      actions: {},
    },
    {
      id: `${prefix}-summary`,
      type: 'tag',
      initial: {
        tag: 'p',
        content: definition.summary,
        className: 'events-frame__summary',
        move: { target: `${prefix}:summary` },
      },
      actions: {},
    },
  ]
}

/** Creates the frame root that owns intro and outro presentation actions. */
function createFrameRootPerso(
  definition: FrameDefinition,
  events: EventsFrameEventNames,
): EventsPerso {
  const prefix = definition.storyId
  const initialVisibility = definition.storyId === EVENTS_FRAME_ONE_ID
    ? 'events-frame--visible'
    : 'events-frame--hidden'

  return {
    id: `${prefix}-root`,
    type: 'layout',
    initial: {
      move: { target: 'events:demo:frame' },
      className: `events-frame-host ${initialVisibility}`,
      markup: createFrameMarkup(definition),
    },
    actions: {
      [events.intro]: {
        className: { add: 'events-frame--visible', remove: 'events-frame--hidden' },
        style: {
          opacity: { from: 0, to: 1, duration: 280, ease: 'outCubic' },
          translateX: { from: 28, to: 0, duration: 280, ease: 'outCubic' },
        },
      },
      [events.outro]: {
        className: { add: 'events-frame--hidden', remove: 'events-frame--visible' },
      },
    },
  }
}

/** Creates the markup slots owned by one frame story. */
function createFrameMarkup(definition: FrameDefinition): string {
  const prefix = definition.storyId
  const rows = definition.rows.map((row) => `
          <div id="${prefix}-${row.id}-row" class="events-frame__row">
            <!-- data-part="${prefix}:${row.id}:text" -->
            <!-- data-part="${prefix}:${row.id}:arrow" -->
          </div>`).join('')
  const buttons = definition.buttons ? `
          <div id="${prefix}-buttons" class="events-frame__buttons">
            <div id="${prefix}-up-button-slot" data-part="${prefix}:button:up"></div>
            <div id="${prefix}-down-button-slot" data-part="${prefix}:button:down"></div>
          </div>` : ''

  return `
        <section id="${prefix}-markup" class="events-frame">
          <div id="${prefix}-copy" class="events-frame__copy">
            <div id="${prefix}-heading" class="events-frame__heading">
              <div id="${prefix}-number-slot" data-part="${prefix}:number"></div>
              <div id="${prefix}-title-slot" data-part="${prefix}:title"></div>
            </div>
            <div id="${prefix}-summary-slot" data-part="${prefix}:summary"></div>
            <div id="${prefix}-rows" class="events-frame__rows">${rows}
            </div>${buttons}
          </div>
        </section>`
}

/** Creates the number, title, summary, messages and arrows for one frame. */
function createFrameRowPersos(
  definition: FrameDefinition,
  row: FrameRowDefinition,
): readonly EventsPerso[] {
  const prefix = definition.storyId
  const textInitialOpacity = row.textInitialOpacity ?? 1
  const arrowInitialOpacity = row.arrowInitialOpacity ?? (row.arrow === undefined ? 0 : 1)
  const textTag = row.tag ?? 'p'
  const arrowContent = row.arrow === 'barrier' || row.arrow === 'signal' ? '⟶' : ''
  const arrowLabel = row.arrow === 'barrier' ? 'barrière' : row.arrow === 'signal' ? 'feu' : ''

  return [
    {
      id: `${prefix}-${row.id}-text`,
      type: 'tag',
      initial: {
        tag: textTag,
        content: row.text,
        className: `events-frame__message${textTag === 'code' ? ' events-frame__message--code' : ''}`,
        style: { opacity: textInitialOpacity },
        move: { target: `${prefix}:${row.id}:text` },
      },
      actions: row.textActions ?? {},
    },
    {
      id: `${prefix}-${row.id}-arrow`,
      type: 'tag',
      initial: {
        tag: 'span',
        content: arrowContent,
        className: `events-frame__arrow events-frame__arrow--${row.arrow ?? 'none'}`,
        attr: { 'aria-label': arrowLabel },
        style: { opacity: arrowInitialOpacity },
        move: { target: `${prefix}:${row.id}:arrow` },
      },
      actions: row.arrowActions ?? {},
    },
  ]
}

/** Creates the two public buttons that emit story-scoped up/down events. */
function createButtonPersos(storyId: EventsFrameStoryId): readonly EventsPerso[] {
  const prefix = storyId
  return [
    {
      id: `${prefix}-button-up`,
      type: 'tag',
      initial: {
        tag: 'button',
        content: 'Lever',
        className: 'events-frame__button events-frame__button--up',
        attr: { type: 'button', 'aria-label': 'Lever' },
        move: { target: `${prefix}:button:up` },
      },
      emit: { click: [{ event: { name: EVENTS_UP, visibility: 'story' } }] },
      actions: {},
    },
    {
      id: `${prefix}-button-down`,
      type: 'tag',
      initial: {
        tag: 'button',
        content: 'Baisser',
        className: 'events-frame__button events-frame__button--down',
        attr: { type: 'button', 'aria-label': 'Baisser' },
        move: { target: `${prefix}:button:down` },
      },
      emit: { click: [{ event: { name: EVENTS_DOWN, visibility: 'story' } }] },
      actions: {},
    },
  ]
}

/** Plans the explanatory event sequence and the optional scheduled up event. */
function createFrameStartStrap(
  definition: FrameDefinition,
  events: EventsFrameEventNames,
): StrapFunction {
  return ({ context }) => {
    const animationEvents: readonly StrapEvent[] = [
      storyEventValue(definition.storyId, definition.animation.events.barrierShow),
      ...(definition.storyId === EVENTS_FRAME_ONE_ID
        ? []
        : [storyEventValue(definition.storyId, definition.animation.events.signalShow)]),
    ]
    const occurrences: readonly PlannedStrapOccurrence[] = [
      ...(definition.scheduledUp
        ? context.planned.wait(EVENTS_EVENT_OFFSET_MS, [
          storyEvent(definition.storyId, EVENTS_UP),
        ])
        : []),
      ...(definition.scheduledUp
        ? context.planned.wait(
          EVENTS_ARROW_OFFSET_MS,
          definition.storyId === EVENTS_FRAME_ONE_ID
            ? storyEvent(definition.storyId, events.eventMessage)
            : [
              storyEvent(definition.storyId, events.actionSignal),
              storyEvent(definition.storyId, events.arrowSignal),
            ],
        )
        : []),
      ...(definition.scheduledUp
        ? context.planned.wait(
          EVENTS_ACTION_OFFSET_MS,
          definition.storyId === EVENTS_FRAME_ONE_ID
            ? [
              storyEvent(definition.storyId, events.actionBarrier),
              storyEvent(definition.storyId, events.arrowBarrier),
            ]
            : [
              storyEvent(definition.storyId, events.actionBarrier),
              storyEvent(definition.storyId, events.arrowBarrier),
            ],
        )
        : []),
      ...(definition.scheduledUp
        ? context.planned.wait(
          EVENTS_ANIMATION_OFFSET_MS,
          storyEvent(definition.storyId, definition.animation.events.up),
        )
        : []),
      ...context.planned.wait(EVENTS_FRAME_DURATION_MS, storyEvent(definition.storyId, events.end)),
    ]
    return [
      { events: animationEvents },
      occurrences,
    ]
  }
}

/** Dispatches one frame command to its animation persos. */
function createFrameDispatchStrap(
  definition: FrameDefinition,
): StrapFunction {
  return ({ event, context }) => {
    if (event.name === EVENTS_UP && definition.scheduledUp) {
      return { events: [] }
    }

    const targetEvents: StrapStep[] = []
    if (event.name === EVENTS_UP) {
      targetEvents.push(storyEvent(definition.storyId, definition.animation.events.up))
      if (definition.dispatchMode === 'delayed') {
        targetEvents.push(storyEvent(definition.storyId, definition.animation.events.changing))
      }
      if (definition.dispatchMode !== 'barrier') {
        targetEvents.push(storyEvent(definition.storyId, definition.animation.events.signalShow))
      }
    }
    if (event.name === EVENTS_DOWN && (definition.dispatchMode === 'interactive' || definition.dispatchMode === 'delayed')) {
      targetEvents.push(storyEvent(definition.storyId, definition.animation.events.down))
      targetEvents.push(storyEvent(definition.storyId, definition.animation.events.signalShow))
    }

    const immediate: StrapReturnValue = { events: targetEvents.flatMap((step) => step.event === undefined ? [] : [step.event]) }
    if (definition.dispatchMode !== 'delayed' || event.name !== EVENTS_UP) return immediate

    return [
      immediate,
      context.planned.wait(
        EVENTS_LIGHT_DELAY_MS,
        storyEvent(definition.storyId, definition.animation.events.up),
      ),
    ]
  }
}

/** Creates one story-targeted event step for the owning frame story. */
function storyEvent(storyId: string, name: string): StrapStep {
  return {
    event: storyEventValue(storyId, name),
  }
}

/** Creates the event payload used by immediate and delayed story outputs. */
function storyEventValue(storyId: string, name: string): StrapEvent {
  return { name, storyId, visibility: 'story' }
}

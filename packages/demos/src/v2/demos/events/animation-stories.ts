import type { SceneDoc } from 'codplay/scene/types'
import {
  EVENTS_BARRIER_ROTATION_DURATION_MS,
  EVENTS_BARRIER_TARGET,
  EVENTS_SIGNAL_TRANSITION_DURATION_MS,
  EVENTS_SIGNAL_TARGET,
  type EventsAnimationContext,
} from './constants'

type EventsPerso = SceneDoc['stories']['main']['persos'][number]
type EventsSignalState = 'green' | 'orange' | 'red'

const BARRIER_IMAGE = '/assets/barrier/barriere.webp'
const PEDESTAL_IMAGE = '/assets/barrier/borne.webp'
const SIGNAL_GREEN_IMAGE = '/assets/barrier/feu-rouge-vert.webp'
const SIGNAL_ORANGE_IMAGE = '/assets/barrier/feu-rouge-orange.webp'
const SIGNAL_RED_IMAGE = '/assets/barrier/feu-rouge-rouge.webp'
const SIGNAL_IMAGES: Readonly<Record<EventsSignalState, Readonly<{ src: string; alt: string }>>> = {
  green: { src: SIGNAL_GREEN_IMAGE, alt: 'Feu de signalisation vert' },
  orange: { src: SIGNAL_ORANGE_IMAGE, alt: 'Feu de signalisation orange' },
  red: { src: SIGNAL_RED_IMAGE, alt: 'Feu de signalisation rouge' },
}

/** Creates the image persos owned by one isolated frame story. */
export function createEventsAnimationPersos(
  context: EventsAnimationContext,
  options: Readonly<{
    includeSignal?: boolean
    initialBarrierState?: 'up' | 'down'
    barrierRotationDurationMs?: number
    initialSignalState?: EventsSignalState
    signalRedEvent?: 'down' | 'red'
  }> = {},
): readonly EventsPerso[] {
  const persos: EventsPerso[] = [
    createPedestalPerso(context),
    createBarrierArmPerso(context, options.initialBarrierState, options.barrierRotationDurationMs),
  ]
  if (options.includeSignal !== false) {
    persos.push(createSignalPerso(context, options.initialSignalState, options.signalRedEvent))
  }
  return persos
}

/** Creates the fixed pedestal image used as the barrier rotation reference. */
function createPedestalPerso(context: EventsAnimationContext): EventsPerso {
  return {
    id: `${context.frameId}-barrier-pedestal`,
    type: 'img',
    initial: {
      src: PEDESTAL_IMAGE,
      alt: 'Borne de la barrière',
      className: `events-barrier-pedestal events-animation-${context.index}`,
      style: { opacity: 0 },
      attr: { 'data-animation-context': String(context.index) },
      img: {
        className: 'events-barrier-pedestal__native',
        style: { width: '100%', height: '100%', objectFit: 'contain' },
        attr: { draggable: false },
      },
      move: { target: EVENTS_BARRIER_TARGET },
    },
    actions: {
      [context.events.barrierShow]: { style: { opacity: 1 } },
    },
  }
}

/** Creates the arm image whose transform origin is the gray pivot point. */
function createBarrierArmPerso(
  context: EventsAnimationContext,
  initialState: 'up' | 'down' = 'down',
  rotationDurationMs = EVENTS_BARRIER_ROTATION_DURATION_MS,
): EventsPerso {
  return {
    id: `${context.frameId}-barrier-arm`,
    type: 'img',
    initial: {
      src: BARRIER_IMAGE,
      alt: 'Barrière d’accès',
      className: `events-barrier-arm events-animation-${context.index}`,
      style: { rotate: initialState === 'up' ? 70 : 0, opacity: 0 },
      attr: { 'data-animation-context': String(context.index) },
      img: {
        className: 'events-barrier-arm__native',
        style: { width: '100%', height: '100%', objectFit: 'contain' },
        attr: { draggable: false },
      },
      move: { target: EVENTS_BARRIER_TARGET },
    },
    actions: {
      [context.events.barrierShow]: { style: { opacity: 1 } },
      [context.events.up]: {
        style: {
          rotate: { from: 0, to: 70, duration: rotationDurationMs, ease: 'inOutBack(1.7)' },
        },
      },
      [context.events.down]: {
        style: {
          rotate: { from: 70, to: 0, duration: rotationDurationMs, ease: 'inOutBack(1.7)' },
        },
      },
    },
  }
}

/** Creates one image perso whose source represents the current light state. */
function createSignalPerso(
  context: EventsAnimationContext,
  initialState: EventsSignalState = 'green',
  redEvent: 'down' | 'red' = 'down',
): EventsPerso {
  const initialSignal = SIGNAL_IMAGES[initialState]
  const redEventName = redEvent === 'red' ? context.events.red : context.events.down
  return {
    id: `${context.frameId}-signal-image`,
    type: 'img',
    initial: {
      src: initialSignal.src,
      alt: initialSignal.alt,
      className: `events-signal-image events-animation-${context.index}`,
      style: { opacity: 0 },
      attr: { 'data-animation-context': String(context.index) },
      img: {
        className: 'events-signal-image__native',
        style: { width: '100%', height: '100%', objectFit: 'contain' },
        attr: { draggable: false },
      },
      move: { target: EVENTS_SIGNAL_TARGET },
    },
    actions: {
      [context.events.signalShow]: { style: { opacity: 1 } },
      [context.events.signalHide]: { style: { opacity: 0 } },
      [context.events.changing]: {
        src: SIGNAL_ORANGE_IMAGE,
        alt: 'Feu de signalisation orange',
        replace: { transition: 'fade-in', duration: EVENTS_SIGNAL_TRANSITION_DURATION_MS },
      },
      [context.events.up]: {
        src: SIGNAL_GREEN_IMAGE,
        alt: 'Feu de signalisation vert',
        replace: { transition: 'fade-in', duration: EVENTS_SIGNAL_TRANSITION_DURATION_MS },
      },
      [redEventName]: {
        src: SIGNAL_RED_IMAGE,
        alt: 'Feu de signalisation rouge',
        replace: { transition: 'fade-in', duration: EVENTS_SIGNAL_TRANSITION_DURATION_MS },
      },
    },
  }
}

import type { SceneDoc } from 'codplay/scene/types'
import {
  EVENTS_BARRIER_ROTATION_DURATION_MS,
  EVENTS_BARRIER_TARGET,
  EVENTS_SIGNAL_TARGET,
  type EventsAnimationContext,
} from './constants'

type EventsPerso = SceneDoc['stories']['main']['persos'][number]

const BARRIER_IMAGE = '/assets/barrier/barriere.webp'
const PEDESTAL_IMAGE = '/assets/barrier/borne.webp'
const SIGNAL_GREEN_IMAGE = '/assets/barrier/feu-rouge-vert.webp'
const SIGNAL_ORANGE_IMAGE = '/assets/barrier/feu-rouge-orange.webp'
const SIGNAL_RED_IMAGE = '/assets/barrier/feu-rouge-rouge.webp'

/** Creates the image persos owned by one isolated frame story. */
export function createEventsAnimationPersos(
  context: EventsAnimationContext,
  options: Readonly<{ includeSignal?: boolean }> = {},
): readonly EventsPerso[] {
  const persos: EventsPerso[] = [
    createPedestalPerso(context),
    createBarrierArmPerso(context),
  ]
  if (options.includeSignal !== false) persos.push(createSignalPerso(context))
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
function createBarrierArmPerso(context: EventsAnimationContext): EventsPerso {
  return {
    id: `${context.frameId}-barrier-arm`,
    type: 'img',
    initial: {
      src: BARRIER_IMAGE,
      alt: 'Barrière d’accès fermée',
      className: `events-barrier-arm events-animation-${context.index}`,
      style: { rotate: 0, opacity: 0 },
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
          rotate: { from: 0, to: 70, duration: EVENTS_BARRIER_ROTATION_DURATION_MS, ease: 'inOutBack(1.7)' },
        },
      },
      [context.events.down]: {
        style: {
          rotate: { from: 70, to: 0, duration: EVENTS_BARRIER_ROTATION_DURATION_MS, ease: 'inOutBack(1.7)' },
        },
      },
    },
  }
}

/** Creates one image perso whose source represents the current light state. */
function createSignalPerso(context: EventsAnimationContext): EventsPerso {
  return {
    id: `${context.frameId}-signal-image`,
    type: 'img',
    initial: {
      src: SIGNAL_GREEN_IMAGE,
      alt: 'Feu de signalisation vert',
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
      [context.events.down]: {
        src: SIGNAL_GREEN_IMAGE,
        alt: 'Feu de signalisation vert',
        replace: 'fade-in',
      },
      [context.events.changing]: {
        src: SIGNAL_ORANGE_IMAGE,
        alt: 'Feu de signalisation orange',
        replace: 'fade-in',
      },
      [context.events.up]: {
        src: SIGNAL_RED_IMAGE,
        alt: 'Feu de signalisation rouge',
        replace: 'fade-in',
      },
    },
  }
}

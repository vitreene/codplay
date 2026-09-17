import type { SceneDoc } from 'codplay/scene/types'
import {
  EVENTS_ANIMATIONS_RESET_EVENT,
  EVENTS_BARRIER_STORY_ID,
  EVENTS_BARRIER_TARGET,
  EVENTS_CHANGING,
  EVENTS_DOWN,
  EVENTS_SIGNAL_HIDE_EVENT,
  EVENTS_SIGNAL_SHOW_EVENT,
  EVENTS_SIGNAL_STORY_ID,
  EVENTS_SIGNAL_TARGET,
  EVENTS_UP,
} from './constants'

type EventsPerso = SceneDoc['stories']['main']['persos'][number]

const BARRIER_IMAGE = '/assets/barrier/barriere.webp'
const PEDESTAL_IMAGE = '/assets/barrier/borne.webp'
const SIGNAL_GREEN_IMAGE = '/assets/barrier/feu-rouge-vert.webp'
const SIGNAL_ORANGE_IMAGE = '/assets/barrier/feu-rouge-orange.webp'
const SIGNAL_RED_IMAGE = '/assets/barrier/feu-rouge-rouge.webp'

/** Creates the persistent story that owns the barrier pedestal and arm. */
export function createBarrierStory(): SceneDoc['stories'][string] {
  return {
    id: EVENTS_BARRIER_STORY_ID,
    listen: [{ on: EVENTS_ANIMATIONS_RESET_EVENT, reset: true }],
    persos: [createPedestalPerso(), createBarrierArmPerso()],
  }
}

/** Creates the fixed pedestal image used as the barrier rotation reference. */
function createPedestalPerso(): EventsPerso {
  return {
    id: 'events-barrier-pedestal',
    type: 'img',
    initial: {
      src: PEDESTAL_IMAGE,
      alt: 'Borne de la barrière',
      className: 'events-barrier-pedestal',
      img: {
        className: 'events-barrier-pedestal__native',
        style: { width: '100%', height: '100%', objectFit: 'contain' },
        attr: { draggable: false },
      },
      move: { target: EVENTS_BARRIER_TARGET },
    },
    actions: {},
  }
}

/** Creates the arm image whose transform origin is the gray pivot point. */
function createBarrierArmPerso(): EventsPerso {
  return {
    id: 'events-barrier-arm',
    type: 'img',
    initial: {
      src: BARRIER_IMAGE,
      alt: 'Barrière d’accès fermée',
      className: 'events-barrier-arm',
      style: { rotate: 0 },
      img: {
        className: 'events-barrier-arm__native',
        style: { width: '100%', height: '100%', objectFit: 'contain' },
        attr: { draggable: false },
      },
      move: { target: EVENTS_BARRIER_TARGET },
    },
    actions: {
      [EVENTS_UP]: {
        style: {
          rotate: { from: 0, to: 70, duration: 1_000, ease: 'inOutCubic' },
        },
      },
      [EVENTS_DOWN]: {
        style: {
          rotate: { from: 70, to: 0, duration: 1_000, ease: 'inOutCubic' },
        },
      },
    },
  }
}

/** Creates the persistent story that owns the replaceable traffic-light image. */
export function createSignalStory(): SceneDoc['stories'][string] {
  return {
    id: EVENTS_SIGNAL_STORY_ID,
    listen: [{ on: EVENTS_ANIMATIONS_RESET_EVENT, reset: true }],
    persos: [createSignalPerso()],
  }
}

/** Creates one image perso whose source represents the current light state. */
function createSignalPerso(): EventsPerso {
  return {
    id: 'events-signal-image',
    type: 'img',
    initial: {
      src: SIGNAL_GREEN_IMAGE,
      alt: 'Feu de signalisation vert',
      className: 'events-signal-image',
      style: { opacity: 0 },
      img: {
        className: 'events-signal-image__native',
        style: { width: '100%', height: '100%', objectFit: 'contain' },
        attr: { draggable: false },
      },
      move: { target: EVENTS_SIGNAL_TARGET },
    },
    actions: {
      [EVENTS_SIGNAL_SHOW_EVENT]: {
        style: { opacity: 1 },
      },
      [EVENTS_SIGNAL_HIDE_EVENT]: {
        style: { opacity: 0 },
      },
      [EVENTS_DOWN]: {
        src: SIGNAL_GREEN_IMAGE,
        alt: 'Feu de signalisation vert',
      },
      [EVENTS_CHANGING]: {
        src: SIGNAL_ORANGE_IMAGE,
        alt: 'Feu de signalisation orange',
      },
      [EVENTS_UP]: {
        src: SIGNAL_RED_IMAGE,
        alt: 'Feu de signalisation rouge',
      },
    },
  }
}

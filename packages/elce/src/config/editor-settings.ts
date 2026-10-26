import { CAROUSEL_TRANSITION } from './document-config'

/** Groups hidden editor defaults and presentation rules in one place. */
export const ELCE_EDITOR_SETTINGS = {
  revelation: {
    projectDefaults: {
      intro: CAROUSEL_TRANSITION.SWIPE_RIGHT,
      outro: CAROUSEL_TRANSITION.SWIPE_RIGHT,
    },
    transitionPairs: {
      [CAROUSEL_TRANSITION.CUT]: { intro: CAROUSEL_TRANSITION.CUT, outro: CAROUSEL_TRANSITION.CUT },
      [CAROUSEL_TRANSITION.FADE]: { intro: CAROUSEL_TRANSITION.FADE, outro: CAROUSEL_TRANSITION.FADE },
      [CAROUSEL_TRANSITION.SWIPE_LEFT]: { intro: CAROUSEL_TRANSITION.SWIPE_LEFT, outro: CAROUSEL_TRANSITION.SWIPE_LEFT },
      [CAROUSEL_TRANSITION.SWIPE_RIGHT]: { intro: CAROUSEL_TRANSITION.SWIPE_RIGHT, outro: CAROUSEL_TRANSITION.SWIPE_RIGHT },
      [CAROUSEL_TRANSITION.SWIPE_TOP]: { intro: CAROUSEL_TRANSITION.SWIPE_TOP, outro: CAROUSEL_TRANSITION.SWIPE_TOP },
      [CAROUSEL_TRANSITION.SWIPE_DOWN]: { intro: CAROUSEL_TRANSITION.SWIPE_DOWN, outro: CAROUSEL_TRANSITION.SWIPE_DOWN },
      [CAROUSEL_TRANSITION.ZOOM]: { intro: CAROUSEL_TRANSITION.ZOOM, outro: CAROUSEL_TRANSITION.ZOOM },
    },
    flux: {
      cardObservationZone: { threshold: 0 },
      graphObservation: {
        initial: 'enter',
        zone: { threshold: 0 },
      },
      imageEntrance: {
        initial: 'enter',
        zone: { threshold: 0 },
        once: true,
        restingTranslateX: '0%',
        fromTranslateX: '-112%',
        toTranslateX: '0%',
        duration: 1000,
        ease: 'outCubic',
      },
    },
    carousel: {
      generateDefaultOutro: true,
    },
  },
  player: {
    media: {
      fluxVideoVisibilityZone: { threshold: 0.75 },
    },
    progression: {
      pageCompletionObservation: {
        initial: 'enter',
        zone: { threshold: 0 },
        markerStyle: { display: 'block', width: '1px', height: '1px', marginTop: 'auto', opacity: 0 },
      },
    },
    navigation: {
      summaryDrawerMotion: {
        open: {
          opacity: { from: 0, to: 1, duration: 260, ease: 'outCubic' },
          translateX: { from: '-100%', to: '0%', duration: 260, ease: 'outCubic' },
        },
        close: {
          opacity: { from: 1, to: 0, duration: 260, ease: 'inCubic' },
          translateX: { from: '0%', to: '-100%', duration: 260, ease: 'inCubic' },
        },
      },
    },
    interactions: {
      viewportExpansion: {
        durationMs: 320,
        moveEase: 'outCubic',
        backdropOpacity: 0.92,
        backdropClose: { durationMs: 120, ease: 'outCubic' },
      },
    },
  },
} as const

import { REVELATION_TRANSITION_PAIRS, DEFAULT_PROJECT_REVELATION } from '../resources/revelation/revelation-config'

/** Groups hidden editor defaults and presentation rules in one place. */
export const ELCE_EDITOR_SETTINGS = {
  revelation: {
    projectDefaults: DEFAULT_PROJECT_REVELATION,
    transitionPairs: REVELATION_TRANSITION_PAIRS,
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

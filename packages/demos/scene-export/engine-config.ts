import {
  RIVE_ENGINE,
  RIVE_PRELOAD_STRATEGIES,
  THREEJS_CORE_ENGINE,
  THREE_INSTANCED_GRID_DEFINITION,
  THREE_PRELOAD_STRATEGIES,
} from '@codplay/component-v2'

const riveLibrary = RIVE_ENGINE.libraries?.register?.[0]
const threeLibrary = THREEJS_CORE_ENGINE.libraries?.register?.[0]

if (riveLibrary === undefined || threeLibrary === undefined) {
  throw new Error('The scene export demo requires the existing Rive and Three.js library definitions.')
}

/** Shared engine catalog with delivery metadata for its existing libraries. */
export const engineCapabilities = {
  components: {
    register: [
      ...(RIVE_ENGINE.components?.register ?? []),
      ...(THREEJS_CORE_ENGINE.components?.register ?? []),
      THREE_INSTANCED_GRID_DEFINITION,
    ],
  },
  libraries: {
    register: [
      {
        ...riveLibrary,
        module: '@rive-app/canvas',
        delivery: { mode: 'package' },
      },
      {
        ...threeLibrary,
        module: 'three',
        delivery: { mode: 'package' },
      },
    ],
  },
}

/** Static preload strategies used by the same configured player engine. */
export const preloadStrategies = {
  ...RIVE_PRELOAD_STRATEGIES,
  ...THREE_PRELOAD_STRATEGIES,
}

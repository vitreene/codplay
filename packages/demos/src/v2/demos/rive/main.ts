import { RIVE_ENGINE, RIVE_PRELOAD_STRATEGIES } from '@codplay/component-v2'

export {
  RIVE_COACH_ARTBOARD,
  RIVE_COACH_SRC,
  RIVE_COACH_STATE_MACHINE,
  buildRiveCoachVisemeEventimes,
  buildRiveCoachWordEventimes,
  createScene,
} from './scene'

/** Supplies the existing Rive integration to the shared V2 demo engine. */
export const engineCapabilities = RIVE_ENGINE

/** Supplies the existing Rive preload strategies to the shared V2 demo player. */
export const preloadStrategies = RIVE_PRELOAD_STRATEGIES

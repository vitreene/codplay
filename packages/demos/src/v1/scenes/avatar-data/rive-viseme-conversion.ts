import type { StrapCollection } from 'codplay/player/strap-types'
import { RHUBARB_TO_TALKING_HEAD_VISEME, readRhubarbVisemeCode } from './rhubarb-viseme-map'

/**
 * Memo table: Rhubarb mouth-shape codes -> viseme names consumed by the current Rive coach
 * state machine through `lips sync id`.
 *
 * Source convention:
 * - A-H, X = Rhubarb mouth-shape alphabet (not textual Preston Blair labels)
 *
 * Target convention:
 * - PP, DD, E, aa, O, U, FF, nn = viseme names mapped later to the Rive `lips sync id`
 *   input by `packages/authoring/components/rive/src/viseme-map.ts`
 */
export const RHUBARB_TO_RIVE_VISEME = RHUBARB_TO_TALKING_HEAD_VISEME

export const riveCoachVisemeConversionStraps: StrapCollection = {
  'rive-coach-viseme-convert': ({ event }) => {
    const payload = typeof event.data === 'object' && event.data !== null
      ? (event.data as Record<string, unknown>)
      : {}

    const sourceViseme = readRhubarbVisemeCode(payload.viseme)
    if (sourceViseme === null) {
      return {
        warnings: [`[rive-coach] unsupported Rhubarb viseme code: ${String(payload.viseme)}`],
      }
    }

    return {
      events: [{
        name: 'avatar:viseme',
        data: {
          viseme: RHUBARB_TO_RIVE_VISEME[sourceViseme],
          sourceViseme,
        },
      }],
    }
  },
}

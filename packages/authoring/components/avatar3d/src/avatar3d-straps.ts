/**
 * Avatar3D idle strap.
 *
 * avatar:idle fires once at t=0 and emits three single events:
 *   avatar:blink      — registers the per-frame blink scheduler fn (component action handler)
 *   avatar:breathe    — registers the per-frame breath trigger fn  (component action handler)
 *   avatar:head-drift — registers the per-frame head drift fn      (component action handler)
 *
 * All epoch detection and animation calculations live in the component's action handlers.
 * No live loops — zero events after t=0.
 */
import type { StrapCollection } from 'codplay/player'

export function createAvatar3DStraps(): StrapCollection {
  return {
    'avatar:idle': () => ({
      events: [
        { name: 'avatar:blink' },
        { name: 'avatar:breathe' },
        { name: 'avatar:head-drift' },
      ],
    }),
  }
}

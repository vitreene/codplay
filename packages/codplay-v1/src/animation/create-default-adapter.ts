import { animate, createAnimatable, engine } from 'animejs'
import { createAnimationAdapter, type AnimeImplementation, type CaptureUpdater } from './adapter'
import type { AnimationAdapter } from './types'

/**
 * The real anime.js bridge — shared by `createDefaultAnimationAdapter` (the real, DOM-facing
 * adapter) and `capturePersoStatesMirror` (`perso-state-mirror.ts`, an ephemeral mirror adapter).
 * Same engine, same parameters either way — the mirror's fidelity to the real interpolation
 * depends on reusing this exact function, never a re-implementation.
 */
export function createRealAnimeImplementation(): AnimeImplementation {
  return (parameters: Record<string, unknown>) => {
    const { targets, ...params } = parameters
    return animate(
      targets as Parameters<typeof animate>[0],
      params as Parameters<typeof animate>[1],
    )
  }
}

export function createDefaultAnimationAdapter(): AnimationAdapter {
  engine.useDefaultMainLoop = false

  const animeImpl = createRealAnimeImplementation()

  /**
   * Bridges `CaptureUpdate` to anime.js's `createAnimatable` — one persistent
   * animation per property, reused on every call instead of creating a new
   * `animate()` each frame (see `2026-07-21-capture-animatable-channel-plan.md`).
   */
  const captureUpdaterImpl = (target: unknown, property: string): CaptureUpdater => {
    const animatable = createAnimatable(target as Parameters<typeof createAnimatable>[0], {
      [property]: 0,
    })
    return {
      set: (value: number | string) => {
        ;(animatable[property] as (to: number | string) => void)(value)
      },
    }
  }

  return createAnimationAdapter(animeImpl, {
    renderFrame: () => {
      engine.update()
    },
    setRate: (rate) => {
      engine.speed = rate
    },
    captureUpdaterImplementation: captureUpdaterImpl,
  })
}

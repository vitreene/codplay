import { animate, engine } from 'animejs'
import { createAnimationAdapter } from './adapter'
import type { AnimationAdapter } from './types'

export function createDefaultAnimationAdapter(): AnimationAdapter {
  engine.useDefaultMainLoop = false

  const animeImpl = (parameters: Record<string, unknown>) => {
    const { targets, ...params } = parameters
    return animate(
      targets as Parameters<typeof animate>[0],
      params as Parameters<typeof animate>[1],
    )
  }

  return createAnimationAdapter(animeImpl, {
    renderFrame: () => {
      engine.update()
    },
    setRate: (rate) => {
      engine.speed = rate
    },
  })
}

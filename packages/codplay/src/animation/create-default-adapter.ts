import { animate, engine } from 'animejs'
import { createAnimationAdapter } from './adapter'
import type { AnimationAdapter } from './types'

export function createDefaultAnimationAdapter(options: {
  renderFrame?: (nowMs: number) => void
} = {}): AnimationAdapter {
  engine.useDefaultMainLoop = false

  const animeImpl = (parameters: Record<string, unknown>) => {
    const { targets, ...params } = parameters
    return animate(
      targets as Parameters<typeof animate>[0],
      params as Parameters<typeof animate>[1],
    )
  }

  return createAnimationAdapter(animeImpl, {
    renderFrame: (nowMs) => {
      engine.update()
      options.renderFrame?.(nowMs)
    },
    setRate: (rate) => {
      engine.speed = rate
    },
  })
}

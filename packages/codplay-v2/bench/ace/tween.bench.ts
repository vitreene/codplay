import { bench, describe } from 'vitest'

import { prepareTween, resolveTween, type Tween } from '../../src/ace/tween'

/** Creates representative prepared states without any DOM or renderer. */
const createTweens = (count: number): Tween[] =>
  Array.from({ length: count }, (_, index) =>
    prepareTween({
      from: {
        x: index,
        y: index * 0.5,
        opacity: 0,
        rotate: 0,
        scale: 0.8,
        color: { kind: 'color', space: 'oklch', coords: [0.55, 0.18, 25], alpha: 1 },
        points: [0, index, 20],
      },
      to: {
        x: index + 500,
        y: index + 250,
        opacity: 1,
        rotate: 360,
        scale: 1,
        color: { kind: 'color', space: 'oklch', coords: [0.68, 0.2, 260], alpha: 0.75 },
        points: [100, index + 250, 80],
      },
      duration: 1000,
      ease: 'inOutQuad',
      loop: true,
      alternate: true,
    }),
  )

/** Resolves a complete set of tweens and checks the final state against dead-code removal. */
const resolveAll = (tweens: readonly Tween[], instant: number): void => {
  let state: unknown
  for (const tween of tweens) state = resolveTween(tween, instant)
  if (state === undefined) throw new Error('ACE benchmark: expected a resolved state')
}

describe('ACE tween resolution without DOM', () => {
  const hundredTweens = createTweens(100)
  const thousandTweens = createTweens(1000)

  bench('100 tweens x 7 properties', () => resolveAll(hundredTweens, 473))
  bench('1000 tweens x 7 properties', () => resolveAll(thousandTweens, 473))
  bench('1000 tweens at a loop boundary', () => resolveAll(thousandTweens, 1015))
})

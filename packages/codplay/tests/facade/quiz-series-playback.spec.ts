/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import { createScene } from '../../../demos/src/v2/demos/quiz-series/main'
import { quizSeriesAutoPlayback } from '../../../demos/src/v2/demos/quiz-series/auto-playback'

/** Creates a scheduler that leaves frame advancement under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

describe('quiz-series external playback', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('injects the automatic track through the public eventime path', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'quiz-series-playback-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    for (const injection of quizSeriesAutoPlayback.injections) {
      await instance.events.emit(injection.eventime, injection.target)
    }
    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(2_000)

    expect(root.querySelector<HTMLInputElement>('input:checked')?.value).toBe('vrai')

    codplay.engine.advance(4_000)
    expect(root.querySelector('.quiz-series-progress span')?.textContent).toBe('1 / 3')

    codplay.engine.advance(18_400)
    expect(root.querySelector<HTMLElement>('.quiz-series-result-overlay')?.style.opacity).toBe('1')
    expect(root.querySelector('.quiz-series-result-card')?.textContent).toContain('3 / 3')
    expect(root.querySelector('.quiz-series-result-card')?.textContent).toContain('Réussi !')
  })
})

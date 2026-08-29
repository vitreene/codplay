/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import { createScene } from '../../../demos/src/v2/demos/chrono/main'

/** Creates a scheduler that leaves frame advancement under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

describe('chrono V2 demo', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('stops the scene TweenAction without pausing the player, then resets through DOM emit', async () => {
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
      instanceId: 'chrono-demo-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      durationMs: 20_000,
      root,
      mountTargets: [{ id: 'root-host', kind: 'root', storyId: 'main' }],
    })

    codplay.engine.advance(0)
    await instance.telco.play()

    root.querySelector<HTMLButtonElement>('.chrono-button--start')?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    codplay.engine.advance(10_000)

    expect(root.querySelector<HTMLElement>('.chrono-display')?.textContent).toBe('10:00')
    expect(root.querySelector<HTMLElement>('.chrono-needle')?.style.transform).toBe('rotate(60.000deg)')
    expect(root.querySelector<HTMLElement>('.chrono-button--pause')?.style.display).toBe('inline-flex')

    root.querySelector<HTMLButtonElement>('.chrono-button--pause')?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    expect(instance.telco.getState().status).toBe('playing')
    const pausedDisplay = root.querySelector<HTMLElement>('.chrono-display')?.textContent
    expect(pausedDisplay).toBe('10:00')
    expect(root.querySelector<HTMLElement>('.chrono-needle')?.style.transform).toBe('rotate(60.000deg)')
    codplay.engine.advance(15_000)
    expect(root.querySelector<HTMLElement>('.chrono-display')?.textContent).toBe(pausedDisplay)

    expect(root.querySelector<HTMLElement>('.chrono-button--resume')?.style.display).toBe('inline-flex')
    root.querySelector<HTMLButtonElement>('.chrono-button--resume')?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    expect(instance.telco.getProgress().timelineMs).toBe(15_000)
    expect(root.querySelector<HTMLElement>('.chrono-display')?.textContent).toBe('10:00')
    codplay.engine.advance(19_000)
    expect(instance.telco.getProgress().timelineMs).toBe(19_000)
    expect(root.querySelector<HTMLElement>('.chrono-display')?.textContent).toBe('06:00')

    root.querySelector<HTMLButtonElement>('.chrono-button--reset')?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    expect(root.querySelector<HTMLElement>('.chrono-display')?.textContent).toBe('--:--')
    expect(root.querySelector<HTMLElement>('.chrono-needle')?.style.transform).toBe('rotate(0deg)')
  })
})

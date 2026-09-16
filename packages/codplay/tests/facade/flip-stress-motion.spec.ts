/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import { createScene } from '../../../demos/src/v2/demos/flip-stress/main'

/** Creates a scheduler whose frame advancement stays under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Finds the unmarked overlay layer by its presentation contract. */
function findTestOverlayLayer(root: Element): HTMLElement | undefined {
  return Array.from(root.querySelectorAll<HTMLElement>('*')).find((candidate) => (
    candidate.style.position === 'absolute'
      && candidate.style.width === '100%'
      && candidate.style.height === '100%'
      && candidate.style.pointerEvents === 'none'
      && candidate.style.zIndex === '20'
  ))
}

describe('flip-stress motion overlay boundary', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('keeps the Q frame at its source during the first playback frame', async () => {
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
      instanceId: 'flip-stress-direct-playback-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    const qFrame = root.querySelector<HTMLElement>('.transfer-frame--q')
    const source = root.querySelector<HTMLElement>('.stress-container--a')
    const target = root.querySelector<HTMLElement>('.stress-container--b')
    expect(qFrame).not.toBeNull()
    expect(source?.contains(qFrame)).toBe(true)
    expect(target?.contains(qFrame)).toBe(false)

    await instance.telco.play()

    expect(source?.contains(qFrame)).toBe(true)
    expect(target?.contains(qFrame)).toBe(false)
  })

  it('starts the Q transfer at its source pose instead of its final pose', async () => {
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
      instanceId: 'flip-stress-q-transfer-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(2_000)

    const transferAtStart = instance.presentation.get()?.items.find((item) => (
      item.itemId.includes('transfer-q-frame')
    ))
    expect(transferAtStart?.activeSegmentId).toBeDefined()
    expect(transferAtStart?.progress).toBeCloseTo(0)

    codplay.engine.advance(2_500)
    const transferInFlight = instance.presentation.get()?.items.find((item) => (
      item.itemId.includes('transfer-q-frame')
    ))
    expect(transferInFlight?.activeSegmentId).toBeDefined()
    expect(transferInFlight?.progress).toBeGreaterThan(0)
    expect(transferInFlight?.progress).toBeLessThan(1)
  })

  it('keeps the multi-root main story on one scene-root overlay', async () => {
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
      instanceId: 'flip-stress-overlay-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })

    await instance.telco.seek(1_500)

    const overlay = findTestOverlayLayer(root)
    expect(overlay).not.toBeUndefined()
    expect(overlay?.parentElement).toBe(root)
    expect(overlay?.children.length).toBeGreaterThan(0)
  })
})

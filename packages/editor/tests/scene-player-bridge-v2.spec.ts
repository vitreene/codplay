/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../src/app/bridges/scene-player-bridge'
import { EditorPlayerCommandFacade } from '../src/app/commands/editor-player-command-facade'

/** Creates the V2 position scene used by the real bridge integration. */
function scene() {
  return {
    id: 'position-repro',
    meta: { title: 'position', durationMs: 5000, durationSource: 'arbitrary' as const, timeUnit: 'ms' as const, capsuleOrder: 'forward' as const },
    items: [{ id: 'item', type: 'text' as const, parentId: null, order: 'a', visible: true, contentId: 'content', initialDecorId: 'first', keyframes: [{ id: 'a', timeMs: 0, decorId: 'first' }, { id: 'b', timeMs: 5000, decorId: 'second' }] }],
    contents: { content: { id: 'content', type: 'text' as const, text: 'item' } },
    decors: {
      first: { id: 'first', offset: { translate: { x: 10, y: 10 }, width: 20, height: 20 }, style: { 'background-color': '#ff0000' } },
      second: { id: 'second', offset: { translate: { x: 50, y: 50 }, width: 20, height: 20 }, style: { 'background-color': '#0000ff' } },
    },
    zones: {}, markerTracks: {},
  }
}

/** Lets the asynchronous V2 bridge finish one staged bind and its seek handoff. */
const waitTurns = async (count = 8): Promise<void> => {
  for (let i = 0; i < count; i += 1) await Promise.resolve()
}

describe('V2 editor position seek integration', () => {
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let coordination: EditorCoordinationBridge | undefined
  let sceneBridge: ReturnType<typeof createScenePlayerBridge> | undefined
  let root: HTMLElement | undefined
  let now = 0
  let nextFrameId = 1
  const frames = new Map<number, () => void>()

  afterEach(() => {
    sceneBridge?.destroy()
    coordination?.destroy()
    actor?.stop()
    sceneBridge = undefined
    coordination = undefined
    actor = undefined
    root = undefined
    frames.clear()
  })

  it('plays, seeks back, plays again, then seeks again without freezing the scene', async () => {
    const originalNow = Date.now
    const originalRaf = globalThis.requestAnimationFrame
    const originalCancelRaf = globalThis.cancelAnimationFrame
    Date.now = () => now
    globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const id = nextFrameId++
      frames.set(id, () => callback(now))
      return id
    }
    globalThis.cancelAnimationFrame = (id: number) => { frames.delete(id) }
    try {
      actor = createActor(controllerMachine)
      actor.start()
      actor.send({ type: 'SCENE_LOADED', scene: scene() })
      const facade = new EditorPlayerCommandFacade()
      coordination = new EditorCoordinationBridge(actor, facade)
      root = document.createElement('div')
      Object.defineProperty(root, 'getBoundingClientRect', { value: () => ({ width: 800, height: 450, top: 0, left: 0, right: 800, bottom: 450 }) })
      document.body.append(root)
      sceneBridge = createScenePlayerBridge(root, actor, coordination)
      await waitTurns()

      coordination.transport.play()
      await waitTurns()
      now = 100
      const firstFrame = [...frames.values()][0]
      expect(firstFrame).toBeDefined()
      firstFrame?.()
      await waitTurns()
      now = 1100
      const secondFrame = [...frames.values()][0]
      secondFrame?.()
      await waitTurns()
      const node = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1000)
      expect(node?.style.transform).toContain('translate(')

      actor.send({ type: 'SEEK', timelineMs: 500 })
      await waitTurns()
      expect(coordination.transport.getProgress()?.timelineMs).toBe(500)
      expect(node?.style.transform).toContain('translate(')

      coordination.transport.play()
      await waitTurns()
      now = 1200
      const thirdFrame = [...frames.values()][0]
      thirdFrame?.()
      await waitTurns()
      now = 2200
      const fourthFrame = [...frames.values()][0]
      fourthFrame?.()
      await waitTurns()
      const afterResume = coordination.transport.getProgress()?.timelineMs
      expect(afterResume).toBe(1500)
      const resumedTransform = root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform

      actor.send({ type: 'SEEK', timelineMs: 250 })
      await waitTurns()
      expect(coordination.transport.getProgress()?.timelineMs).toBe(250)
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform).toContain('translate(')

      coordination.transport.play()
      await waitTurns()
      now = 2300
      ;[...frames.values()][0]?.()
      await waitTurns()
      now = 3300
      ;[...frames.values()][0]?.()
      await waitTurns()
      // The replacement instance must resume from the author seek (250 ms), not from its
      // initially discovered runtime horizon (0 ms). The first frame is intentionally skipped
      // after a seek; the second frame advances the preserved author position by 1,000 ms.
      expect(coordination.transport.getProgress()?.timelineMs).toBe(1250)
      expect(root.querySelector<HTMLElement>('[data-item-id="story-main:item"]')?.style.transform).not.toBe(resumedTransform)
    } finally {
      Date.now = originalNow
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancelRaf
    }
  })
})

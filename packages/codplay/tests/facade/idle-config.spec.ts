/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import { createRemote } from '../../../authoring/remote/src/remote'
import { CodPlay } from '../../src'
import type { CompiledScene } from '../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-29T00:00:00.000Z',
  scene: { id: 'idle-facade-scene', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

/** Creates one public instance with the minimum HTML mounting declaration. */
function createInstance(codplay: CodPlay, idle?: false | Readonly<{
  durationMs?: number
  event?: Readonly<{ name: string; visibility?: 'story' | 'scene' | 'public'; storyId?: string }>
}>): ReturnType<CodPlay['instances']['create']> {
  return codplay.instances.create({
    instanceId: 'idle-instance',
    compiledScene: scene,
    root: document.createElement('div'),
    idle,
  })
}

/** Lets the asynchronous idle dispatch complete before the next external frame. */
async function flushEventDispatch(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('public idle configuration', () => {
  it('inherits the engine idle policy and exposes its public event', async () => {
    const codplay = new CodPlay({
      engine: {
        idle: {
          durationMs: 100,
          event: { name: 'engine:idle', visibility: 'public' },
        },
      },
    })
    const instance = createInstance(codplay)
    const events: string[] = []
    instance.events.onEvent((event) => events.push(event.name))

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(100)
    await flushEventDispatch()
    codplay.engine.advance(101)

    expect(events).toContain('engine:idle')
    codplay.destroy()
  })

  it('lets one instance disable the inherited engine idle policy', async () => {
    const codplay = new CodPlay({
      engine: {
        idle: {
          durationMs: 10,
          event: { name: 'engine:idle', visibility: 'public' },
        },
      },
    })
    const instance = createInstance(codplay, false)
    const events: string[] = []
    instance.events.onEvent((event) => events.push(event.name))

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(60_000)
    await flushEventDispatch()

    expect(events).toEqual([])
    codplay.destroy()
  })

  it('exposes the V1 terminal sequence state and replays through telco.play', async () => {
    const codplay = new CodPlay({
      engine: {
        idle: { durationMs: 100, event: { name: 'sequence:end' } },
      },
    })
    const instance = createInstance(codplay)

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(100)
    await flushEventDispatch()

    expect(instance.telco.getState()).toMatchObject({
      status: 'paused',
      timelineMs: 100,
      sequenceEnded: true,
    })
    codplay.engine.advance(1_000)
    expect(instance.telco.getState().timelineMs).toBe(100)

    await instance.telco.play()
    expect(instance.telco.getState()).toMatchObject({
      status: 'playing',
      timelineMs: 0,
      sequenceEnded: false,
    })
    codplay.destroy()
  })

  it('disables remote seeking after the real player reaches sequence end', async () => {
    const codplay = new CodPlay({
      engine: {
        idle: { durationMs: 100, event: { name: 'sequence:end' } },
      },
    })
    const instance = createInstance(codplay)
    const errors: string[] = []
    const remote = createRemote({
      telco: instance.telco,
      onError: (message) => errors.push(message),
    })
    const range = remote.element.querySelector<HTMLInputElement>('input[type="range"]')
    if (range === null) throw new Error('Remote seek range is missing.')

    codplay.engine.advance(0)
    await instance.telco.play()
    codplay.engine.advance(100)
    await flushEventDispatch()
    codplay.engine.advance(101)

    expect(instance.telco.getState()).toMatchObject({ sequenceEnded: true, status: 'paused' })
    expect(range.disabled).toBe(true)
    range.dispatchEvent(new Event('pointerdown'))
    range.dispatchEvent(new Event('input'))
    range.dispatchEvent(new Event('pointerup'))
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))

    expect(errors).toEqual([])
    remote.destroy()
    codplay.destroy()
  })

  it('publishes invalid engine idle configuration through the facade diagnostic channel', () => {
    const diagnostics: string[] = []
    expect(() => new CodPlay({
      engine: {
        idle: { durationMs: 0 },
        diagnosticOutput: (diagnostic) => diagnostics.push(diagnostic.code),
      },
    })).toThrow('Runtime idle durationMs must be a finite positive number.')
    expect(diagnostics).toContain('CODPLAY_ENGINE_CONFIGURATION_FAILED')
  })
})

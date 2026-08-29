/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

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
    mountTargets: [{ id: 'idle-root', kind: 'root', storyId: 'idle-facade-scene' }],
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

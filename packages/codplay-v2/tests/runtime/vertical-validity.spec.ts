import { describe, expect, it, vi } from 'vitest'

import { SceneBuilder } from '../../src/scene/compiled'
import { RuntimeEngine } from '../../src/runtime/engine'
import { createCoreRuntimeCatalog } from '../../src/runtime/catalog'
import { MemoryRenderSink, RuntimePlayer } from '../../src/runtime/player'
import type { RuntimeCapabilityCatalog } from '../../src/runtime/catalog'
import type { SceneDoc } from '../../src/scene/types'

/** Creates the smallest catalog required by the temporary render vertical. */
function createCatalog(): RuntimeCapabilityCatalog {
  return createCoreRuntimeCatalog()
}

/** Creates one scene that exercises root placement, eventime, class, and tween state. */
function createVerticalScene(): SceneDoc {
  return {
    id: 'temporary-validity-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos: [{
          id: 'root',
          type: 'tag',
          initial: {
            className: 'is-idle',
            style: { opacity: 0 },
            move: '@root',
          },
          actions: {
            'demo:show': {
              className: { add: 'is-active', remove: 'is-idle' },
              style: { opacity: { from: 0, to: 1, duration: 100, ease: 'linear' } },
            },
          },
        }],
        eventimes: [{ name: 'demo:show', startAt: 100 }],
      },
    },
  }
}

describe('temporary render validity vertical', () => {
  it('runs the compiled scene through engine, player, and memory sink', () => {
    const catalog = createCatalog()
    const builder = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-07-31T00:00:00.000Z',
      diagnosticOutput: vi.fn(),
    })
    const build = builder.build(createVerticalScene())

    expect(build.ok).toBe(true)
    if (!build.ok) return

    expect(build.compiledScene.rootNodeIds).toEqual(['root'])
    const engine = new RuntimeEngine(catalog)
    const sink = new MemoryRenderSink()
    const player = new RuntimePlayer('vertical-instance', engine, build.compiledScene, sink)

    expect(player.init().ok).toBe(true)
    player.seek(0)
    player.seek(100)
    player.seek(150)
    player.seek(200)

    const snapshots = sink.getSnapshots()
    expect(snapshots.at(-4)?.persos['main:root']).toMatchObject({
      className: 'is-idle',
      style: { opacity: 0 },
    })
    expect(snapshots.at(-3)?.persos['main:root']).toMatchObject({
      className: 'is-active',
      style: { opacity: 0 },
    })
    expect(snapshots.at(-2)?.persos['main:root']).toMatchObject({
      className: 'is-active',
      style: { opacity: 0.5 },
    })
    expect(snapshots.at(-1)?.persos['main:root']).toMatchObject({
      className: 'is-active',
      style: { opacity: 1 },
    })
    expect(snapshots.at(-1)?.placements?.['main:root']).toMatchObject({
      kind: 'root',
      mounted: false,
    })
  })
})

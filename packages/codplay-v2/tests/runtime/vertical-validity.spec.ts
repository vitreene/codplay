import { describe, expect, it, vi } from 'vitest'

import { SceneBuilder } from '../../src/scene/compiled'
import { RuntimeEngine } from '../../src/runtime/engine'
import { createCoreRuntimeCatalog } from '../../src/runtime/catalog'
import { RuntimePlayer } from '../../src/runtime/player'
import type { RuntimeMaterializer } from '../../src/runtime/materializer'
import type { SolvedScene } from '../../src/runtime/player'
import type { RuntimeCapabilityCatalog } from '../../src/runtime/catalog'
import type { SceneDoc } from '../../src/scene/types'

/** Creates the smallest catalog required by the runtime validation vertical. */
function createCatalog(): RuntimeCapabilityCatalog {
  return createCoreRuntimeCatalog()
}

/** Creates one scene that exercises root placement, eventime, class, and tween state. */
function createVerticalScene(): SceneDoc {
  return {
    id: 'runtime-validity-scene',
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

describe('runtime validity vertical', () => {
  it('runs the compiled scene through engine, player, and one materializer boundary', () => {
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
    const snapshots: SolvedScene[] = []
    const materializer: RuntimeMaterializer = {
      id: 'test',
      context: {},
      materializeComponent: () => ({ destroy: () => undefined }),
      materializeScene: (scene) => snapshots.push(scene),
    }
    const player = new RuntimePlayer(
      'vertical-instance',
      engine,
      build.compiledScene,
      undefined,
      undefined,
      undefined,
      [],
      materializer,
    )

    expect(player.init().ok).toBe(true)
    player.seek(0)
    player.seek(100)
    player.seek(150)
    player.seek(200)

    const initial = snapshots.find((snapshot) => snapshot.timeMs === 0)
    const atStart = snapshots.find((snapshot) => snapshot.timeMs === 100)
    const atMiddle = snapshots.find((snapshot) => snapshot.timeMs === 150)
    const atEnd = snapshots.find((snapshot) => snapshot.timeMs === 200)
    expect(initial?.persos['main:root']?.state).toMatchObject({
      className: 'is-idle',
      style: { opacity: 0 },
    })
    expect(atStart?.persos['main:root']?.state).toMatchObject({
      className: 'is-active',
      style: { opacity: 0 },
    })
    expect(atMiddle?.persos['main:root']?.state).toMatchObject({
      className: 'is-active',
      style: { opacity: 0.5 },
    })
    expect(atEnd?.persos['main:root']?.state).toMatchObject({
      className: 'is-active',
      style: { opacity: 1 },
    })
    expect(atEnd?.persos['main:root']?.placement).toMatchObject({
      kind: 'root',
      mounted: false,
    })
  })
})

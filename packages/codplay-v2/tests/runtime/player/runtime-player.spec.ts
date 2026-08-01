import { describe, expect, it } from 'vitest'

import { RuntimeEngine } from '../../../src/runtime/engine'
import { MemoryRenderSink, RenderSync, RuntimePlayer, type RenderAdapter } from '../../../src/runtime/player'
import {
  PLAYER_LIFECYCLE_DESTROYED,
  PLAYER_LIFECYCLE_IDLE,
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
} from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-07-31T00:00:00.000Z',
  scene: { id: 'scene-a', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('RuntimePlayer', () => {
  it('owns lifecycle and logical time without creating a clock', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const sink = new MemoryRenderSink()
    const player = new RuntimePlayer('instance-a', engine, scene, sink)

    expect(player.init().ok).toBe(true)
    player.play()
    engine.advance(100)
    engine.advance(160)

    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PLAYING)
    expect(player.getCurrentTimeMs()).toBe(60)

    player.pause()
    player.seek(500)
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_PAUSED)
    expect(player.getCurrentTimeMs()).toBe(500)
    player.destroy()
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_DESTROYED)
    expect(sink.getSnapshots()).toEqual([
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 0, persos: {} },
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 0, persos: {} },
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 60, persos: {} },
      { instanceId: 'instance-a', sceneId: 'scene-a', timeMs: 500, persos: {} },
    ])
  })

  it('does not initialize when the engine lacks a compiled requirement', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer('instance-a', engine, {
      ...scene,
      requirements: { ...scene.requirements, components: ['tag'] },
    })

    const result = player.init()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.diagnostics.errors[0]?.code).toBe('RUNTIME_COMPONENT_UNAVAILABLE')
    expect(player.getLifecycleState()).toBe(PLAYER_LIFECYCLE_IDLE)
  })

  it('warns when declared straps are missing from their owned collections', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer(
      'instance-a',
      engine,
      { ...scene, scene: { ...scene.scene, straps: ['missing-scene-strap'] } },
      undefined,
      undefined,
      { scene: {}, stories: {} },
    )

    const result = player.init()

    expect(result.ok).toBe(true)
    expect(result.diagnostics.warnings.map((entry) => entry.code)).toEqual(['AUTHOR_SCENE_STRAP_MISSING'])
  })

  it('resets the instance delta baseline after pause/resume', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const player = new RuntimePlayer('instance-a', engine, scene)

    player.init()
    player.play()
    engine.advance(100)
    engine.advance(140)
    player.pause()
    engine.advance(1000)
    player.play()
    engine.advance(1016)
    engine.advance(1032)

    expect(player.getCurrentTimeMs()).toBe(56)
  })

  it('routes play, pause, resume, and seek baselines through RenderSync', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const ticks: Array<{ nowMs: number; deltaMs: number; timelineMs: number }> = []
    const seeks: Array<{ nowMs: number; timelineMs: number }> = []
    const adapter: RenderAdapter = {
      tick: ({ nowMs, deltaMs, timelineMs }) => ticks.push({ nowMs, deltaMs, timelineMs }),
      seek: ({ nowMs, timelineMs }) => seeks.push({ nowMs, timelineMs }),
    }
    const player = new RuntimePlayer('instance-a', engine, scene, undefined, new RenderSync([adapter]))

    player.init()
    player.play()
    engine.advance(100)
    engine.advance(140)
    player.pause()
    engine.advance(1000)
    player.seek(500)
    player.play()
    engine.advance(1016)
    engine.advance(1032)

    expect(ticks).toEqual([
      { nowMs: 100, deltaMs: 0, timelineMs: 0 },
      { nowMs: 140, deltaMs: 40, timelineMs: 40 },
      { nowMs: 1016, deltaMs: 0, timelineMs: 500 },
      { nowMs: 1032, deltaMs: 16, timelineMs: 516 },
    ])
    expect(seeks).toEqual([{ nowMs: 1000, timelineMs: 500 }])
  })

  it('reconstructs selected players before presenting a grouped seek', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
    const firstSink = new MemoryRenderSink()
    const secondSink = new MemoryRenderSink()
    const first = new RuntimePlayer('first', engine, scene, firstSink)
    const second = new RuntimePlayer('second', engine, scene, secondSink)

    first.init()
    second.init()
    engine.seek([
      { instanceId: 'first', timeMs: 3000 },
      { instanceId: 'second', timeMs: 2000 },
    ])

    expect(firstSink.getSnapshots().at(-1)?.timeMs).toBe(3000)
    expect(secondSink.getSnapshots().at(-1)?.timeMs).toBe(2000)
  })
})

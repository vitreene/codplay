import { describe, expect, it } from 'vitest'

import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import {
  DEFAULT_RUNTIME_IDLE_DURATION_MS,
  DEFAULT_RUNTIME_IDLE_EVENT_NAME,
  resolveRuntimeIdleOptions,
  RuntimeIdleMonitor,
  type RuntimeIdleOptions,
} from '../../../src/runtime/idle'
import { RuntimePlayer } from '../../../src/runtime/player'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-29T00:00:00.000Z',
  scene: { id: 'idle-scene', stories: {}, listen: [], tracks: {} },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

/** Lets asynchronous event dispatches complete before inspecting the journal. */
async function flushEventDispatch(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

/** Creates and initializes one runtime player with an optional idle override. */
function createPlayer(
  engineOptions: ConstructorParameters<typeof RuntimeEngine>[1] = {},
  idle?: RuntimeIdleOptions,
): Readonly<{ engine: RuntimeEngine; player: RuntimePlayer }> {
  const engine = new RuntimeEngine(new RuntimeCapabilityCatalog(), engineOptions)
  const player = new RuntimePlayer(
    'idle-player',
    engine,
    scene,
    undefined,
    undefined,
    undefined,
    [],
    undefined,
    undefined,
    {},
    undefined,
    undefined,
    idle,
  )
  expect(player.init().ok).toBe(true)
  return { engine, player }
}

/** Returns the events produced by the idle monitor in one player journal. */
function idleEvents(player: RuntimePlayer): readonly Readonly<{ name: string; applyAtMs: number }>[] {
  return player.trackJournal.getAllEvents()
    .filter((event) => event.context?.source === 'idle')
    .map((event) => ({ name: event.name, applyAtMs: event.applyAtMs }))
}

describe('runtime idle', () => {
  it('resolves the documented default and emits once per inactivity period', () => {
    const options = resolveRuntimeIdleOptions()
    expect(options).toEqual({
      durationMs: DEFAULT_RUNTIME_IDLE_DURATION_MS,
      event: { name: DEFAULT_RUNTIME_IDLE_EVENT_NAME },
    })

    const monitor = new RuntimeIdleMonitor(options)
    expect(monitor.advance(DEFAULT_RUNTIME_IDLE_DURATION_MS - 1)).toBe(false)
    expect(monitor.advance(1)).toBe(true)
    expect(monitor.advance(1)).toBe(false)
    monitor.reset()
    expect(monitor.advance(DEFAULT_RUNTIME_IDLE_DURATION_MS)).toBe(true)
  })

  it('inherits the engine policy and sends the default sequence:end event through the journal', async () => {
    const { engine, player } = createPlayer()
    player.play()
    engine.advance(0)
    engine.advance(DEFAULT_RUNTIME_IDLE_DURATION_MS)
    await flushEventDispatch()

    expect(idleEvents(player)).toEqual([{
      name: DEFAULT_RUNTIME_IDLE_EVENT_NAME,
      applyAtMs: DEFAULT_RUNTIME_IDLE_DURATION_MS,
    }])
    expect(player.hasSequenceEnded()).toBe(true)
    expect(player.getLifecycleState()).toBe('paused')
    engine.advance(DEFAULT_RUNTIME_IDLE_DURATION_MS + 10_000)
    await flushEventDispatch()
    expect(idleEvents(player)).toHaveLength(1)
    expect(player.getCurrentTimeMs()).toBe(DEFAULT_RUNTIME_IDLE_DURATION_MS)
    player.destroy()
  })

  it('lets an engine policy be overridden by one player policy', async () => {
    const playerIdle: RuntimeIdleOptions = {
      durationMs: 200,
      event: { name: 'player:idle' },
    }
    const { engine, player } = createPlayer({
      idle: { durationMs: 100, event: { name: 'engine:idle' } },
    }, playerIdle)
    player.play()
    engine.advance(0)
    engine.advance(100)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([])
    engine.advance(200)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([{ name: 'player:idle', applyAtMs: 200 }])
    player.destroy()
  })

  it('does not install an idle monitor when the player sets idle to false', async () => {
    const { engine, player } = createPlayer({
      idle: { durationMs: 10, event: { name: 'engine:idle' } },
    }, false)
    player.play()
    engine.advance(0)
    engine.advance(60_000)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([])
    player.destroy()
  })

  it('resets activity on an external event and freezes the counter during pause', async () => {
    const { engine, player } = createPlayer({}, {
      durationMs: 100,
      event: { name: 'player:idle' },
    })
    player.play()
    engine.advance(0)
    engine.advance(50)
    await player.emit({ name: 'user:activity' })
    engine.advance(100)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([])

    player.pause()
    engine.advance(1_000)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([])

    player.play()
    engine.advance(1_001)
    engine.advance(1_101)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([{ name: 'player:idle', applyAtMs: 200 }])
    player.destroy()
  })

  it('resets the counter after a seek', async () => {
    const { engine, player } = createPlayer({}, {
      durationMs: 100,
      event: { name: 'player:idle' },
    })
    player.play()
    engine.advance(0)
    engine.advance(90)
    expect(player.seek(10).ok).toBe(true)
    engine.advance(91)
    engine.advance(191)
    await flushEventDispatch()
    expect(idleEvents(player)).toEqual([{ name: 'player:idle', applyAtMs: 110 }])
    player.destroy()
  })

  it('rejects invalid idle configurations', () => {
    expect(() => resolveRuntimeIdleOptions({ durationMs: 0 })).toThrow(
      'Runtime idle durationMs must be a finite positive number.',
    )
    expect(() => resolveRuntimeIdleOptions({ event: { name: '  ' } })).toThrow(
      'Runtime idle event name must not be empty.',
    )
  })
})

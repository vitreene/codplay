import { describe, expect, it } from 'vitest'

import { isPlainRecord } from '../../../src/shared'
import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import {
  EVENT_INSERT_MODE_PERSIST_ONLY,
  RuntimePlayer,
} from '../../../src/runtime/player'
import type { RuntimeComponentRuntime } from '../../../src/runtime/components'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-21T00:00:00.000Z',
  scene: {
    id: 'capture-player-scene',
    listen: [],
    tracks: {},
    stories: {
      main: {
        id: 'main',
        state: { value: 0 },
        straps: ['commit-capture'],
        listen: [{ on: 'capture:end', straps: ['commit-capture'] }],
        persos: [{
          id: 'item',
          type: 'tag',
          initial: {},
          actions: {},
        }],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: [], services: [], modules: [], resources: [] },
  actionTargetIndex: {},
}

describe('RuntimePlayer capture facade', () => {
  it('routes endEmit data.captureState through the normal strap state path', async () => {
    const player = createPlayer()
    expect(player.init().ok).toBe(true)

    const opened = player.beginCapture({
      captureId: 'drag-1',
      storyId: 'main',
      declaration: {
        initCaptureState: ({ state }) => ({ value: state.value }),
        trackCommand: ({ sample }) => ({
          captureState: { value: typeof sample.value === 'number' ? sample.value : 0 },
        }),
        endEmit: { name: 'capture:end' },
      },
    })
    expect(opened.ok).toBe(true)
    expect(player.trackCapture('drag-1', { value: 7 })).toMatchObject({ ok: true, sampleCount: 1 })

    const ended = await player.endCapture('drag-1')
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.events[0]?.data).toEqual({ value: 7, captureState: { value: 7 } })
    expect(ended.warnings).toEqual([])
    expect(player.resolveSceneAt(0).storyStates.main).toEqual({ value: 7 })
    player.destroy()
  })

  it('keeps persist-only capture output out of the current presentation until reconstruction', async () => {
    const player = createPlayer()
    expect(player.init().ok).toBe(true)

    const opened = player.beginCapture({
      captureId: 'drag-2',
      storyId: 'main',
      declaration: {
        trackCommand: ({ sample }) => ({
          captureState: { value: typeof sample.value === 'number' ? sample.value : 0 },
        }),
        endEmit: {
          name: 'capture:end',
          mode: EVENT_INSERT_MODE_PERSIST_ONLY,
        },
      },
    })
    expect(opened.ok).toBe(true)
    player.trackCapture('drag-2', { value: 9 })

    const ended = await player.endCapture('drag-2')
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.warnings).toEqual([])
    expect(player.getSolvedScene()?.storyStates.main).toEqual({ value: 0 })
    expect(player.resolveSceneAt(0).storyStates.main).toEqual({ value: 9 })
    player.destroy()
  })

  it('keeps implicit endCapture output outside the playback head at insertion', async () => {
    const player = createPlayer('capture:stored')
    expect(player.init().ok).toBe(true)

    const opened = player.beginCapture({
      captureId: 'drag-persist-only',
      storyId: 'main',
      declaration: {
        trackCommand: ({ sample }) => ({
          captureState: { value: typeof sample.value === 'number' ? sample.value : 0 },
        }),
        endCapture: ({ captureState }) => ({
          events: [{ name: 'capture:stored', data: { captureState } }],
        }),
      },
    })
    expect(opened.ok).toBe(true)
    expect(player.trackCapture('drag-persist-only', { value: 11 })).toMatchObject({ ok: true })

    const ended = await player.endCapture('drag-persist-only')
    expect(ended.ok).toBe(true)
    if (!ended.ok) return

    expect(ended.endCaptureEvents[0]).toMatchObject({
      source: 'endCapture',
      mode: EVENT_INSERT_MODE_PERSIST_ONLY,
    })
    expect(player.getSolvedScene()?.storyStates.main).toEqual({ value: 0 })
    expect(player.resolveSceneAt(0).storyStates.main).toEqual({ value: 11 })
    player.destroy()
  })

  it('does not reintroduce persist-only output on the next playback frame', async () => {
    const player = createPlayer('capture:stored:frame')
    expect(player.init().ok).toBe(true)

    expect(player.beginCapture({
      captureId: 'drag-persist-frame',
      storyId: 'main',
      declaration: {
        trackCommand: ({ sample }) => ({
          captureState: { value: typeof sample.value === 'number' ? sample.value : 0 },
        }),
        endCapture: ({ captureState }) => ({
          events: [{ name: 'capture:stored:frame', data: { captureState } }],
        }),
      },
    }).ok).toBe(true)
    player.trackCapture('drag-persist-frame', { value: 17 })

    const ended = await player.endCapture('drag-persist-frame')
    expect(ended.ok).toBe(true)
    expect(player.getSolvedScene()?.storyStates.main).toEqual({ value: 0 })
    expect(player.includesPersistOnlyInCurrent()).toBe(false)

    const startEvent = await player.emit({ name: 'capture:next-start', storyId: 'main' })
    expect(startEvent.ok).toBe(true)
    expect(player.includesPersistOnlyInCurrent()).toBe(false)

    player.play()
    player.engine.advance(0)
    player.engine.advance(16)
    expect(player.getSolvedScene()?.storyStates.main).toEqual({ value: 0 })

    expect(player.seek(0).ok).toBe(true)
    expect(player.getSolvedScene()?.storyStates.main).toEqual({ value: 17 })
    player.destroy()
  })

  it('keeps trackCommand updateState live without putting it in the journal', async () => {
    const player = createPlayer()
    expect(player.init().ok).toBe(true)

    expect(player.beginCapture({
      captureId: 'state-live',
      storyId: 'main',
      declaration: {
        trackCommand: ({ sample }) => ({
          updateState: { liveValue: typeof sample.value === 'number' ? sample.value : 0 },
        }),
      },
    }).ok).toBe(true)
    expect(player.trackCapture('state-live', { value: 13 })).toMatchObject({
      ok: true,
      updateState: { liveValue: 13 },
    })
    expect(player.stateStore.snapshot('story', 'main')).toEqual({ value: 0, liveValue: 13 })
    expect(player.trackJournal.getStateUpdates('story', 'main', 0)).toEqual([])

    const ended = await player.endCapture('state-live')
    expect(ended.ok).toBe(true)
    expect(player.stateStore.snapshot('story', 'main')).toEqual({ value: 0 })
    player.destroy()
  })

  it('uses the compiled action-target index to update components', () => {
    const liveScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            id: 'main',
            listen: [],
            persos: [
              {
                id: 'first',
                type: 'tag',
                initial: { style: { opacity: 0 } },
                actions: { drag: { style: { opacity: 0.25 } } },
              },
              {
                id: 'second',
                type: 'tag',
                initial: { style: { opacity: 0 } },
                actions: { drag: { style: { opacity: 0.25 } } },
              },
            ],
          },
        },
      },
      actionTargetIndex: {
        drag: [
          { storyId: 'main', persoId: 'first' },
          { storyId: 'main', persoId: 'second' },
        ],
      },
    }
    const liveUpdates: Array<{ persoKey: string; state: Record<string, unknown> }> = []
    const componentRuntime = {
      setModuleServices: () => undefined,
      getComponentSurfaces: () => ({ getSurface: () => undefined }),
      sync: () => undefined,
      updateLive: (persoKey: string, state: Record<string, unknown>) => liveUpdates.push({ persoKey, state }),
      destroy: () => undefined,
    } as unknown as RuntimeComponentRuntime
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const player = new RuntimePlayer(
      'capture-live-player',
      engine,
      liveScene,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      componentRuntime,
    )

    expect(player.init().ok).toBe(true)
    expect(player.beginCapture({
      captureId: 'drag-live',
      storyId: 'main',
      declaration: {
        trackCommand: ({ sample }) => sample.active === true
          ? {
            action: {
              actionName: 'drag',
              data: { style: { opacity: 0.75 } },
            },
          }
          : undefined,
      },
    }).ok).toBe(true)

    expect(player.trackCapture('drag-live', { active: true })).toMatchObject({ ok: true })
    expect(liveUpdates.map(({ persoKey }) => persoKey)).toEqual(['main:first', 'main:second'])
    expect(liveUpdates.map(({ state }) => (state.style as Record<string, unknown>).opacity)).toEqual([0.75, 0.75])
    expect(player.trackCapture('drag-live', { active: false })).toMatchObject({ ok: true })
    expect(liveUpdates.slice(-2).map(({ state }) => (state.style as Record<string, unknown>).opacity)).toEqual([0, 0])
    player.destroy()
  })

  it('keeps the final live pose visible across a persist-only capture close', async () => {
    const liveScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main,
            persos: [{
              id: 'item',
              type: 'tag',
              initial: { style: { opacity: 0 } },
              actions: { drag: { style: { opacity: 0.75 } } },
            }],
          },
        },
      },
      actionTargetIndex: { drag: [{ storyId: 'main', persoId: 'item' }] },
    }
    const liveUpdates: Array<{ persoKey: string; state: Record<string, unknown> }> = []
    const componentRuntime = {
      setModuleServices: () => undefined,
      getComponentSurfaces: () => ({ getSurface: () => undefined }),
      sync: () => undefined,
      updateLive: (persoKey: string, state: Record<string, unknown>) => liveUpdates.push({ persoKey, state }),
      destroy: () => undefined,
    } as unknown as RuntimeComponentRuntime
    const player = new RuntimePlayer(
      'capture-persist-live-player',
      new RuntimeEngine(new RuntimeCapabilityCatalog()),
      liveScene,
      undefined,
      undefined,
      undefined,
      [],
      undefined,
      componentRuntime,
    )

    expect(player.init().ok).toBe(true)
    expect(player.beginCapture({
      captureId: 'drag-persist-live',
      storyId: 'main',
      declaration: {
        trackCommand: () => ({ action: { actionName: 'drag' } }),
        endCapture: () => ({ events: [{ name: 'capture:stored' }] }),
      },
    }).ok).toBe(true)
    expect(player.trackCapture('drag-persist-live', { value: 1 })).toMatchObject({ ok: true })
    expect(liveUpdates.at(-1)?.state.style).toEqual({ opacity: 0.75 })
    const updateCountAtEnd = liveUpdates.length

    const ended = await player.endCapture('drag-persist-live')
    expect(ended.ok).toBe(true)
    expect(liveUpdates).toHaveLength(updateCountAtEnd)
    expect(liveUpdates.at(-1)?.state.style).toEqual({ opacity: 0.75 })
    player.destroy()
  })
})

/** Creates one player with the single story strap used by the capture tests. */
function createPlayer(listenOn?: string): RuntimePlayer {
  const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
  const playerScene = listenOn === undefined
    ? scene
    : {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          ...scene.scene.stories,
          main: {
            ...scene.scene.stories.main,
            listen: [
              ...scene.scene.stories.main.listen,
              { on: listenOn, straps: ['commit-capture'] },
            ],
          },
        },
      },
    }
  return new RuntimePlayer(
    'capture-player',
    engine,
    playerScene,
    undefined,
    {
      scene: {},
      stories: {
        main: {
          'commit-capture': ({ event }) => {
            const rawCaptureState = event.data?.captureState
            const value = isPlainRecord(rawCaptureState)
              && !('ref' in rawCaptureState)
              && typeof rawCaptureState.value === 'number'
              ? rawCaptureState.value
              : 0
            return { update: { value } }
          },
        },
      },
    },
  )
}

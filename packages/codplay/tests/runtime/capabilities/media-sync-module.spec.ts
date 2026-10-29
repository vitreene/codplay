import { describe, expect, it } from 'vitest'

import {
  createMediaSyncModuleService,
} from '../../../src/runtime/capabilities/media-sync'
import type { RuntimeModuleServiceInstance } from '../../../src/runtime/engine'
import type { CompiledRecord, CompiledScene } from '../../../src/scene/compiled'
import type { SolvedScene } from '../../../src/runtime/player/pipeline'
import type {
  MediaComponentSurface,
  MediaSync,
  RuntimeComponentSurfaceResolver,
} from '../../../src/runtime/components'

/** Selects one initial clock mode without changing the shared command fixture. */
function sceneWithSync(sync?: MediaSync): CompiledScene {
  return {
    ...compiledScene,
    scene: {
      ...compiledScene.scene,
      stories: {
        main: {
          ...compiledScene.scene.stories.main!,
          persos: compiledScene.scene.stories.main!.persos.map((perso) => ({
            ...perso,
            initial: { src: '/audio.mp3', ...(sync === undefined ? {} : { sync }) },
          })),
        },
      },
    },
  }
}

/** Creates a native playback probe whose clock can advance without CodPlay. */
function mediaProbe() {
  const state = { currentMs: 0, paused: true, rate: 1, lowerBound: 0 }
  const calls: string[] = []
  const surface: MediaComponentSurface = {
    seekTo: (value) => { calls.push(`seek:${value}`); state.currentMs = Math.max(state.lowerBound, value) },
    play: () => { calls.push('play'); state.paused = false },
    pause: () => { calls.push('pause'); state.paused = true },
    stopAt: (value) => { calls.push(`stop:${value}`); state.currentMs = Math.max(state.lowerBound, value); state.paused = true },
    getCurrentTimeMs: () => state.currentMs,
    getDurationMs: () => null,
    isPaused: () => state.paused,
    setRate: (value) => { calls.push(`rate:${value}`); state.rate = value },
    setPlaybackWindow: (startMs) => { state.lowerBound = startMs },
  }
  return { state, calls, surface }
}

/** Appends a distinct command occurrence to the solved fixture at its current time. */
function withCommand(scene: SolvedScene, type: 'START' | 'PAUSE' | 'STOP', startAt?: number): SolvedScene {
  const perso = scene.persos['main:audio']!
  return {
    ...scene,
    persos: {
      ...scene.persos,
      'main:audio': {
        ...perso,
        actions: [...perso.actions ?? [], {
          name: `${type}-${scene.timeMs}`,
          startAt: scene.timeMs,
          elapsedMs: 0,
          trackId: 'main',
          trackOrder: 0,
          declarationPath: [1],
          action: { broadcast: { type, ...(startAt === undefined ? {} : { startAt }) } },
        }],
      },
    },
  }
}

const compiledScene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-22T00:00:00.000Z',
  scene: {
    id: 'media-sync-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'audio',
          type: 'media',
          initial: { src: '/audio.mp3', sync: 'master' },
          actions: { audio: null, start: { broadcast: { type: 'START' } } },
        }],
        listen: [],
        tracks: {},
      },
    },
    listen: [],
    tracks: {},
  },
  resources: { entries: [] },
  rootNodeIds: [],
  requirements: { components: ['media'], services: [], modules: ['media-sync'], resources: [] },
  actionTargetIndex: { audio: [{ storyId: 'main', persoId: 'audio' }], start: [{ storyId: 'main', persoId: 'audio' }] },
}

const nonMasterCompiledScene: CompiledScene = {
  ...compiledScene,
  scene: {
    ...compiledScene.scene,
    stories: {
      main: {
        ...compiledScene.scene.stories.main,
        persos: compiledScene.scene.stories.main.persos.map((perso) => ({
          ...perso,
          initial: { ...perso.initial, sync: 'auto' },
        })),
      },
    },
  },
}

const dualMasterCompiledScene: CompiledScene = {
  ...compiledScene,
  scene: {
    ...compiledScene.scene,
    stories: {
      ...compiledScene.scene.stories,
      main: {
        ...compiledScene.scene.stories.main,
        persos: [
          ...compiledScene.scene.stories.main.persos,
          {
            id: 'video',
            type: 'media',
            initial: { src: '/video.mp4', sync: 'master' },
            actions: {
              video: null,
              'video-start': { broadcast: { type: 'START' } },
            },
          },
        ],
      },
    },
  },
}

function solved(timeMs: number, scene: CompiledScene = compiledScene): SolvedScene {
  const sync = scene.scene.stories.main.persos[0]?.initial.sync ?? 'auto'
  return {
    scene,
    timeMs,
    sceneState: {},
    storyStates: { main: {} },
    persos: {
      'main:audio': {
        key: 'main:audio',
        storyId: 'main',
        persoId: 'audio',
        type: 'media',
        state: { src: '/audio.mp3', sync },
        actions: [{
          name: 'start',
          startAt: 0,
          elapsedMs: timeMs,
          trackId: 'main',
          trackOrder: 0,
          declarationPath: [0],
          action: { broadcast: { type: 'START' } },
        }],
        placement: { kind: 'unspecified', mounted: false },
        moveIssues: [],
      },
    },
    graph: { revision: 'test', rootPersoKeys: [], targetByPerso: {}, parentByPerso: {}, childrenByTarget: {}, childrenByParent: {} },
    moveIssues: [],
  }
}

function solvedWithVideo(
  timeMs: number,
  scene: CompiledScene = compiledScene,
  transition?: CompiledRecord,
): SolvedScene {
  const base = solved(timeMs, scene)
  const videoSync = scene.scene.stories.main?.persos.find((perso) => perso.id === 'video')?.initial.sync ?? 'auto'
  return {
    ...base,
    persos: {
      ...base.persos,
      'main:video': {
        key: 'main:video',
        storyId: 'main',
        persoId: 'video',
        type: 'media',
        state: { src: '/video.mp4', sync: videoSync },
        actions: timeMs < 1000
          ? []
          : [{
              name: 'video-start',
              startAt: 1000,
              elapsedMs: timeMs - 1000,
              trackId: 'main',
              trackOrder: 0,
              declarationPath: [1],
              action: {
                broadcast: {
                  type: 'START',
                  ...(transition === undefined ? {} : { transition }),
                },
              },
            }],
        placement: { kind: 'unspecified', mounted: false },
        moveIssues: [],
      },
    },
  }
}

/** Creates the typed media surface registry used by module-level tests. */
function componentSurfaces(
  resolve: (runtimeItemId: string) => MediaComponentSurface | undefined,
): RuntimeComponentSurfaceResolver {
  return {
    getSurface: <SurfaceId extends 'media'>(runtimeItemId: string, _surfaceId: SurfaceId) =>
      resolve(runtimeItemId),
  }
}

describe('V2 media-sync module service', () => {
  it('defaults to auto and keeps native playback under the scene transport', () => {
    const scene = sceneWithSync()
    const probe = mediaProbe()
    const service = createMediaSyncModuleService({ playerId: 'default-mode', compiledScene: scene, componentSurfaces: componentSurfaces(() => probe.surface) })
    service.onScenePresented?.(solved(0, scene), 'playing')
    probe.state.currentMs = 730
    service.onPlaybackStateChange?.('paused', 500)
    expect(probe.state).toMatchObject({ currentMs: 500, paused: true })
    expect(service.resolveTimelineMs?.(800)).toBe(800)
  })

  it('keeps independent native controls and clock unchanged across scene transport and reconstruction', () => {
    const scene = sceneWithSync('independent')
    const probe = mediaProbe()
    const service = createMediaSyncModuleService({ playerId: 'independent-mode', compiledScene: scene, componentSurfaces: componentSurfaces(() => probe.surface) })
    service.onScenePresented?.(solved(0, scene), 'playing')
    expect(probe.calls).toEqual(['seek:0', 'play'])
    probe.calls.length = 0
    probe.state.currentMs = 730
    probe.state.paused = true
    service.onScenePresented?.(solved(100, scene), 'playing')
    service.onPlaybackStateChange?.('paused', 100)
    service.onRateChange?.(2)
    expect(service.resolveTimelineMs?.(150)).toBe(150)
    service.beforeSeek?.(100)
    service.prepareSeek?.(solved(900, scene)).commit()
    service.onScenePresented?.(solved(900, scene), 'playing')
    service.onScenePresented?.(solved(0, scene), 'paused')
    expect(probe.calls).toEqual([])
    expect(probe.state).toMatchObject({ currentMs: 730, paused: true, rate: 1 })
    service.destroy?.()
    expect(probe.state.paused).toBe(true)
  })

  it('pauses independent media at native time once and allows native resume afterward', () => {
    const scene = sceneWithSync('independent')
    const probe = mediaProbe()
    const service = createMediaSyncModuleService({ playerId: 'independent-pause', compiledScene: scene, componentSurfaces: componentSurfaces(() => probe.surface) })
    service.onScenePresented?.(solved(0, scene), 'playing')
    probe.state.currentMs = 4_200
    probe.calls.length = 0
    const paused = withCommand(solved(100, scene), 'PAUSE')
    service.onScenePresented?.(paused, 'playing')
    expect(probe.calls).toEqual(['pause'])
    expect(probe.state).toMatchObject({ currentMs: 4_200, paused: true })
    probe.state.paused = false
    service.onScenePresented?.({ ...paused, timeMs: 200 }, 'playing')
    expect(probe.calls).toEqual(['pause'])
    expect(probe.state.paused).toBe(false)
  })

  it.each(['auto', 'master', 'independent'] as const)('STOP stops and resets %s media after a nonzero segment start', (sync) => {
    const scene = sceneWithSync(sync)
    const probe = mediaProbe()
    const service = createMediaSyncModuleService({ playerId: `stop-${sync}`, compiledScene: scene, componentSurfaces: componentSurfaces(() => probe.surface) })
    service.onScenePresented?.(withCommand(solved(0, scene), 'START', 1_000), 'playing')
    probe.state.currentMs = 2_800
    probe.calls.length = 0
    const stopped = withCommand(solved(200, scene), 'STOP')
    service.onScenePresented?.(stopped, 'playing')
    expect(probe.state).toMatchObject({ currentMs: 0, paused: true, lowerBound: 0 })
    expect(probe.calls).toContain('stop:0')
    const callsAfterStop = [...probe.calls]
    service.onScenePresented?.({ ...stopped, timeMs: 300 }, 'playing')
    expect(probe.calls).toEqual(callsAfterStop)
  })

  it('isolates independent playback between players', () => {
    const scene = sceneWithSync('independent')
    const first = mediaProbe()
    const second = mediaProbe()
    const services = [first, second].map((probe, index) => createMediaSyncModuleService({
      playerId: `independent-${index}`, compiledScene: scene, componentSurfaces: componentSurfaces(() => probe.surface),
    }))
    for (const service of services) service.onScenePresented?.(solved(0, scene), 'playing')
    services[0]?.onScenePresented?.(withCommand(solved(100, scene), 'STOP'), 'playing')
    expect(first.state.paused).toBe(true)
    expect(second.state.paused).toBe(false)
    services[1]?.destroy?.()
    expect(second.state.paused).toBe(true)
  })

  it('pauses active native media before seek reconstruction', () => {
    let paused = false
    let currentMs = 480
    const component = {
      seekTo: (value: number) => { currentMs = value },
      play: () => { paused = false },
      pause: () => { paused = true },
      stopAt: (value: number) => { currentMs = value; paused = true },
      getCurrentTimeMs: () => currentMs,
      getDurationMs: () => null,
      isPaused: () => paused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'test-player',
      compiledScene,
      componentSurfaces: componentSurfaces(() => component),
    })

    service.initializeScene?.(solved(0))
    service.onScenePresented?.(solved(0), 'paused')
    service.onPlaybackStateChange?.('playing', 0)
    service.beforeSeek?.(480)

    expect(paused).toBe(true)
  })

  it('uses an active master media as the logical clock and resynchronizes on seek', () => {
    let paused = true
    let currentMs = 0
    const component = {
      seekTo: (value: number) => { currentMs = value },
      play: () => { paused = false },
      pause: () => { paused = true },
      stopAt: (value: number) => { currentMs = value; paused = true },
      getCurrentTimeMs: () => currentMs,
      getDurationMs: () => null,
      isPaused: () => paused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'test-player',
      compiledScene,
      componentSurfaces: componentSurfaces(() => component),
    })
    const scene = solved(0)

    service.initializeScene?.(scene)
    service.onScenePresented?.(scene, 'paused')
    service.onPlaybackStateChange?.('playing', 0)
    currentMs = 480

    expect(service.resolveTimelineMs?.(1000)).toBe(480)

    service.onScenePresented?.(solved(1000), 'playing')
    expect(currentMs).toBe(480)

    const handle = service.prepareSeek?.(solved(1000))
    handle?.commit()
    service.onScenePresented?.(solved(1000), 'playing')
    expect(currentMs).toBe(1000)
  })

  it('does not seek a non-master native media on ordinary playback frames', () => {
    let paused = true
    let currentMs = 0
    let seekCount = 0
    const component = {
      seekTo: (value: number) => { seekCount += 1; currentMs = value },
      play: () => { paused = false },
      pause: () => { paused = true },
      stopAt: (value: number) => { currentMs = value; paused = true },
      getCurrentTimeMs: () => currentMs,
      getDurationMs: () => null,
      isPaused: () => paused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'test-player',
      compiledScene: nonMasterCompiledScene,
      componentSurfaces: componentSurfaces(() => component),
    })
    const scene = solved(0, nonMasterCompiledScene)

    service.initializeScene?.(scene)
    service.onScenePresented?.(scene, 'paused')
    service.onPlaybackStateChange?.('playing', 0)
    seekCount = 0

    currentMs = 100
    service.onScenePresented?.(solved(100, nonMasterCompiledScene), 'playing')
    currentMs = 200
    service.onScenePresented?.(solved(200, nonMasterCompiledScene), 'playing')

    expect(seekCount).toBe(0)
  })

  it('applies a newly entered broadcast without resetting the active master', () => {
    let audioPaused = true
    let audioCurrentMs = 0
    let videoPaused = true
    let videoCurrentMs = 0
    const audioCalls: string[] = []
    const videoCalls: string[] = []
    const audio = {
      seekTo: (value: number) => { audioCalls.push(`seek:${value}`); audioCurrentMs = value },
      play: () => { audioCalls.push('play'); audioPaused = false },
      pause: () => { audioCalls.push('pause'); audioPaused = true },
      stopAt: (value: number) => { audioCalls.push(`stop:${value}`); audioCurrentMs = value; audioPaused = true },
      getCurrentTimeMs: () => audioCurrentMs,
      getDurationMs: () => 10_000,
      isPaused: () => audioPaused,
    }
    const video = {
      seekTo: (value: number) => { videoCalls.push(`seek:${value}`); videoCurrentMs = value },
      play: () => { videoCalls.push('play'); videoPaused = false },
      pause: () => { videoCalls.push('pause'); videoPaused = true },
      stopAt: (value: number) => { videoCalls.push(`stop:${value}`); videoCurrentMs = value; videoPaused = true },
      getCurrentTimeMs: () => videoCurrentMs,
      getDurationMs: () => 5_890,
      isPaused: () => videoPaused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'incremental-broadcast',
      compiledScene,
      componentSurfaces: componentSurfaces((runtimeItemId) => runtimeItemId === 'main:audio' ? audio : video),
    })
    const initial = solvedWithVideo(0)

    service.initializeScene?.(initial)
    service.onScenePresented?.(initial, 'paused')
    service.onPlaybackStateChange?.('playing', 0)
    audioCalls.length = 0
    videoCalls.length = 0
    audioCurrentMs = 250
    audioPaused = false

    service.onScenePresented?.(solvedWithVideo(1000), 'playing')

    expect(audioCalls).toEqual([])
    expect(videoCalls).toEqual(['seek:0', 'play'])
  })

  it('pauses the previous master when a later master becomes active', () => {
    let audioPaused = true
    let videoPaused = true
    const audioCalls: string[] = []
    const videoCalls: string[] = []
    const audio = {
      seekTo: () => undefined,
      play: () => { audioCalls.push('play'); audioPaused = false },
      pause: () => { audioCalls.push('pause'); audioPaused = true },
      stopAt: () => undefined,
      getCurrentTimeMs: () => 0,
      getDurationMs: () => 10_000,
      isPaused: () => audioPaused,
    }
    const video = {
      seekTo: () => { videoCalls.push('seek') },
      play: () => { videoCalls.push('play'); videoPaused = false },
      pause: () => { videoCalls.push('pause'); videoPaused = true },
      stopAt: () => undefined,
      getCurrentTimeMs: () => 0,
      getDurationMs: () => 10_000,
      isPaused: () => videoPaused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'master-switch',
      compiledScene: dualMasterCompiledScene,
      componentSurfaces: componentSurfaces((runtimeItemId) => runtimeItemId === 'main:audio' ? audio : video),
    })

    service.initializeScene?.(solvedWithVideo(0, dualMasterCompiledScene))
    service.onScenePresented?.(solvedWithVideo(0, dualMasterCompiledScene), 'paused')
    service.onPlaybackStateChange?.('playing', 0)
    audioCalls.length = 0
    videoCalls.length = 0

    service.onScenePresented?.(solvedWithVideo(1000, dualMasterCompiledScene), 'playing')

    expect(audioCalls).toContain('pause')
    expect(videoCalls).toEqual(['seek', 'play'])
  })

  it('applies a broadcast transition from the same scene presentation circuit', () => {
    let paused = true
    let appliedProgress = -1
    const video = {
      seekTo: () => undefined,
      play: () => { paused = false },
      pause: () => { paused = true },
      stopAt: () => undefined,
      getCurrentTimeMs: () => 0,
      getDurationMs: () => null,
      isPaused: () => paused,
      applyTransition: (_transition: unknown, progress: number) => { appliedProgress = progress },
    }
    const service = createMediaSyncModuleService({
      playerId: 'media-transition',
      compiledScene,
      componentSurfaces: componentSurfaces((runtimeItemId) => runtimeItemId === 'main:video' ? video : undefined),
    })
    const transition: CompiledRecord = {
      from: { volume: 0 },
      to: { volume: 1 },
      duration: 1000,
    }

    service.initializeScene?.(solvedWithVideo(0))
    service.onScenePresented?.(solvedWithVideo(0), 'paused')
    service.onScenePresented?.(solvedWithVideo(1500, compiledScene, transition), 'paused')

    expect(appliedProgress).toBe(0.5)
  })

  it('forwards the player rate to every tracked media component', () => {
    const receivedRates: number[] = []
    const component = {
      seekTo: () => undefined,
      play: () => undefined,
      pause: () => undefined,
      stopAt: () => undefined,
      getCurrentTimeMs: () => 0,
      getDurationMs: () => null,
      isPaused: () => true,
      setRate: (rate: number) => { receivedRates.push(rate) },
    }
    const service = createMediaSyncModuleService({
      playerId: 'media-rate',
      compiledScene,
      componentSurfaces: componentSurfaces(() => component),
    })

    service.initializeScene?.(solvedWithVideo(0))
    service.onRateChange?.(0.5)

    expect(receivedRates).toEqual([0.5, 0.5])
  })

  it('stops a native media that has ended without attempting to play it again', () => {
    let videoPaused = true
    let videoCurrentMs = 0
    const videoCalls: string[] = []
    const video = {
      seekTo: (value: number) => { videoCalls.push(`seek:${value}`); videoCurrentMs = value },
      play: () => { videoCalls.push('play'); videoPaused = false },
      pause: () => { videoCalls.push('pause'); videoPaused = true },
      stopAt: (value: number) => { videoCalls.push(`stop:${value}`); videoCurrentMs = value; videoPaused = true },
      getCurrentTimeMs: () => videoCurrentMs,
      getDurationMs: () => 5_890,
      isPaused: () => videoPaused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'native-end',
      compiledScene,
      componentSurfaces: componentSurfaces((runtimeItemId) => runtimeItemId === 'main:video' ? video : undefined),
    })

    service.initializeScene?.(solvedWithVideo(0))
    service.onScenePresented?.(solvedWithVideo(0), 'paused')
    service.onScenePresented?.(solvedWithVideo(1000), 'playing')
    videoCalls.length = 0
    videoCurrentMs = 5_890
    videoPaused = true

    service.onScenePresented?.(solvedWithVideo(6_880), 'playing')

    expect(videoCalls).toEqual(['stop:5890'])
  })

  it('replays media when the terminal timeline returns to its initial time', () => {
    let paused = true
    let currentMs = 0
    const calls: string[] = []
    const component = {
      seekTo: (value: number) => { calls.push(`seek:${value}`); currentMs = value },
      play: () => { calls.push('play'); paused = false },
      pause: () => { calls.push('pause'); paused = true },
      stopAt: (value: number) => { calls.push(`stop:${value}`); currentMs = value; paused = true },
      getCurrentTimeMs: () => currentMs,
      getDurationMs: () => 1_200,
      isPaused: () => paused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'terminal-replay',
      compiledScene,
      componentSurfaces: componentSurfaces(() => component),
    })

    service.initializeScene?.(solved(0))
    service.onScenePresented?.(solved(0), 'paused')
    service.onScenePresented?.(solved(200), 'playing')
    currentMs = 1_200
    paused = true
    service.onScenePresented?.(solved(1_200), 'playing')
    calls.length = 0

    service.onScenePresented?.(solved(0), 'playing')

    expect(calls).toEqual(['pause', 'seek:0', 'play'])
    expect(currentMs).toBe(0)
    expect(paused).toBe(false)
  })

  it('falls back to the ticker while the master media is paused', () => {
    const service: RuntimeModuleServiceInstance = createMediaSyncModuleService({
      playerId: 'test-player',
      compiledScene,
      componentSurfaces: componentSurfaces(() => ({
        seekTo: () => undefined,
        play: () => undefined,
        pause: () => undefined,
        stopAt: () => undefined,
        getCurrentTimeMs: () => 100,
        getDurationMs: () => null,
        isPaused: () => true,
      })),
    })
    const scene = solved(0)
    service.initializeScene?.(scene)
    service.onScenePresented?.(scene, 'playing')

    expect(service.resolveTimelineMs?.(250)).toBe(250)
  })

  it('replays the active broadcast when a seek moves behind a native media end', () => {
    let paused = true
    let currentMs = 0
    const component = {
      seekTo: (value: number) => { currentMs = value },
      play: () => { paused = false },
      pause: () => { paused = true },
      stopAt: (value: number) => { currentMs = value; paused = true },
      getCurrentTimeMs: () => currentMs,
      getDurationMs: () => 10_000,
      isPaused: () => paused,
    }
    const service = createMediaSyncModuleService({
      playerId: 'test-player',
      compiledScene,
      componentSurfaces: componentSurfaces(() => component),
    })

    service.initializeScene?.(solved(0))
    service.onScenePresented?.(solved(0), 'paused')
    service.onScenePresented?.(solved(12_000), 'paused')
    expect(currentMs).toBe(10_000)

    const handle = service.prepareSeek?.(solved(4_500))
    handle?.commit()
    service.onScenePresented?.(solved(4_500), 'paused')

    expect(currentMs).toBe(4_500)
  })
})

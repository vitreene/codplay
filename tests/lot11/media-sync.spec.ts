import { describe, expect, it } from 'vitest'

import { createMediaSyncRuntime } from '../../src/runtime/media-sync'
import { appendMediaTraceEntries, createRuntimeTraceStore } from '../../src/runtime/trace-store'

describe('Lot 11 - media sync and master switching', () => {
  it('L11-T1 keeps a single active master based on active track', () => {
    const runtime = createMediaSyncRuntime({ initialPlayerPlaybackState: 'playing' })

    runtime.registerTrack({ trackId: 'track-fr', order: 1, active: true })
    runtime.registerTrack({ trackId: 'track-en', order: 2, active: false })

    runtime.registerMedia({
      runtimeItemId: 'voice-fr',
      trackId: 'track-fr',
      isMaster: true,
      logicalIntent: 'playing',
      mediaMs: 120
    })
    runtime.registerMedia({
      runtimeItemId: 'voice-en',
      trackId: 'track-en',
      isMaster: true,
      logicalIntent: 'playing',
      mediaMs: 95
    })

    const result = runtime.refreshMaster()

    expect(result.activeMasterRuntimeItemId).toBe('voice-fr')
    expect(result.operations).toEqual([
      {
        type: 'media:play',
        runtimeItemId: 'voice-fr',
        startMediaMs: 120
      }
    ])
  })

  it('L11-T2 switch FR->EN pauses previous master before playing next', () => {
    const runtime = createMediaSyncRuntime({ initialPlayerPlaybackState: 'playing' })

    runtime.registerTrack({ trackId: 'track-fr', order: 1, active: true })
    runtime.registerTrack({ trackId: 'track-en', order: 2, active: false })

    runtime.registerMedia({
      runtimeItemId: 'voice-fr',
      trackId: 'track-fr',
      isMaster: true,
      logicalIntent: 'playing',
      playbackState: 'playing',
      mediaMs: 200
    })
    runtime.registerMedia({
      runtimeItemId: 'voice-en',
      trackId: 'track-en',
      isMaster: true,
      logicalIntent: 'playing',
      playbackState: 'paused',
      mediaMs: 200
    })

    runtime.refreshMaster()

    const result = runtime.applyTrackStatePatches([
      { trackId: 'track-fr', active: false },
      { trackId: 'track-en', active: true }
    ])

    expect(result.activeMasterRuntimeItemId).toBe('voice-en')
    expect(result.operations).toEqual([
      { type: 'media:pause', runtimeItemId: 'voice-fr' },
      { type: 'media:play', runtimeItemId: 'voice-en', startMediaMs: 200 }
    ])

    const playOperations = result.operations.filter((operation) => operation.type === 'media:play')
    expect(playOperations).toHaveLength(1)
  })

  it('L11-T3 sync emits correction only when drift exceeds threshold', () => {
    const runtime = createMediaSyncRuntime({ initialPlayerPlaybackState: 'playing', thresholdMs: 80 })

    runtime.registerTrack({ trackId: 'track-fr', order: 1, active: true })
    runtime.registerMedia({
      runtimeItemId: 'voice-fr',
      trackId: 'track-fr',
      isMaster: true,
      logicalIntent: 'playing',
      mediaMs: 1000,
      playbackState: 'playing'
    })
    runtime.refreshMaster()

    const result = runtime.syncMasterToTimeline(1145)

    expect(result.operations).toEqual([
      {
        type: 'media:seek',
        runtimeItemId: 'voice-fr',
        targetMediaMs: 1145
      }
    ])
    expect(result.trace).toEqual([
      expect.objectContaining({
        eventName: 'media:sync:corrected',
        runtimeItemId: 'voice-fr',
        payload: {
          driftMs: 145
        }
      })
    ])
  })

  it('L11-T4 sync skips correction trace when drift stays within threshold', () => {
    const runtime = createMediaSyncRuntime({ initialPlayerPlaybackState: 'playing', thresholdMs: 80 })

    runtime.registerTrack({ trackId: 'track-fr', order: 1, active: true })
    runtime.registerMedia({
      runtimeItemId: 'voice-fr',
      trackId: 'track-fr',
      isMaster: true,
      logicalIntent: 'playing',
      mediaMs: 1000,
      playbackState: 'playing'
    })
    runtime.refreshMaster()

    const result = runtime.syncMasterToTimeline(1075)

    expect(result.operations).toEqual([])
    expect(result.trace.some((entry) => entry.eventName === 'media:sync:corrected')).toBe(false)
  })

  it('L11-T5 global player state controls master playback and keeps ended media paused', () => {
    const runtime = createMediaSyncRuntime({ initialPlayerPlaybackState: 'playing' })

    runtime.registerTrack({ trackId: 'track-fr', order: 1, active: true })
    runtime.registerMedia({
      runtimeItemId: 'voice-fr',
      trackId: 'track-fr',
      isMaster: true,
      logicalIntent: 'playing',
      playbackState: 'playing',
      mediaMs: 300
    })
    runtime.refreshMaster()

    const pausedResult = runtime.setPlayerPlaybackState('paused')
    expect(pausedResult.operations).toEqual([{ type: 'media:pause', runtimeItemId: 'voice-fr' }])

    const resumedResult = runtime.setPlayerPlaybackState('playing')
    expect(resumedResult.operations).toEqual([
      { type: 'media:play', runtimeItemId: 'voice-fr', startMediaMs: 300 }
    ])

    runtime.updateMediaSnapshot('voice-fr', {
      logicalIntent: 'ended',
      playbackState: 'paused'
    })

    const endedResult = runtime.setPlayerPlaybackState('playing')
    expect(endedResult.operations).toEqual([])
  })

  it('L11-T6 media trace entries are exportable through runtime trace store', () => {
    const runtime = createMediaSyncRuntime({ initialPlayerPlaybackState: 'playing', thresholdMs: 80 })
    runtime.registerTrack({ trackId: 'track-fr', order: 1, active: true })
    runtime.registerMedia({
      runtimeItemId: 'voice-fr',
      trackId: 'track-fr',
      isMaster: true,
      logicalIntent: 'playing',
      mediaMs: 0,
      playbackState: 'playing'
    })
    runtime.refreshMaster()

    const syncResult = runtime.syncMasterToTimeline(200)
    const traceStore = createRuntimeTraceStore({ nowProvider: () => 1 })
    appendMediaTraceEntries(traceStore, syncResult.trace, 'corr-media')

    expect(traceStore.list({ scope: 'media' })).toEqual([
      expect.objectContaining({
        eventName: 'media:sync:corrected',
        sourceId: 'voice-fr',
        correlationId: 'corr-media'
      })
    ])
  })
})

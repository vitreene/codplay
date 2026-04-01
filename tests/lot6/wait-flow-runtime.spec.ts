import { describe, expect, it } from 'vitest'

import { createWaitFlowRuntime, type StoryRef } from '../../src/runtime/wait-flow'

/**
 * Creates a story reference used across wait-flow tests.
 */
function createStoryRef(storyId: string, instanceId: string): StoryRef {
  return {
    storyId,
    instanceId
  }
}

describe('Lot 06 - wait flow runtime', () => {
  it('L6-T1 startWait in parallel keeps source running and starts wait story', () => {
    const waitFlow = createWaitFlowRuntime()

    const result = waitFlow.startWait({
      mode: 'parallel',
      fromStory: createStoryRef('story-main', 'story-main#1'),
      waitStory: createStoryRef('story-wait', 'story-wait#1')
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected startWait to succeed in parallel mode')
    }

    expect(result.data.wait.mode).toBe('parallel')
    expect(result.data.wait.frozenCursorMs).toBeUndefined()
    expect(result.data.wait.disabledTrackIds).toEqual([])
    expect(result.data.operations).toContainEqual({
      type: 'story:start',
      storyRef: createStoryRef('story-wait', 'story-wait#1')
    })
    expect(result.data.operations.some((operation) => operation.type === 'story:pause')).toBe(false)
    expect(result.data.trace.map((entry) => entry.eventName)).toEqual([
      'scenario:wait:start',
      'scenario:wait:started'
    ])
  })

  it('L6-T2 startWait in suspendSource freezes cursor and disables source tracks', () => {
    const waitFlow = createWaitFlowRuntime()

    const result = waitFlow.startWait({
      mode: 'suspendSource',
      fromStory: createStoryRef('story-main', 'story-main#1'),
      waitStory: createStoryRef('story-wait', 'story-wait#1'),
      fromStoryCursorMs: 1234,
      fromStoryTrackIds: ['track-main-a', 'track-main-b']
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error('Expected startWait to succeed in suspendSource mode')
    }

    expect(result.data.wait.frozenCursorMs).toBe(1234)
    expect(result.data.wait.disabledTrackIds).toEqual(['track-main-a', 'track-main-b'])
    expect(result.data.operations).toContainEqual({
      type: 'story:pause',
      storyRef: createStoryRef('story-main', 'story-main#1')
    })
    expect(result.data.operations).toContainEqual({ type: 'track:disable', trackId: 'track-main-a' })
    expect(result.data.operations).toContainEqual({ type: 'track:disable', trackId: 'track-main-b' })
  })

  it('L6-T3 resolveWait restores tracks and resumes source from frozen cursor', () => {
    const waitFlow = createWaitFlowRuntime()

    const startResult = waitFlow.startWait({
      mode: 'suspendSource',
      fromStory: createStoryRef('story-main', 'story-main#1'),
      waitStory: createStoryRef('story-wait', 'story-wait#1'),
      fromStoryCursorMs: 640,
      fromStoryTrackIds: ['track-main-a']
    })

    expect(startResult.ok).toBe(true)
    if (!startResult.ok) {
      throw new Error('Expected wait start to succeed before resolve')
    }

    const resolveResult = waitFlow.resolveWait({
      waitId: startResult.data.wait.waitId
    })

    expect(resolveResult.ok).toBe(true)
    if (!resolveResult.ok) {
      throw new Error('Expected resolveWait to succeed')
    }

    expect(resolveResult.data.resumedAtMs).toBe(640)
    expect(resolveResult.data.operations).toContainEqual({ type: 'track:enable', trackId: 'track-main-a' })
    expect(resolveResult.data.operations).toContainEqual({
      type: 'story:resume',
      storyRef: createStoryRef('story-main', 'story-main#1'),
      atMs: 640
    })
    expect(waitFlow.getWait(startResult.data.wait.waitId)).toBeNull()
  })

  it('L6-T4 resolveWait with fromStart resumes source at zero', () => {
    const waitFlow = createWaitFlowRuntime()

    const startResult = waitFlow.startWait({
      mode: 'suspendSource',
      fromStory: createStoryRef('story-main', 'story-main#1'),
      waitStory: createStoryRef('story-wait', 'story-wait#1'),
      fromStoryCursorMs: 640
    })

    expect(startResult.ok).toBe(true)
    if (!startResult.ok) {
      throw new Error('Expected wait start to succeed before fromStart resolve')
    }

    const resolveResult = waitFlow.resolveWait({
      waitId: startResult.data.wait.waitId,
      resumePolicy: 'fromStart'
    })

    expect(resolveResult.ok).toBe(true)
    if (!resolveResult.ok) {
      throw new Error('Expected resolveWait to succeed with fromStart policy')
    }

    expect(resolveResult.data.resumedAtMs).toBe(0)
    expect(resolveResult.data.operations).toContainEqual({
      type: 'story:resume',
      storyRef: createStoryRef('story-main', 'story-main#1'),
      atMs: 0
    })
  })

  it('L6-T5 suspendSource without source story is rejected', () => {
    const waitFlow = createWaitFlowRuntime()

    const result = waitFlow.startWait({
      mode: 'suspendSource',
      waitStory: createStoryRef('story-wait', 'story-wait#1')
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected wait start to fail without source story')
    }

    expect(result.error.code).toBe('WAIT_SOURCE_REQUIRED_FOR_SUSPEND')
  })

  it('L6-T6 resolving an unknown waitId is rejected', () => {
    const waitFlow = createWaitFlowRuntime()
    const result = waitFlow.resolveWait({ waitId: 'wait-missing' })

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected resolveWait to fail for unknown waitId')
    }

    expect(result.error.code).toBe('WAIT_NOT_FOUND')
  })
})

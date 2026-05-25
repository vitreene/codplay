import { describe, expect, it, vi, type Mock } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import { PlayerFacade } from '../../src/player/create-player'
import type { RuntimeTraceRow } from '../../src/runtime/trace-store'
import type { SeekPolicy } from '../../src/player/types'
import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../src/runtime/create-element'
import {
  createS1CanariScene,
  createS2ReferenceScene,
  createS3RobustesseScene,
  createS4QuizReferenceScene,
  s4QuizStraps
} from '../../src/demos/scenes'

const EXPECTED_PLAYER_STATUS = {
  ready: 'ready'
} as const

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
  src?: string
  currentTime?: number
  duration?: number
  paused?: boolean
  play?: Mock
  pause?: Mock
  [RUNTIME_OBJECT_EVENT_HANDLERS]?: Record<string, () => void>
}

/**
 * Creates one anime implementation that applies target end values immediately.
 */
function createApplyingAnimeImplementation() {
  return vi.fn<AnimeImplementation>((parameters) => {
    const targets = Array.isArray(parameters.targets)
      ? (parameters.targets as Record<string, unknown>[])
      : [parameters.targets as Record<string, unknown>]

    for (const target of targets) {
      if (typeof target !== 'object' || target === null) {
        continue
      }

      const mutableTarget = target as Record<string, unknown>
      const mutableStyle =
        typeof mutableTarget.style === 'object' && mutableTarget.style !== null
          ? (mutableTarget.style as Record<string, unknown>)
          : null

      for (const [property, value] of Object.entries(parameters)) {
        if (property === 'targets' || property === 'duration' || property === 'delay' || property === 'ease' || property === 'composition' || property === 'stagger' || property === 'loopDelay' || property === 'reversed' || property === 'alternate' || property === 'loop') {
          continue
        }

        const resolvedValue =
          typeof value === 'object' && value !== null && 'to' in value
            ? (value as { to: unknown }).to
            : value

        if (mutableStyle !== null) {
          mutableStyle[property] = resolvedValue
        } else {
          mutableTarget[property] = resolvedValue
        }
      }
    }

    return { pause: vi.fn() }
  })
}

/**
 * Creates one plain runtime node fixture for one authored perso.
 */
function createRuntimeNodeFixture(tagName: string): RuntimeNodeFixture {
  const node: RuntimeNodeFixture = {
    tagName,
    style: {},
    attributes: {}
  }

  if (tagName === 'VIDEO') {
    node.currentTime = 0
    node.duration = 12
    node.paused = true
    node.play = vi.fn(() => {
      node.paused = false
    })
    node.pause = vi.fn(() => {
      node.paused = true
    })
  }

  return node
}

async function createS4AuthorPlayer(
  animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation()),
  seekPolicy?: SeekPolicy
) {
  const builder = new BuilderFacade()
  const player = new Player({
    animationAdapter,
    runtimePolicy: seekPolicy === undefined ? undefined : { seekPolicy },
    createElementOptions: {
      nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
    }
  })
  const compileResult = builder.compile({ scene: createS4QuizReferenceScene() })

  expect(compileResult.ok).toBe(true)
  if (!compileResult.ok) {
    throw new Error('S4 compile failed')
  }

  expect(await player.init({
    mountTarget: {},
    compiledScene: compileResult.data.compiledScene,
    resourceManifest: compileResult.data.resourceManifest,
    strapCollection: s4QuizStraps
  })).toEqual({ ok: true, data: undefined })

  return player
}

describe('V1 - reference scenes', () => {
  it('loads S1 canari scene through the current player path', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS1CanariScene())

    expect(initResult.ok).toBe(true)
    expect(player.getState()).toMatchObject({
      initialized: true,
      status: EXPECTED_PLAYER_STATUS.ready,
      sceneId: 's1-canari-scene'
    })
    expect(player.getRuntimeRegistry().getNodeById('canari-title')).not.toBeNull()
  })

  it('loads S2 reference scene with deterministic list child mounting', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS2ReferenceScene())

    expect(initResult.ok).toBe(true)

    const referenceList = player.getRuntimeRegistry().getListById('reference-list')
    expect(referenceList?.getChildrenSnapshot()).toEqual(['reference-title', 'reference-caption'])
  })

  it('starts S2 reference scene only when play triggers onStart', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS2ReferenceScene())

    expect(initResult.ok).toBe(true)

    const listNodeBeforePlay = player.getRuntimeRegistry().getNodeById('reference-list') as RuntimeNodeFixture | null
    expect(listNodeBeforePlay?.className).toBe('reference-list')

    const playResult = await player.play()
    expect(playResult.ok).toBe(true)

    const listNodeAfterPlay = player.getRuntimeRegistry().getNodeById('reference-list') as RuntimeNodeFixture | null
    expect(listNodeAfterPlay?.className).toContain('reference-list-live')
  })

  it('loads S3 robustness scene and keeps transfer-ready list state', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS3RobustesseScene())

    expect(initResult.ok).toBe(true)

    const registry = player.getRuntimeRegistry()
    expect(registry.getListById('robust-stage')?.getChildrenSnapshot()).toEqual(['robust-card'])
    expect(registry.getListById('robust-overlay')?.getChildrenSnapshot()).toEqual([])
    expect(registry.getParentListId('robust-card')).toBe('robust-stage')
    expect(registry.isMounted('robust-card')).toBe(true)
  })

  it('loads S4 quiz reference scene with persistent decor and layered content mounting', async () => {
    const player = await createS4AuthorPlayer()

    const registry = player.getRuntimeRegistry()
    expect(registry.getListById('quiz-decor-layer')?.getChildrenSnapshot()).toEqual([
      'quiz-decor-circle-a',
      'quiz-decor-circle-b',
      'quiz-decor-circle-c',
      'quiz-decor-media'
    ])
    expect(registry.getListById('quiz-stage')?.getChildrenSnapshot()).toEqual([
      'quiz-decor-layer',
      'quiz-count-panel'
    ])
    expect(registry.getListById('quiz-intro-panel')?.getChildrenSnapshot()).toEqual(['quiz-intro-title'])
    expect(registry.getListById('quiz-question-panel')?.getChildrenSnapshot()).toEqual([
      'quiz-question-title',
      'quiz-answer-yes',
      'quiz-answer-no'
    ])
    expect(registry.getListById('quiz-count-panel')?.getChildrenSnapshot()).toEqual(['quiz-count-value'])
    expect(registry.getParentListId('quiz-intro-panel')).toBeNull()
    expect(registry.getParentListId('quiz-question-panel')).toBeNull()
    expect(registry.getParentListId('quiz-success-panel')).toBeNull()
    expect(registry.getParentListId('quiz-failure-panel')).toBeNull()
    expect(registry.getParentListId('quiz-count-panel')).toBe('quiz-stage')
  })

  it('plays S4 quiz reference scene through intro then question timeline states', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const registry = player.getRuntimeRegistry()
    const introPanel = registry.getNodeById('quiz-intro-panel') as RuntimeNodeFixture | null
    const questionPanel = registry.getNodeById('quiz-question-panel') as RuntimeNodeFixture | null
    const successPanel = registry.getNodeById('quiz-success-panel') as RuntimeNodeFixture | null
    const failurePanel = registry.getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null
    const countPanel = registry.getNodeById('quiz-count-panel') as RuntimeNodeFixture | null
    const countValue = registry.getNodeById('quiz-count-value') as RuntimeNodeFixture | null

    expect(introPanel?.style).toMatchObject({ opacity: 0, x: 180 })
    expect(questionPanel?.style).toMatchObject({ opacity: 1, x: 0 })
    expect(successPanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(failurePanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(countPanel?.style).toMatchObject({ opacity: 0, scale: 0.92 })
    expect(countValue?.textContent).toBe('10')
    expect(player.getState().horizon.progressEndMs).toBe(2550)

    expect(await player.seek({ timelineMs: 6000 })).toEqual({ ok: true, data: undefined })
    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 2550 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-count-value') as RuntimeNodeFixture | null)?.textContent).toBe('10')
  })

  it('routes S4 yes button emit as one cascaded runtime event', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const registry = player.getRuntimeRegistry()
    const yesButton = registry.getNodeById('quiz-answer-yes') as RuntimeNodeFixture | null
    const questionPanel = registry.getNodeById('quiz-question-panel') as RuntimeNodeFixture | null
    const successPanel = registry.getNodeById('quiz-success-panel') as RuntimeNodeFixture | null
    const failurePanel = registry.getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null

    yesButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(questionPanel?.style).toMatchObject({ opacity: 0, x: -80 })
    expect(successPanel?.style).toMatchObject({ opacity: 1, x: 0 })
    expect(failurePanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(player.getState().horizon.progressEndMs).toBeGreaterThanOrEqual(2620)

    expect(await player.seek({ timelineMs: 6000 })).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('paused')
    expect(player.getState().timelineMs).toBeGreaterThanOrEqual(2620)
    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })

  })

  it('routes S4 no button emit as one cascaded runtime event', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const registry = player.getRuntimeRegistry()
    const noButton = registry.getNodeById('quiz-answer-no') as RuntimeNodeFixture | null
    const questionPanel = registry.getNodeById('quiz-question-panel') as RuntimeNodeFixture | null
    const successPanel = registry.getNodeById('quiz-success-panel') as RuntimeNodeFixture | null
    const failurePanel = registry.getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null

    noButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(questionPanel?.style).toMatchObject({ opacity: 0, x: -80 })
    expect(successPanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(failurePanel?.style).toMatchObject({ opacity: 1, x: 0 })
    expect(player.getState().horizon.progressEndMs).toBeGreaterThanOrEqual(2620)

    expect(await player.seek({ timelineMs: 6000 })).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('paused')
    expect(player.getState().timelineMs).toBeGreaterThanOrEqual(2620)
    expect((player.getRuntimeRegistry().getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })

  })

  it('routes S4 countdown timeout to the losing branch', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 12600 })).toEqual({ ok: true, data: undefined })

    expect(player.getState().timelineMs).toBe(2550)
    expect((player.getRuntimeRegistry().getNodeById('quiz-question-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, x: 100 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-count-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, scale: 0.92 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-count-value') as RuntimeNodeFixture | null)?.textContent).toBe('10')
  })

  it('clamps S4 seek to the played head when policy forbids seeking ahead', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter, 'played-only')

    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const playedHeadMs = player.getState().horizon.playedEndMs
    expect(playedHeadMs).toBe(player.getState().horizon.seekEndMs)

    expect(await player.seek({ timelineMs: playedHeadMs + 1000 })).toEqual({ ok: true, data: undefined })
    expect(player.getState().timelineMs).toBe(playedHeadMs)
  })

	it('includes already materialized non-master events in played-only seek head', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = new PlayerFacade({
      animationAdapter,
      runtimePolicy: { seekPolicy: 'played-only' },
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS4QuizReferenceScene())
    expect(initResult.ok).toBe(true)

		expect(await player.play()).toEqual({ ok: true, data: undefined })

		const playedHeadMs = player.getState().horizon.playedEndMs

		expect(await player.emit({
			name: 'quiz:decor:probe',
			ms: 1000,
			source: 'system',
			trackId: 's4-quiz-decor-story'
		})).toEqual({ ok: true, data: undefined })

		expect(player.getState().horizon.playedEndMs).toBeGreaterThan(playedHeadMs)
		expect(player.getState().horizon.seekEndMs).toBe(player.getState().horizon.playedEndMs)
	})

  it('traces that public seek replay bypasses the author pipeline before countdown helper tracks exist', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)
    const traces: RuntimeTraceRow[] = []

    player.onTrace((row) => {
      traces.push(row)
    })

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.pause()).toEqual({ ok: true, data: undefined })

    const seekReplayRows = traces.filter((row) => row.eventName === 'player:seek:replay:event')
    expect(seekReplayRows.length).toBeGreaterThan(0)
    expect(seekReplayRows.some((row) => row.payload?.authorInterceptorConfigured === true)).toBe(true)
    expect(seekReplayRows.every((row) => row.payload?.dispatchedThroughAuthor === false)).toBe(true)

    const helperTrackRows = traces.filter((row) => row.eventName === 'player:track:ensure')
    const generatedTrackRows = helperTrackRows.filter((row) => {
      const trackId = row.payload?.trackId
      return typeof trackId === 'string' && trackId.startsWith('strap-')
    })

    expect(generatedTrackRows.length).toBe(0)
  })

  it('prevents countdown timeout after one early yes answer', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const yesButton = player.getRuntimeRegistry().getNodeById('quiz-answer-yes') as RuntimeNodeFixture | null
    yesButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(await player.seek({ timelineMs: 12400 })).toEqual({ ok: true, data: undefined })
    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, x: 100 })
  })

  it('sequence end then play resets quiz choice state before replay', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const yesButton = player.getRuntimeRegistry().getNodeById('quiz-answer-yes') as RuntimeNodeFixture | null
    yesButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })

    expect(await player.seek({ timelineMs: 3500 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })

    expect((player.getRuntimeRegistry().getNodeById('quiz-question-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, x: 100 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, x: 100 })
  })

  it('emits delayed sequence:end after one quiz result click', async () => {
    vi.useFakeTimers()

    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = await createS4AuthorPlayer(animationAdapter)

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const yesButton = player.getRuntimeRegistry().getNodeById('quiz-answer-yes') as RuntimeNodeFixture | null
    yesButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()
    await Promise.resolve()

    expect(await player.seek({ timelineMs: 3600 })).toEqual({ ok: true, data: undefined })
    expect(player.getState().status).toBe('paused')
    expect(player.getState().sequenceEnded).toBe(false)

    expect(await player.seek({ timelineMs: 2600 })).toEqual({ ok: true, data: undefined })

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(player.getState().sequenceEnded).toBe(false)
    expect(player.getState().status).toBe('playing')
    expect(await player.pause()).toEqual({ ok: true, data: undefined })
    expect(await player.seek({ timelineMs: 2400 })).toEqual({ ok: true, data: undefined })

    vi.useRealTimers()
  })

})

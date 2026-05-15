import { describe, expect, it, vi } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { PlayerFacade } from '../../src/player/create-player'
import { RUNTIME_OBJECT_EVENT_HANDLERS } from '../../src/runtime/create-element'
import {
  createS1CanariScene,
  createS2ReferenceScene,
  createS3RobustesseScene,
  createS4QuizReferenceScene
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
  return {
    tagName,
    style: {},
    attributes: {}
  }
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
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS4QuizReferenceScene())

    expect(initResult.ok).toBe(true)

    const registry = player.getRuntimeRegistry()
    expect(registry.getListById('quiz-stage')?.getChildrenSnapshot()).toEqual(['quiz-decor-layer'])
    expect(registry.getListById('quiz-decor-layer')?.getChildrenSnapshot()).toEqual([
      'quiz-decor-circle-a',
      'quiz-decor-circle-b',
      'quiz-decor-circle-c'
    ])
    expect(registry.getListById('quiz-intro-panel')?.getChildrenSnapshot()).toEqual(['quiz-intro-title'])
    expect(registry.getListById('quiz-question-panel')?.getChildrenSnapshot()).toEqual([
      'quiz-question-title',
      'quiz-answer-yes',
      'quiz-answer-no'
    ])
    expect(registry.getParentListId('quiz-intro-panel')).toBeNull()
    expect(registry.getParentListId('quiz-question-panel')).toBeNull()
    expect(registry.getParentListId('quiz-success-panel')).toBeNull()
    expect(registry.getParentListId('quiz-failure-panel')).toBeNull()
  })

  it('plays S4 quiz reference scene through intro then question timeline states', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createS4QuizReferenceScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(2400)).toEqual({ ok: true })

    const registry = player.getRuntimeRegistry()
    const introPanel = registry.getNodeById('quiz-intro-panel') as RuntimeNodeFixture | null
    const questionPanel = registry.getNodeById('quiz-question-panel') as RuntimeNodeFixture | null
    const successPanel = registry.getNodeById('quiz-success-panel') as RuntimeNodeFixture | null
    const failurePanel = registry.getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null

    expect(introPanel?.style).toMatchObject({ opacity: 0, x: 180 })
    expect(questionPanel?.style).toMatchObject({ opacity: 1, x: 0 })
    expect(successPanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(failurePanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(player.getState().timelineEndMs).toBe(2550)

    expect(await player.seek(6000)).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 2550 })
  })

  it('routes S4 yes button emit as one cascaded runtime event', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createS4QuizReferenceScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(2400)).toEqual({ ok: true })

    const registry = player.getRuntimeRegistry()
    const yesButton = registry.getNodeById('quiz-answer-yes') as RuntimeNodeFixture | null
    const questionPanel = registry.getNodeById('quiz-question-panel') as RuntimeNodeFixture | null
    const successPanel = registry.getNodeById('quiz-success-panel') as RuntimeNodeFixture | null
    const failurePanel = registry.getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null

    yesButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()

    expect(questionPanel?.style).toMatchObject({ opacity: 0, x: -80 })
    expect(successPanel?.style).toMatchObject({ opacity: 1, x: 0 })
    expect(failurePanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(player.getState().timelineEndMs).toBe(2620)

    expect(await player.seek(6000)).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 2620 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })

  })

  it('routes S4 no button emit as one cascaded runtime event', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createS4QuizReferenceScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(2400)).toEqual({ ok: true })

    const registry = player.getRuntimeRegistry()
    const noButton = registry.getNodeById('quiz-answer-no') as RuntimeNodeFixture | null
    const questionPanel = registry.getNodeById('quiz-question-panel') as RuntimeNodeFixture | null
    const successPanel = registry.getNodeById('quiz-success-panel') as RuntimeNodeFixture | null
    const failurePanel = registry.getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null

    noButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()

    expect(questionPanel?.style).toMatchObject({ opacity: 0, x: -80 })
    expect(successPanel?.style).toMatchObject({ opacity: 0, x: 100 })
    expect(failurePanel?.style).toMatchObject({ opacity: 1, x: 0 })
    expect(player.getState().timelineEndMs).toBe(2620)

    expect(await player.seek(6000)).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({ status: 'paused', timelineMs: 2620 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })

  })

  it('rewind then play resets quiz choice state before replay', async () => {
    const animationAdapter = createAnimationAdapter(createApplyingAnimeImplementation())
    const player = new PlayerFacade({
      animationAdapter,
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    expect(await player.init(createS4QuizReferenceScene())).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(2400)).toEqual({ ok: true })

    const yesButton = player.getRuntimeRegistry().getNodeById('quiz-answer-yes') as RuntimeNodeFixture | null
    yesButton?.[RUNTIME_OBJECT_EVENT_HANDLERS]?.click?.()

    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })

    expect(await player.rewind()).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true })
    expect(await player.seek(2400)).toEqual({ ok: true })

    expect((player.getRuntimeRegistry().getNodeById('quiz-question-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 1, x: 0 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-success-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, x: 100 })
    expect((player.getRuntimeRegistry().getNodeById('quiz-failure-panel') as RuntimeNodeFixture | null)?.style).toMatchObject({ opacity: 0, x: 100 })
  })
})

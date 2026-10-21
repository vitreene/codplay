import { describe, expect, it } from 'vitest'
import { DEFAULT_EVALUATION_SETTINGS } from '../config/document-config'
import { INITIAL_PROJECT_TEST_STATE } from '../domain/summary-profile/test-state-types'
import type { PipwerksScormApi } from '@codplay/sighty-scorm'
import { ElceScormAdapter } from './elce-scorm-adapter'

/** Provides deterministic CMI reads and records every wrapper operation. */
class FakePipwerksApi implements PipwerksScormApi {
  public version = ''
  public handleExitMode = true
  public readonly values = new Map<string, string>()
  public readonly writes: Readonly<{ parameter: string; value: string }>[] = []
  public readonly operations: string[] = []
  public saveCount = 0
  public quitCount = 0
  public initialized = false
  public connectionAllowed = true
  public writeAllowed = true

  /** Connects the fake API when a test creates a live LMS session. */
  public init(): boolean {
    this.initialized = true
    this.operations.push('initialize')
    return this.connectionAllowed
  }

  /** Reads a fake CMI value, including the computed interaction count. */
  public get(parameter: string): string {
    if (parameter === 'cmi.interactions._count') {
      const indices = [...this.values.keys()].flatMap((key) => {
        const match = key.match(/^cmi\.interactions\.(\d+)\.id$/)
        return match === null ? [] : [Number(match[1])]
      })
      return String(indices.length === 0 ? 0 : Math.max(...indices) + 1)
    }
    return this.values.get(parameter) ?? ''
  }

  /** Stores a fake CMI value and keeps a write trace for assertions. */
  public set(parameter: string, value: string): boolean {
    if (!this.writeAllowed) return false
    this.values.set(parameter, value)
    this.writes.push({ parameter, value })
    this.operations.push(`set:${parameter}`)
    return true
  }

  /** Records one LMS commit. */
  public save(): boolean {
    this.saveCount += 1
    this.operations.push('commit')
    return true
  }

  /** Records one LMS session termination. */
  public quit(): boolean {
    this.quitCount += 1
    this.operations.push('terminate')
    return true
  }
}

/** Creates a complete failed evaluation state used by interaction tests. */
function createFailedEvaluationState() {
  return {
    value: 'failure' as const,
    context: {
      questionIds: ['page-question'],
      activeQuestionIds: [],
      settings: { ...DEFAULT_EVALUATION_SETTINGS },
      attempt: 2,
      answers: {
        'page-question': {
          questionId: 'page-question',
          answerIds: ['answer-a', 'answer-b'],
          selectedAnswerIds: ['answer-b'],
          expectedAnswerIds: ['answer-a'],
        },
      },
      result: { questionCount: 1, correctCount: 0, score: 0, passed: false },
    },
  }
}

/** Creates a prior successful chapter result for mono-SCO score rollup tests. */
function createPassedEvaluationState() {
  const failed = createFailedEvaluationState()
  return {
    ...failed,
    value: 'success' as const,
    context: {
      ...failed.context,
      result: { questionCount: 1, correctCount: 1, score: 0.8, passed: true },
    },
  }
}

describe('ElceScormAdapter', () => {
  it.each([
    ['1.2', 'cmi.core.lesson_location'],
    ['2004v3', 'cmi.location'],
    ['2004v4', 'cmi.location'],
  ] as const)('restores state and writes the %s page bookmark', async (version, locationElement) => {
    const api = new FakePipwerksApi()
    api.values.set(locationElement, 'page-restored')
    api.values.set('cmi.suspend_data', JSON.stringify({
      schemaVersion: 1,
      currentPageId: 'older-page',
      projectTestState: { ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-finished'] },
    }))
    const session = new ElceScormAdapter({ version, api })

    const restored = await session.initialize()
    await session.saveReaderState({ ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-finished', 'page-next'] }, 'page-next')

    expect(api.version).toBe(version === '1.2' ? '1.2' : '2004')
    expect(restored.currentPageId).toBe('page-restored')
    expect(restored.projectTestState.finishedPageIds).toEqual(['page-finished'])
    expect(api.values.get(locationElement)).toBe('page-next')
    expect(JSON.parse(api.values.get('cmi.suspend_data') ?? '{}').projectTestState.finishedPageIds)
      .toEqual(['page-finished', 'page-next'])
    expect(api.saveCount).toBe(1)
  })

  it('persists reader state when an evaluation outcome has no score yet', async () => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({ version: '2004v4', api })
    await session.initialize()
    const evaluation = createFailedEvaluationState()
    const incompleteScore = {
      ...evaluation,
      context: {
        ...evaluation.context,
        result: { ...evaluation.context.result, score: null },
      },
    }

    await session.recordEvaluationResult({
      ...INITIAL_PROJECT_TEST_STATE,
      evaluationStates: { 'chapter-evaluation': incompleteScore },
    }, 'page-result', { chapterId: 'chapter-evaluation', evaluationState: incompleteScore })

    expect(JSON.parse(api.values.get('cmi.suspend_data') ?? '{}').currentPageId).toBe('page-result')
    expect(api.values.has('cmi.success_status')).toBe(false)
    expect(api.saveCount).toBe(1)
  })

  it('writes chapter objectives and rolls up scores for a 2004 mono-SCO package', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.objectives._count', '2')
    api.values.set('cmi.objectives.0.id', 'obj_chapter-passed')
    api.values.set('cmi.objectives.1.id', 'obj_chapter-evaluation')
    const session = new ElceScormAdapter({
      version: '2004v4',
      monoSco: true,
      evaluationChapterIds: ['chapter-passed', 'chapter-evaluation'],
      api,
    })
    await session.initialize()
    const previous = createPassedEvaluationState()
    const current = createFailedEvaluationState()
    const projectTestState = {
      ...INITIAL_PROJECT_TEST_STATE,
      evaluationStates: {
        'chapter-passed': previous,
        'chapter-evaluation': current,
      },
    }

    await session.recordEvaluationResult(
      projectTestState,
      'page-result',
      { chapterId: 'chapter-evaluation', evaluationState: current },
    )

    expect(api.values.get('cmi.objectives.1.completion_status')).toBe('completed')
    expect(api.values.get('cmi.objectives.1.success_status')).toBe('failed')
    expect(api.values.get('cmi.objectives.1.score.raw')).toBe('0')
    expect(api.values.get('cmi.objectives.1.score.scaled')).toBe('0')
    expect(api.values.get('cmi.success_status')).toBe('failed')
    expect(api.values.get('cmi.score.raw')).toBe('40')
    expect(api.values.get('cmi.score.scaled')).toBe('0.4')
  })

  it('averages chapter scores for a 1.2 mono-SCO package', async () => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({
      version: '1.2',
      monoSco: true,
      evaluationChapterIds: ['chapter-passed', 'chapter-evaluation'],
      api,
    })
    await session.initialize()
    const current = createFailedEvaluationState()
    await session.recordEvaluationResult({
      ...INITIAL_PROJECT_TEST_STATE,
      evaluationStates: {
        'chapter-passed': createPassedEvaluationState(),
        'chapter-evaluation': current,
      },
    }, 'page-result', { chapterId: 'chapter-evaluation', evaluationState: current })

    expect(api.values.get('cmi.core.lesson_status')).toBe('failed')
    expect(api.values.get('cmi.core.score.raw')).toBe('40')
  })

  it('reports chapter-based completion and progress for a 2004 mono-SCO package', async () => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({
      version: '2004v4',
      monoSco: true,
      chapterPageIds: [['page-a'], ['page-b']],
      api,
    })
    await session.initialize()

    await session.saveReaderState({ ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-a'] }, 'page-a')
    expect(api.values.get('cmi.progress_measure')).toBe('0.5')
    expect(api.values.get('cmi.completion_status')).toBe('incomplete')

    await session.saveReaderState({ ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-a', 'page-b'] }, 'page-b')
    expect(api.values.get('cmi.progress_measure')).toBe('1')
    expect(api.values.get('cmi.completion_status')).toBe('completed')
  })

  it.each([
    ['1.2', 'cmi.core.lesson_status', 'cmi.core.score.raw'],
    ['2004v3', 'cmi.success_status', 'cmi.score.scaled'],
    ['2004v4', 'cmi.success_status', 'cmi.score.scaled'],
  ] as const)('writes a failed evaluation and its interaction for SCORM %s', async (version, statusElement, scoreElement) => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({ version, api: api as FakePipwerksApi })
    await session.initialize()
    await session.recordEvaluationResult(
      { ...INITIAL_PROJECT_TEST_STATE, evaluationStates: { 'chapter-evaluation': createFailedEvaluationState() } },
      'page-result',
      { chapterId: 'chapter-evaluation', evaluationState: createFailedEvaluationState() },
    )

    expect(api.values.get(statusElement)).toBe('failed')
    expect(api.values.get(scoreElement)).toBe('0')
    expect(api.values.get('cmi.interactions.0.id')).toBe('chapter-evaluation:page-question')
    expect(api.values.get('cmi.interactions.0.type')).toBe('choice')
    expect(api.values.get('cmi.interactions.0.correct_responses.0.pattern')).toBe('answer-a')
    expect(api.values.get('cmi.interactions.0.learner_response')).toBe('answer-b')
    expect(api.values.get('cmi.interactions.0.result')).toBe('incorrect')
    expect(api.saveCount).toBe(1)
  })

  it('does not write while the LMS session is in browse or review mode', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.core.lesson_mode', 'browse')
    const session = new ElceScormAdapter({ version: '1.2', api })
    await session.initialize()
    await session.saveReaderState(INITIAL_PROJECT_TEST_STATE, 'page-a')
    await session.close()

    expect(api.writes).toHaveLength(0)
    expect(api.quitCount).toBe(1)
  })

  it('commits and terminates a connected session once', async () => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({ version: '2004v4', api })
    await session.initialize()
    await session.saveReaderState(INITIAL_PROJECT_TEST_STATE, 'page-a')
    await Promise.all([session.close(), session.close()])

    expect(api.saveCount).toBe(2)
    expect(api.handleExitMode).toBe(false)
    expect(api.values.get('cmi.exit')).toBe('suspend')
    expect(api.quitCount).toBe(1)
    expect(api.operations.slice(-5)).toEqual([
      'set:cmi.location',
      'set:cmi.suspend_data',
      'set:cmi.exit',
      'commit',
      'terminate',
    ])
  })

  it('uses the 1.2 exit element when suspending the session', async () => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({ version: '1.2', api })
    await session.initialize()
    await session.close()

    expect(api.values.get('cmi.core.exit')).toBe('suspend')
  })

  it('surfaces a failed LMS write to the Sighty action that awaited it', async () => {
    const api = new FakePipwerksApi()
    const session = new ElceScormAdapter({ version: '1.2', api })
    await session.initialize()
    api.writeAllowed = false

    await expect(session.saveReaderState(INITIAL_PROJECT_TEST_STATE, 'page-a')).rejects.toThrow('Échec SCORM')
  })

  it('falls back to a safe first launch when the wrapper or LMS API is unavailable', async () => {
    const absentSession = new ElceScormAdapter({ version: '2004v3' })
    const absentState = await absentSession.initialize()
    await absentSession.saveReaderState(INITIAL_PROJECT_TEST_STATE, 'page-a')
    await absentSession.close()

    const disconnectedApi = new FakePipwerksApi()
    disconnectedApi.connectionAllowed = false
    const disconnectedSession = new ElceScormAdapter({ version: '1.2', api: disconnectedApi })
    const disconnectedState = await disconnectedSession.initialize()
    await disconnectedSession.saveReaderState(INITIAL_PROJECT_TEST_STATE, 'page-a')
    await disconnectedSession.close()

    expect(absentState.currentPageId).toBeNull()
    expect(disconnectedState.currentPageId).toBeNull()
    expect(disconnectedApi.writes).toHaveLength(0)
    expect(disconnectedApi.quitCount).toBe(0)
  })

  it('keeps a valid location when suspend data is malformed', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.core.lesson_location', 'page-bookmark')
    api.values.set('cmi.suspend_data', '{broken')
    const session = new ElceScormAdapter({ version: '1.2', api })

    const restored = await session.initialize()

    expect(restored.currentPageId).toBe('page-bookmark')
    expect(restored.projectTestState.finishedPageIds).toEqual([])
  })
})

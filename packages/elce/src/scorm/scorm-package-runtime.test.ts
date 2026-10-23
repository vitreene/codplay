/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'
import type { SightyScenarioMutation } from '@codplay/sighty'
import type { ElceSceneKey, ElceSlotName } from '../builders/scenario/scenario-builder-types'
import { INITIAL_PROJECT_TEST_STATE } from '../domain/summary-profile/test-state-types'
import { ELCE_EVENTS, ELCE_SCENARIO } from '../config/document-config'
import { createScrollContainerSourceAdapter } from '@codplay/component-v2/scroll-container'
import type { PipwerksScormApi } from '@codplay/sighty-scorm'
import type { ScormReaderState } from './scorm-types'
import {
  ELCE_SCORM_CHAPTER_CONTEXT_KEY,
  ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY,
  ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY,
} from './scorm-types'
import { reconcilePackagedReaderState, startElceScormPackageRuntime } from './scorm-package-runtime'

/** Supplies a deterministic LMS store to the exported Sighty package runtime. */
class FakePipwerksApi implements PipwerksScormApi {
  public version = ''
  public readonly values = new Map<string, string>()
  public quitCount = 0

  /** Opens the fake LMS session. */
  public init(): boolean { return true }

  /** Reads one fake CMI value. */
  public get(parameter: string): string {
    return parameter === 'cmi.interactions._count' ? '0' : this.values.get(parameter) ?? ''
  }

  /** Stores one fake CMI value. */
  public set(parameter: string, value: string): boolean {
    this.values.set(parameter, value)
    return true
  }

  /** Accepts a fake LMS commit. */
  public save(): boolean { return true }

  /** Counts fake LMS session termination calls. */
  public quit(): boolean {
    this.quitCount += 1
    return true
  }
}

describe('SCORM package state restoration', () => {
  it('keeps only page, evaluation, question, and profile identities present in the package', () => {
    const readerState: ScormReaderState = {
      schemaVersion: 1,
      currentPageId: 'removed-page',
      projectTestState: {
        ...INITIAL_PROJECT_TEST_STATE,
        finishedPageIds: ['page-a', 'removed-page'],
        questionAnswers: {
          'question-page': { answerIds: ['yes', 'no'], selectedAnswerIds: ['yes'], expectedAnswerIds: ['yes'], isCorrect: true },
          'removed-question': { answerIds: ['a'], selectedAnswerIds: ['a'], expectedAnswerIds: ['a'], isCorrect: true },
        },
        evaluationStates: {
          'evaluation-a': {
            value: 'ready',
            context: {
              questionIds: [],
              activeQuestionIds: [],
              settings: { threshold: 0.8, attemptLimit: null, retryScope: 'all-questions' },
              answers: {},
              attempt: 0,
              result: null,
            },
          },
          'removed-evaluation': {
            value: 'ready',
            context: {
              questionIds: [],
              activeQuestionIds: [],
              settings: { threshold: 0.8, attemptLimit: null, retryScope: 'all-questions' },
              answers: {},
              attempt: 0,
              result: null,
            },
          },
        },
        profileValues: { participant: 'Ada', removedProperty: 'stale' },
      },
    }
    const data = {
      pageIds: ['page-a', 'question-page'],
      pagePaths: { 'page-a': '/chapter-a/page-a', 'question-page': '/evaluation-a/question-page' },
      chapterIds: ['chapter-a', 'evaluation-a'],
      previewStartPageId: 'page-a',
      questionBdcByPage: { 'question-page': 'question-bdc' },
      chapters: {
        'chapter-a': { id: 'chapter-a', name: 'Chapitre A', type: 'standard', pageIds: ['page-a'] },
        'evaluation-a': { id: 'evaluation-a', name: 'Évaluation A', type: 'evaluation', pageIds: ['question-page'] },
      },
      profile: { fieldPropertyIds: ['participant'] },
    } as const

    const restored = reconcilePackagedReaderState(readerState, data, 'question-page')

    expect(restored.currentPageId).toBe('question-page')
    expect(restored.projectTestState.finishedPageIds).toEqual(['page-a'])
    expect(Object.keys(restored.projectTestState.questionAnswers)).toEqual(['question-page'])
    expect(Object.keys(restored.projectTestState.evaluationStates)).toEqual(['evaluation-a'])
    expect(restored.projectTestState.profileValues).toEqual({ participant: 'Ada' })
  })

  it('reconciles a chapter SCO resume to that chapter and its own questions', () => {
    const readerState: ScormReaderState = {
      schemaVersion: 1,
      currentPageId: 'page-a',
      projectTestState: {
        ...INITIAL_PROJECT_TEST_STATE,
        finishedPageIds: ['page-a', 'question-page'],
        questionAnswers: {
          'question-page': { answerIds: ['yes', 'no'], selectedAnswerIds: ['yes'], expectedAnswerIds: ['yes'], isCorrect: true },
        },
        evaluationStates: {
          'evaluation-a': {
            value: 'ready',
            context: {
              questionIds: ['question-page'],
              activeQuestionIds: ['question-page'],
              settings: { threshold: 0.8, attemptLimit: null, retryScope: 'all-questions' },
              answers: {},
              attempt: 1,
              result: null,
            },
          },
        },
        profileValues: { participant: 'Ada' },
      },
    }
    const data = {
      pageIds: ['page-a', 'question-page'],
      pagePaths: { 'page-a': '/chapter-a/page-a', 'question-page': '/evaluation-a/question-page' },
      chapterIds: ['chapter-a', 'evaluation-a'],
      previewStartPageId: 'page-a',
      questionBdcByPage: { 'question-page': 'question-bdc' },
      chapters: {
        'chapter-a': { id: 'chapter-a', name: 'Chapitre A', type: 'standard', pageIds: ['page-a'] },
        'evaluation-a': { id: 'evaluation-a', name: 'Évaluation A', type: 'evaluation', pageIds: ['question-page'] },
      },
      profile: { fieldPropertyIds: ['participant'] },
    } as const

    const restored = reconcilePackagedReaderState(readerState, data, 'question-page', 'evaluation-a')

    expect(restored.currentPageId).toBe('question-page')
    expect(restored.projectTestState.finishedPageIds).toEqual(['question-page'])
    expect(Object.keys(restored.projectTestState.questionAnswers)).toEqual(['question-page'])
    expect(Object.keys(restored.projectTestState.evaluationStates)).toEqual(['evaluation-a'])
    expect(restored.projectTestState.profileValues).toEqual({ participant: 'Ada' })
  })

  it('injects the adapter before Sighty initialization, restores the page, and closes once', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.scaled_passing_score', '0.65')
    window.pipwerks = { SCORM: api }
    const root = document.createElement('main')
    root.style.visibility = 'hidden'
    document.body.append(root)
    const events: string[] = []
    let runtimeContext: Readonly<Record<string, unknown>> | undefined
    let sourceAdapterFactories: readonly unknown[] | undefined
    const mutations: SightyScenarioMutation<ElceSceneKey, ElceSlotName>[] = []
    let layoutTimelineMs = 12_345
    let destroyed = 0
    const loadSightyPackage = vi.fn(async (options: Readonly<{
      root: HTMLElement
      codplay: Readonly<{
        htmlHost: Readonly<{ sourceAdapterFactories: readonly unknown[] }>
      }>
      runtime: Readonly<{ context: Readonly<Record<string, unknown>> }>
    }>) => {
      runtimeContext = options.runtime.context
      sourceAdapterFactories = options.codplay.htmlHost.sourceAdapterFactories
      return {
        runtime: {
          initialize: async () => {
            expect(root.style.visibility).toBe('hidden')
            events.push('initialize')
          },
          play: async (sceneKey: string) => { events.push(`play:${sceneKey}`) },
          dispatch: async (event: Readonly<{ name: string }>) => {
            events.push(event.name)
            return true
          },
          mutate: async (mutation: SightyScenarioMutation<ElceSceneKey, ElceSlotName>) => {
            mutations.push(mutation)
            return true
          },
          getInstance: () => ({
            telco: { getProgress: () => ({ timelineMs: layoutTimelineMs, durationMs: 60_000 }) },
          }),
        },
        destroy: () => { destroyed += 1 },
      }
    })

    const runtime = await startElceScormPackageRuntime({
      root,
      scenario: {
        data: {
          pageIds: ['page-a', 'page-b'],
          pagePaths: { 'page-a': '/chapter-a/page-a', 'page-b': '/evaluation-a/page-b' },
          chapterIds: ['chapter-a', 'evaluation-a'],
          previewStartPageId: 'page-a',
          questionBdcByPage: { 'page-b': 'question-bdc' },
          chapters: {
            'chapter-a': { id: 'chapter-a', name: 'Chapitre A', type: 'standard', pageIds: ['page-a'] },
            'evaluation-a': { id: 'evaluation-a', name: 'Évaluation A', type: 'evaluation', pageIds: ['page-b'] },
          },
          profile: { fieldPropertyIds: [] },
        },
      },
      loadSightyPackage,
      version: '2004v4',
      monoSco: false,
      chapterId: 'evaluation-a',
      initialPageId: 'page-b',
      chapterScoIdentifiers: { 'chapter-a': 'ITEM-a', 'evaluation-a': 'ITEM-evaluation' },
    })

    const progressSink = runtimeContext?.[ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]
    expect(typeof (progressSink as { saveReaderState?: unknown } | undefined)?.saveReaderState).toBe('function')
    expect((progressSink as { getEvaluationThresholdOverride?: () => number | undefined } | undefined)
      ?.getEvaluationThresholdOverride?.()).toBe(0.65)
    expect(runtimeContext?.[ELCE_SCORM_CHAPTER_CONTEXT_KEY]).toBe('evaluation-a')
    expect(runtimeContext?.[ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]).toEqual({
      'chapter-a': 'ITEM-a',
      'evaluation-a': 'ITEM-evaluation',
    })
    expect(sourceAdapterFactories).toEqual([createScrollContainerSourceAdapter])
    expect(events).toEqual([
      'initialize',
      `play:${ELCE_SCENARIO.LAYOUT_SCENE}`,
      ELCE_EVENTS.PRESENTATION_REFRESH,
      `${ELCE_EVENTS.MENU_PREFIX}page-b`,
    ])
    expect(api.values.get('cmi.location')).toBe('page-b')
    expect(JSON.parse(api.values.get('cmi.suspend_data') ?? '{}').currentPageId).toBe('page-b')
    expect(api.values.get('cmi.session_time')).toBe('PT0000H00M12S')
    expect(root.style.visibility).toBe('visible')
    expect(mutations).toEqual([
      expect.objectContaining({ kind: 'update-view', target: { path: '/evaluation-a/page-b' } }),
    ])

    await (progressSink as { saveReaderState(state: typeof INITIAL_PROJECT_TEST_STATE, pageId: string): Promise<void> })
      .saveReaderState({ ...INITIAL_PROJECT_TEST_STATE, finishedPageIds: ['page-b'] }, 'page-b')
    expect(api.values.get('cmi.progress_measure')).toBe('1')
    expect(api.values.has('cmi.completion_status')).toBe(false)

    await (progressSink as { saveReaderState(state: typeof INITIAL_PROJECT_TEST_STATE, pageId: string): Promise<void> })
      .saveReaderState({
        ...INITIAL_PROJECT_TEST_STATE,
        finishedPageIds: ['page-b'],
        questionAnswers: {
          'page-b': {
            answerIds: ['yes', 'no'],
            selectedAnswerIds: ['yes'],
            expectedAnswerIds: ['yes'],
            isCorrect: true,
          },
        },
      }, 'page-b')
    expect(api.values.get('cmi.progress_measure')).toBe('1')
    expect(api.values.get('cmi.completion_status')).toBe('completed')

    layoutTimelineMs = 23_456
    await runtime.close()
    await runtime.close()

    expect(api.values.get('cmi.session_time')).toBe('PT0000H00M23S')
    expect(destroyed).toBe(1)
    expect(api.quitCount).toBe(1)
  })

  it('unlocks a following chapter only when a completed Quiz page records its answer', async () => {
    const api = new FakePipwerksApi()
    window.pipwerks = { SCORM: api }
    const root = document.createElement('main')
    root.style.visibility = 'hidden'
    document.body.append(root)
    const mutations: SightyScenarioMutation<ElceSceneKey, ElceSlotName>[] = []
    const loadSightyPackage = vi.fn(async () => ({
      runtime: {
        initialize: async () => {},
        play: async () => {},
        dispatch: async () => true,
        mutate: async (mutation: SightyScenarioMutation<ElceSceneKey, ElceSlotName>) => {
          mutations.push(mutation)
          return true
        },
        getInstance: () => ({ telco: { getProgress: () => ({ timelineMs: 0, durationMs: 0 }) } }),
      },
      destroy: () => {},
    }))
    const runtime = await startElceScormPackageRuntime({
      root,
      scenario: {
        data: {
          pageIds: ['chapter-1-intro', 'chapter-1-quiz', 'chapter-2-page'],
          pagePaths: {
            'chapter-1-intro': '/chapter-1/intro',
            'chapter-1-quiz': '/chapter-1/quiz',
            'chapter-2-page': '/chapter-2/page',
          },
          chapterIds: ['chapter-1', 'chapter-2'],
          previewStartPageId: 'chapter-1-intro',
          questionBdcByPage: { 'chapter-1-quiz': 'question-1' },
          chapters: {
            'chapter-1': { id: 'chapter-1', name: 'Lire une scène', type: 'standard', pageIds: ['chapter-1-intro', 'chapter-1-quiz'] },
            'chapter-2': { id: 'chapter-2', name: 'Observer les détails', type: 'standard', pageIds: ['chapter-2-page'] },
          },
          profile: { fieldPropertyIds: [] },
        },
      },
      loadSightyPackage,
      version: '2004v4',
      monoSco: false,
      chapterId: 'chapter-1',
      initialPageId: 'chapter-1-intro',
      chapterScoIdentifiers: { 'chapter-1': 'ITEM-one', 'chapter-2': 'ITEM-two' },
    })

    const finalPageMutation = mutations.find((mutation) => (
      mutation.kind === 'update-view' && 'path' in mutation.target && mutation.target.path === '/chapter-1/quiz'
    ))
    expect(finalPageMutation?.kind).toBe('update-view')
    if (finalPageMutation?.kind === 'update-view') {
      expect(finalPageMutation.patch.actions?.[ELCE_EVENTS.NAVIGATION_NEXT]).toEqual({
        action: 'action:elce:navigate-scorm-chapter',
      })
    }
    const progressSink = runtime.session as unknown as {
      saveReaderState(state: typeof INITIAL_PROJECT_TEST_STATE, pageId: string): Promise<void>
      recordQuestionInteraction(
        state: typeof INITIAL_PROJECT_TEST_STATE,
        pageId: string,
        answer: Readonly<{
          questionType: 'choice'
          answerIds: readonly string[]
          answerLabels: readonly string[]
          selectedAnswerIds: readonly string[]
          expectedAnswerIds: readonly string[]
          description: string
          isCorrect: boolean
        }>,
      ): Promise<void>
    }

    await progressSink.saveReaderState({
      ...INITIAL_PROJECT_TEST_STATE,
      finishedPageIds: ['chapter-1-intro', 'chapter-1-quiz'],
    }, 'chapter-1-quiz')
    expect(api.values.get('cmi.progress_measure')).toBe('1')
    expect(api.values.has('cmi.completion_status')).toBe(false)

    await progressSink.recordQuestionInteraction({
      ...INITIAL_PROJECT_TEST_STATE,
      finishedPageIds: ['chapter-1-intro', 'chapter-1-quiz'],
      questionAnswers: {
        'chapter-1-quiz': {
          answerIds: ['horizon', 'detail'],
          selectedAnswerIds: ['horizon'],
          expectedAnswerIds: ['horizon'],
          isCorrect: true,
        },
      },
    }, 'chapter-1-quiz', {
      questionType: 'choice',
      answerIds: ['horizon', 'detail'],
      answerLabels: ['L’horizon', 'Un détail'],
      selectedAnswerIds: ['horizon'],
      expectedAnswerIds: ['horizon'],
      description: 'Quel repère est présent ?',
      isCorrect: true,
    })

    expect(api.values.get('cmi.progress_measure')).toBe('1')
    expect(api.values.get('cmi.completion_status')).toBe('completed')
    expect(api.values.get('cmi.interactions.0.result')).toBe('correct')
    await expect(runtime.session.navigateToChapter('chapter-2')).resolves.toBe(true)
    expect(api.values.get('adl.nav.request')).toBe('{target=ITEM-two}choice')
    await runtime.close()
  })

  it('keeps the launch container hidden when Sighty initialization fails', async () => {
    const api = new FakePipwerksApi()
    window.pipwerks = { SCORM: api }
    const root = document.createElement('main')
    root.style.visibility = 'hidden'
    document.body.append(root)
    let destroyed = 0
    const loadSightyPackage = vi.fn(async () => ({
      runtime: {
        initialize: async () => { throw new Error('Sighty failed') },
        play: async () => {},
        dispatch: async () => true,
        mutate: async () => true,
        getInstance: () => undefined,
      },
      destroy: () => { destroyed += 1 },
    }))

    await expect(startElceScormPackageRuntime({
      root,
      scenario: {
        data: {
          pageIds: ['page-a'],
          pagePaths: { 'page-a': '/chapter-a/page-a' },
          chapterIds: ['chapter-a'],
          previewStartPageId: 'page-a',
          questionBdcByPage: {},
          chapters: { 'chapter-a': { id: 'chapter-a', name: 'Chapitre A', type: 'standard', pageIds: ['page-a'] } },
          profile: { fieldPropertyIds: [] },
        },
      },
      loadSightyPackage,
      version: '2004v4',
      monoSco: true,
    })).rejects.toThrow('Sighty failed')

    expect(root.style.visibility).toBe('hidden')
    expect(destroyed).toBe(1)
    expect(api.quitCount).toBe(1)
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { SceneDoc } from 'codplay/scene/types'
import { BDC_TYPE, DEFAULT_PRESET_ID } from '../learning-definition'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { ELCE_EVENTS, ELCE_SCENARIO, ELCE_SCENARIO_HANDLERS } from './learning-reading-events'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { QUESTION_TYPE } from '../../../resources/bdcs/question/question-config'
import { BDC_LOCATION } from '../../../core/document/content-location'
import { ELCE_EDITOR_SETTINGS } from '../../../config/editor-settings'
import { applyDocumentCommand, createPageCommand } from '../../../domain/commands/document-commands'
import { learningDocumentService } from '../document/learning-document-service'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import type { ProjectTestState } from './learning-test-state-types'
import {
  ELCE_SCORM_CHAPTER_CONTEXT_KEY,
  ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY,
  ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY,
} from '../../../scorm/scorm-types'
import { learningScenarioBuilder } from './learning-scenario-builder'
import {
  markPageFinishedAction,
  navigateScormChapterAction,
  pageAccessGuard,
  pageExitGuard,
  recordQuestionResultAction,
  refreshPresentationAction,
} from './learning-scenario-actions'

const emptyScene: SceneDoc<string> = { id: 'empty-scene', stories: {} }

describe('Elcé scenario builder', () => {
  it('records page completion from the marker payload without requiring a scene source', async () => {
    const document = learningDocumentService.createInitialDocument()
    const scenario = learningScenarioBuilder.build(document, {})
    const selection = {
      slotName: ELCE_SCENARIO.CONTENT_SLOT,
      view: { path: `${ELCE_SCENARIO.ROOT_VIEW}/main/page-a` },
      sceneKey: 'scene-page-a',
    }
    const context = { finishedPages: [] as string[] }
    const actionContext = {
      event: { name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId: 'page-a' } },
      data: scenario.data ?? {},
      context,
      state: {},
      scenarioState: {
        active: selection,
        current: [selection],
        context: {},
        canAccess: async () => true,
        canExit: async () => true,
      },
      updateContext: async (patch: Readonly<Record<string, unknown>>) => Object.assign(context, patch),
      send: async () => undefined,
    } as unknown as Parameters<typeof markPageFinishedAction>[0]

    await markPageFinishedAction(actionContext)

    expect(context.finishedPages).toEqual(['page-a'])
  })

  it('stores the scene time and response metadata in the Evaluation answer', async () => {
    const questionService = new ElceQuestionService()
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create',
      chapterId: 'chapter-evaluation',
      name: 'Évaluation',
      chapterType: CHAPTER_TYPE.EVALUATION,
    })
    document = applyDocumentCommand(document, {
      type: 'page.move',
      pageId: 'page-a',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-evaluation' },
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'bdc-question',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 0 },
    })
    const question = document.bdcs.find((bdc) => bdc.id === 'bdc-question')!.question!
    const multipleChoiceQuestion = questionService.changeType(question, QUESTION_TYPE.MULTIPLE_CHOICE)
    document = applyDocumentCommand(document, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question',
      question: {
        ...multipleChoiceQuestion,
        title: 'Titre de question',
        prompt: 'Choisissez la bonne réponse.',
      },
    })
    const authoredQuestion = document.bdcs.find((bdc) => bdc.id === 'bdc-question')!.question!
    const answerIds = authoredQuestion.answers.map((answer) => answer.id)
    const expectedAnswerIds = authoredQuestion.answers.filter((answer) => answer.correct).map((answer) => answer.id)
    const selectedAnswerIds = authoredQuestion.answers.filter((answer) => !answer.correct).slice(0, 1).map((answer) => answer.id)
    const scenario = learningScenarioBuilder.build(document, {})
    const selection = {
      slotName: ELCE_SCENARIO.CONTENT_SLOT,
      view: { path: `${ELCE_SCENARIO.ROOT_VIEW}/main/page-a` },
      sceneKey: 'scene-page-a',
    }
    const savedPatch: Record<string, unknown> = {}
    const persistedStates: ProjectTestState[] = []
    const scormSink = {
      saveReaderState: async (state: ProjectTestState) => { persistedStates.push(state) },
      getEvaluationThresholdOverride: () => 0.6,
      recordEvaluationResult: async () => undefined,
    }
    const actionContext = {
      event: {
        name: ELCE_EVENTS.QUESTION_ANSWERED,
        sourceSceneKey: 'scene-page-a',
        timeMs: 12_345,
        data: {
          pageId: 'page-a',
          bdcId: 'bdc-question',
          questionType: QUESTION_TYPE.MULTIPLE_CHOICE,
          isCorrect: false,
          answerIds,
          answerLabels: authoredQuestion.answers.map((answer) => answer.label),
          selectedAnswerIds,
          expectedAnswerIds,
          description: 'Titre de question Choisissez la bonne réponse.',
        },
      },
      data: scenario.data ?? {},
      context: { [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: scormSink },
      state: {},
      scenarioState: {
        active: selection,
        current: [selection],
        context: {},
        canAccess: async () => true,
        canExit: async () => true,
      },
      updateContext: async (patch: Readonly<Record<string, unknown>>) => Object.assign(savedPatch, patch),
      send: async () => undefined,
    } as unknown as Parameters<typeof recordQuestionResultAction>[0]
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000)
    try {
      await recordQuestionResultAction(actionContext)
    } finally {
      now.mockRestore()
    }

    const evaluationStates = savedPatch.evaluationStates as Record<string, {
      context: {
        settings: { threshold: number }
        answers: Record<string, { description?: string; latencyMs?: number; timestampMs?: number }>
      }
    }>
    expect(evaluationStates['chapter-evaluation']?.context.settings.threshold).toBe(0.6)
    expect(evaluationStates['chapter-evaluation']?.context.answers['page-a']).toMatchObject({
      questionType: QUESTION_TYPE.MULTIPLE_CHOICE,
      answerLabels: authoredQuestion.answers.map((answer) => answer.label),
      description: 'Titre de question Choisissez la bonne réponse.',
      latencyMs: 12_345,
      timestampMs: 1_760_000_000_000,
    })
    expect(persistedStates.at(-1)?.evaluationStates['chapter-evaluation']?.context.answers['page-a'])
      .toMatchObject({
        questionType: QUESTION_TYPE.MULTIPLE_CHOICE,
        answerLabels: authoredQuestion.answers.map((answer) => answer.label),
        latencyMs: 12_345,
        timestampMs: 1_760_000_000_000,
      })
  })

  it('sends a non-evaluation Question interaction immediately through the SCORM adapter', async () => {
    const questionService = new ElceQuestionService()
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'bdc-question',
      bdcType: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a', index: 0 },
    })
    const question = document.bdcs.find((bdc) => bdc.id === 'bdc-question')!.question!
    const authoredQuestion = {
      ...questionService.changeType(question, QUESTION_TYPE.TRUE_FALSE),
      title: 'Question immédiate',
      prompt: 'La réponse est-elle correcte ?',
    }
    document = applyDocumentCommand(document, {
      type: 'bdc.question.update',
      bdcId: 'bdc-question',
      question: authoredQuestion,
    })
    const answerIds = authoredQuestion.answers.map((answer) => answer.id)
    const answerLabels = authoredQuestion.answers.map((answer) => answer.label)
    const selectedAnswerIds = authoredQuestion.answers.filter((answer) => answer.correct).map((answer) => answer.id)
    const expectedAnswerIds = selectedAnswerIds
    const scenario = learningScenarioBuilder.build(document, {})
    const selection = {
      slotName: ELCE_SCENARIO.CONTENT_SLOT,
      view: { path: `${ELCE_SCENARIO.ROOT_VIEW}/main/page-a` },
      sceneKey: 'scene-page-a',
    }
    const recordedInteractions: unknown[][] = []
    const scormSink = {
      saveReaderState: async () => undefined,
      recordQuestionInteraction: async (...args: unknown[]) => { recordedInteractions.push(args) },
      recordEvaluationResult: async () => undefined,
    }
    const actionContext = {
      event: {
        name: ELCE_EVENTS.QUESTION_ANSWERED,
        sourceSceneKey: 'scene-page-a',
        timeMs: 8_700,
        data: {
          pageId: 'page-a',
          bdcId: 'bdc-question',
          questionType: QUESTION_TYPE.TRUE_FALSE,
          isCorrect: true,
          answerIds,
          answerLabels,
          selectedAnswerIds,
          expectedAnswerIds,
          description: 'Question immédiate La réponse est-elle correcte ?',
        },
      },
      data: scenario.data ?? {},
      context: { [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: scormSink },
      state: {},
      scenarioState: {
        active: selection,
        current: [selection],
        context: {},
        canAccess: async () => true,
        canExit: async () => true,
      },
      updateContext: async () => undefined,
      send: async () => undefined,
    } as unknown as Parameters<typeof recordQuestionResultAction>[0]

    await recordQuestionResultAction(actionContext)

    expect(recordedInteractions).toHaveLength(1)
    expect(recordedInteractions[0]?.[1]).toBe('page-a')
    expect(recordedInteractions[0]?.[2]).toMatchObject({
      questionType: QUESTION_TYPE.TRUE_FALSE,
      answerIds,
      answerLabels,
      selectedAnswerIds,
      expectedAnswerIds,
      description: 'Question immédiate La réponse est-elle correcte ?',
      latencyMs: 8_700,
      isCorrect: true,
    })
    expect(recordedInteractions[0]?.[2]).toMatchObject({ timestampMs: expect.any(Number) })
  })

  it('routes the shared page-completion event to the Sighty action', () => {
    const scenario = learningScenarioBuilder.build(learningDocumentService.createInitialDocument(), {})
    const mainView = scenario.views !== undefined && 'views' in scenario.views
      ? scenario.views.views.main
      : undefined
    const pageGraph = mainView?.view.views

    expect(pageGraph !== undefined && 'actions' in pageGraph ? pageGraph.actions?.[ELCE_EVENTS.PAGE_FINISHED] : undefined)
      .toEqual({ action: ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED })
    expect(pageGraph !== undefined && 'actions' in pageGraph ? pageGraph.actions?.[ELCE_EVENTS.SCENE_END] : undefined)
      .toBeUndefined()
  })

  it('keeps page ordering in a separate Sighty graph', () => {
    const document = learningDocumentService.createInitialDocument()
    const scenario = learningScenarioBuilder.build(document, { 'scene-page-a': emptyScene })

    expect(scenario.scenes?.['scene-page-a']).toBe(emptyScene)
    expect(scenario.scenes?.['scene-layout']).toMatchObject({ id: 'elce-document-layout-scene' })
    expect(scenario.scenes?.[ELCE_SCENARIO.SUMMARY_MENU_SCENE]).toMatchObject({ id: 'elce-document-menu-summary-scene' })
    expect(scenario.scenes?.['scene-title']).toMatchObject({ id: 'scene-title-document' })
    expect(scenario.scenes?.['scene-navigation']).toMatchObject({ id: 'scene-navigation-document' })
    expect(scenario.views).toMatchObject({ start: 'main' })

    const layoutSource = scenario.scenes?.['scene-layout']
    const layoutScene = layoutSource === undefined
      ? undefined
      : 'stories' in layoutSource
        ? layoutSource
        : layoutSource.sceneDoc
    const layoutPersos = layoutScene?.stories.main?.persos ?? []
    expect(layoutPersos.map((perso) => perso.name)).toEqual(expect.arrayContaining([
      'slot-menu',
      'slot-title',
      'slot-content',
      'slot-navigation',
    ]))
    const layoutMarkupPerso = layoutPersos.find((perso) => perso.id === `${document.id}-layout`)
    const layoutMarkup = layoutMarkupPerso?.initial !== undefined && 'markup' in layoutMarkupPerso.initial
      ? String(layoutMarkupPerso.initial.markup)
      : ''
    const contentSlot = layoutPersos.find((perso) => perso.name === 'slot-content')
    const navigationScene = scenario.scenes?.['scene-navigation']
    const navigationPerso = navigationScene !== undefined && 'stories' in navigationScene
      ? navigationScene.stories.main?.persos.find((perso) => perso.id === 'elce-navigation-controls')
      : undefined
    const navigationMarkup = navigationPerso?.initial !== undefined && 'markup' in navigationPerso.initial
      ? String(navigationPerso.initial.markup)
      : ''

    expect(layoutMarkup).toContain(`<!-- data-part="${document.id}:layout:menu" -->`)
    expect(layoutMarkup).toContain(`<!-- data-part="${document.id}:layout:title" -->`)
    expect(layoutMarkup).toContain(`<!-- data-part="${document.id}:layout:content" -->`)
    expect(layoutMarkup).not.toContain('content-region')
    expect(contentSlot?.initial).toMatchObject({
      tag: 'section',
      attr: { id: `${document.id}-content-region`, 'aria-label': 'Contenu de la page' },
      className: expect.stringContaining('elce-player-layout__content elce-player-layout__content-slot'),
    })
    expect(layoutMarkup).not.toContain('menu-toggle-host')
    expect(layoutMarkup).not.toContain('title-host')
    expect(navigationMarkup).toContain('<!-- data-part="elce:navigation:previous" -->')
    expect(navigationMarkup).toContain('<!-- data-part="elce:navigation:status" -->')
    expect(navigationMarkup).toContain('<!-- data-part="elce:navigation:next" -->')
    expect(navigationMarkup).not.toContain('-host')
  })

  it('requires every explicitly selected chapter before opening the target chapter', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-2', name: 'Chapitre 2',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-b', bdcId: 'bdc-section-b',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-2' },
    }))
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-3', name: 'Chapitre 3',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-c', bdcId: 'bdc-section-c',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-3' },
    }))
    document = applyDocumentCommand(document, {
      type: 'profile.definition.update',
      profile: {
        ...document.data.profile,
        readingConstraints: [{
          id: 'chapter-2-prerequisites',
          target: { kind: 'chapter', id: 'chapter-2' },
          requirement: { kind: 'chapters', chapterIds: ['chapter-1', 'chapter-3'] },
        }],
      },
    })
    const scenario = learningScenarioBuilder.build(document, {})
    const pageAccessGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_ACCESS] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly data: Readonly<Record<string, unknown>>
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean
    const accessInput = {
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b' as const,
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-b` },
      context: { profileEnabled: true, finishedPages: ['page-a'] },
    }

    expect(pageAccessGuard(accessInput)).toBe(false)
    expect(pageAccessGuard({
      ...accessInput,
      context: { profileEnabled: true, finishedPages: ['page-a', 'page-c'] },
    })).toBe(true)
  })

  it('opens subsequent pages freely while keeping visibility and chapter prerequisites active', () => {
    const initial = learningDocumentService.createInitialDocument()
    let document = applyDocumentCommand(initial, {
      type: 'summary.settings.update',
      summary: { ...initial.data.summary, pageContinuationMode: 'free' },
    })
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-2', name: 'Chapitre 2',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-b', bdcId: 'bdc-section-b',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-2' },
    }))
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-c', bdcId: 'bdc-section-c',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-2' },
    }))
    document = applyDocumentCommand(document, {
      type: 'profile.definition.update',
      profile: {
        ...document.data.profile,
        properties: [{ id: 'profile-audience', name: 'audience', label: 'Public', type: 'text', required: false, choices: [] }],
        constraints: [{
          id: 'page-b-visibility',
          target: { kind: 'page', id: 'page-b' },
          conditions: [{
            propertyId: 'profile-audience',
            condition: { kind: 'text', operator: 'equals', value: 'teacher' },
            joinWithNext: null,
          }],
          unmetBehavior: 'lock',
        }],
        readingConstraints: [{
          id: 'chapter-2-prerequisite',
          target: { kind: 'chapter', id: 'chapter-2' },
          requirement: { kind: 'previous-chapter' },
        }],
      },
    })
    const scenario = learningScenarioBuilder.build(document, {})
    const pageAccessGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_ACCESS] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly data: Readonly<Record<string, unknown>>
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean
    const pageExitGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_EXIT] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly data: Readonly<Record<string, unknown>>
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean
    const accessPage = (pageId: string, context: Readonly<Record<string, unknown>>) => pageAccessGuard({
      data: scenario.data ?? {},
      sceneKey: `scene-${pageId}`,
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}${pageId}` },
      context,
    })

    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: { profileEnabled: true },
    })).toBe(true)
    expect(accessPage('page-c', { profileEnabled: true, finishedPages: [] })).toBe(false)
    expect(accessPage('page-c', { profileEnabled: true, finishedPages: ['page-a'] })).toBe(true)
    expect(accessPage('page-b', {
      profileEnabled: true,
      profileValues: { 'profile-audience': 'student' },
      finishedPages: ['page-a'],
    })).toBe(false)
    expect(accessPage('page-b', {
      profileEnabled: true,
      profileValues: { 'profile-audience': 'teacher' },
      finishedPages: ['page-a'],
    })).toBe(true)
  })

  it('denies a page whose profile visibility is configured to lock', () => {
    const document = applyDocumentCommand(learningDocumentService.createInitialDocument(), {
      type: 'profile.definition.update',
      profile: {
        ...learningDocumentService.createInitialDocument().data.profile,
        properties: [{
          id: 'profile-region', name: 'region', label: 'Région', type: 'text', required: false, choices: [],
        }],
        constraints: [{
          id: 'locked-page',
          target: { kind: 'page', id: 'page-a' },
          conditions: [{
            propertyId: 'profile-region',
            condition: { kind: 'text', operator: 'equals', value: 'teacher' },
            joinWithNext: null,
          }],
          unmetBehavior: 'lock',
        }],
      },
    })
    const scenario = learningScenarioBuilder.build(document, {})
    const pageAccessGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_ACCESS] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly data: Readonly<Record<string, unknown>>
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean

    expect(pageAccessGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-a` },
      context: { profileEnabled: true, profileValues: { 'profile-region': 'student' } },
    })).toBe(false)
    expect(pageAccessGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-a` },
      context: { profileEnabled: true, profileValues: { 'profile-region': 'teacher' } },
    })).toBe(true)
  })

  it('projects the shared summary title and description in its menu and root presentations', () => {
    const initial = learningDocumentService.createInitialDocument()
    const document = applyDocumentCommand(initial, {
      type: 'summary.settings.update',
      summary: { ...initial.data.summary, title: 'Parcours auteur', description: 'Choisissez une page.' },
    })
    const scenario = learningScenarioBuilder.build(document, {})
    const menuScene = scenario.scenes?.[ELCE_SCENARIO.SUMMARY_MENU_SCENE]
    const rootScene = scenario.scenes?.[ELCE_SCENARIO.SUMMARY_SCENE]
    const getMarkup = (scene: typeof menuScene): string => scene !== undefined && 'stories' in scene
      ? scene.stories.main?.persos.flatMap((perso) => perso.initial !== undefined && 'markup' in perso.initial
        ? [String(perso.initial.markup)]
        : []).join('\n') ?? ''
      : ''

    expect(getMarkup(menuScene)).toContain('Parcours auteur')
    expect(getMarkup(menuScene)).toContain('Choisissez une page.')
    expect(getMarkup(rootScene)).toContain('Parcours auteur')
    expect(getMarkup(rootScene)).toContain('Choisissez une page.')

    const menuPersos = menuScene !== undefined && 'stories' in menuScene
      ? menuScene.stories.main?.persos ?? []
      : []
    const drawer = menuPersos.find((perso) => perso.id === `${document.id}-menu-drawer`)
    const panel = menuPersos.find((perso) => perso.id === `${document.id}-menu-panel`)
    const motion = ELCE_EDITOR_SETTINGS.player.navigation.summaryDrawerMotion

    expect(drawer?.actions?.[ELCE_EVENTS.MENU_DRAWER_OPEN]).toMatchObject({ style: { opacity: motion.open.opacity } })
    expect(panel?.actions?.[ELCE_EVENTS.MENU_DRAWER_OPEN]).toMatchObject({ style: { translateX: motion.open.translateX } })
    expect(drawer?.actions?.[ELCE_EVENTS.MENU_DRAWER_CLOSE]).toMatchObject({ style: { opacity: motion.close.opacity } })
    expect(panel?.actions?.[ELCE_EVENTS.MENU_DRAWER_CLOSE]).toMatchObject({ style: { translateX: motion.close.translateX } })
  })

  it('gates an Evaluation chapter on answered Questions and the configured 80 percent threshold', () => {
    const questionService = new ElceQuestionService()
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create',
      chapterId: 'chapter-evaluation',
      name: 'Évaluation',
      chapterType: CHAPTER_TYPE.EVALUATION,
    })
    document = applyDocumentCommand(document, {
      type: 'page.move',
      pageId: 'page-a',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-evaluation' },
    })

    const questionPageIds = ['page-a', 'page-eval-2', 'page-eval-3', 'page-eval-4', 'page-eval-5']
    for (const [index, pageId] of questionPageIds.entries()) {
      switch (pageId) {
        case 'page-a':
          break
        default:
          document = applyDocumentCommand(document, createPageCommand({
            pageId,
            bdcId: `bdc-section-${index + 2}`,
            name: `Question ${index + 1}`,
            placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-evaluation' },
          }))
      }
      document = applyDocumentCommand(document, {
        type: 'bdc.create',
        bdcId: `bdc-question-${index + 1}`,
        bdcType: BDC_TYPE.QUESTION,
        presetId: DEFAULT_PRESET_ID.QUESTION,
        placement: { kind: BDC_LOCATION.PAGE, pageId, index: 0 },
      })
      const question = document.bdcs.find((bdc) => bdc.id === `bdc-question-${index + 1}`)!.question!
      const multipleChoice = questionService.changeType(question, QUESTION_TYPE.MULTIPLE_CHOICE)
      document = applyDocumentCommand(document, {
        type: 'bdc.question.update',
        bdcId: `bdc-question-${index + 1}`,
        question: multipleChoice,
      })
    }

    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-evaluation-summary',
      bdcId: 'bdc-section-evaluation-summary',
      name: 'Bilan',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-evaluation' },
    }))
    const scenario = learningScenarioBuilder.build(document, {})
    const pageExitGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_EXIT] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly data: Readonly<Record<string, unknown>>
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean
    const summaryInput = {
      data: scenario.data ?? {},
      sceneKey: 'scene-page-evaluation-summary' as const,
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: { finishedPages: document.scenarioPageIds },
    }
    const passingResults = Object.fromEntries(questionPageIds.map((pageId, index) => [pageId, index < 4]))
    const failingResults = Object.fromEntries(questionPageIds.map((pageId, index) => [pageId, index < 3]))

    expect(document.chapters.find((chapter) => chapter.id === 'chapter-evaluation')?.pageIds.at(-1))
      .toBe('page-evaluation-summary')
    expect(pageExitGuard({
      ...summaryInput,
      sceneKey: 'scene-page-a',
      context: { finishedPages: document.scenarioPageIds },
    })).toBe(false)
    expect(pageExitGuard({
      ...summaryInput,
      sceneKey: 'scene-page-a',
      context: {
        finishedPages: document.scenarioPageIds.filter((pageId) => pageId !== 'page-a'),
        questionResults: { 'page-a': true },
      },
    })).toBe(false)
    expect(pageExitGuard({
      ...summaryInput,
      context: { finishedPages: document.scenarioPageIds, questionResults: passingResults },
    })).toBe(true)
    expect(pageExitGuard({
      ...summaryInput,
      context: { finishedPages: document.scenarioPageIds, questionResults: failingResults },
    })).toBe(false)
    expect(pageExitGuard({
      ...summaryInput,
      context: {
        finishedPages: document.scenarioPageIds,
        questionResults: failingResults,
        [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: {
          saveReaderState: async () => undefined,
          recordEvaluationResult: async () => undefined,
          getEvaluationThresholdOverride: () => 0.6,
        },
      },
    })).toBe(true)

    const freeDocument = applyDocumentCommand(document, {
      type: 'summary.settings.update',
      summary: { ...document.data.summary, pageContinuationMode: 'free' },
    })
    const freeScenario = learningScenarioBuilder.build(freeDocument, {})
    const freePageExitGuard = freeScenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_EXIT] as unknown as typeof pageExitGuard
    expect(freePageExitGuard({
      ...summaryInput,
      data: freeScenario.data ?? {},
      sceneKey: 'scene-page-a',
      context: {},
    })).toBe(true)
    expect(freePageExitGuard({
      ...summaryInput,
      data: freeScenario.data ?? {},
      context: { finishedPages: document.scenarioPageIds, questionResults: failingResults },
    })).toBe(false)
  })

  it('leaves an Evaluation chapter without Questions readable and unscored', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create',
      chapterId: 'chapter-evaluation',
      name: 'Évaluation',
      chapterType: CHAPTER_TYPE.EVALUATION,
    })
    document = applyDocumentCommand(document, {
      type: 'page.move',
      pageId: 'page-a',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-evaluation' },
    })
    const scenario = learningScenarioBuilder.build(document, {})
    const pageExitGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_EXIT] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly data: Readonly<Record<string, unknown>>
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean

    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: { finishedPages: ['page-a'] },
    })).toBe(true)
  })

  it('preserves mixed root order in Sighty, navigation paths, and the menu', () => {
    const initial = learningDocumentService.createInitialDocument()
    const withRootPage = applyDocumentCommand(initial, createPageCommand({
      pageId: 'page-root',
      bdcId: 'bdc-section-root',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const withChapter = applyDocumentCommand(withRootPage, {
      type: 'chapter.create',
      chapterId: 'chapter-2',
      name: 'Chapitre 2',
    })
    const withChapterPage = applyDocumentCommand(withChapter, createPageCommand({
      pageId: 'page-b',
      bdcId: 'bdc-section-b',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-2' },
    }))
    const document = applyDocumentCommand(withChapterPage, createPageCommand({
      pageId: 'page-catalog',
      bdcId: 'bdc-section-catalog',
      placement: { kind: PAGE_LOCATION.CATALOG },
    }))
    const scenario = learningScenarioBuilder.build(document, {
      'scene-page-a': emptyScene,
      'scene-page-root': emptyScene,
      'scene-page-b': emptyScene,
    }, 'page-root')
    const summaryMenuScene = scenario.scenes?.[ELCE_SCENARIO.SUMMARY_MENU_SCENE]
    const menuPersos = summaryMenuScene !== undefined && 'stories' in summaryMenuScene
      ? summaryMenuScene.stories.main?.persos ?? []
      : []
    const menuMarkup = menuPersos.flatMap((perso) => perso.initial !== undefined && 'markup' in perso.initial
      ? [String(perso.initial.markup)]
      : []).join('\n')
    const summaryMarkup = menuMarkup

    expect(scenario.data?.pageIds).toEqual(['page-a', 'page-root', 'page-b'])
    expect(scenario.data?.pagePaths).toMatchObject({
      'page-root': 'main/page-page-root/slot-content/page-root',
      'page-a': 'main/chapter-chapter-1/slot-content/page-a',
      'page-b': 'main/chapter-chapter-2/slot-content/page-b',
    })
    expect(scenario.data?.chapters).toMatchObject({
      'chapter-1': { name: 'Chapitre 1' },
      'chapter-2': { name: 'Chapitre 2' },
    })
    const mainView = scenario.views !== undefined && 'views' in scenario.views
      ? scenario.views.views.main
      : undefined
    const scenarioGraph = mainView?.view.views
    expect(scenarioGraph !== undefined && 'start' in scenarioGraph ? scenarioGraph.start : undefined).toBe('page-page-root')
    expect(scenarioGraph !== undefined && 'views' in scenarioGraph ? Object.keys(scenarioGraph.views) : []).toEqual([
      'chapter-chapter-1',
      'page-page-root',
      'chapter-chapter-2',
    ])
    expect(scenarioGraph !== undefined && 'views' in scenarioGraph
      ? scenarioGraph.views['page-page-root']?.view.slots?.['slot-content']
      : undefined).toMatchObject({ start: 'page-root' })
    expect(scenarioGraph !== undefined && 'views' in scenarioGraph
      ? scenarioGraph.views['chapter-chapter-1']?.view.slots?.['slot-content']
      : undefined).toMatchObject({ start: 'page-a' })
    expect(scenarioGraph !== undefined && 'views' in scenarioGraph
      ? scenarioGraph.views['chapter-chapter-2']?.view.slots?.['slot-content']
      : undefined).toMatchObject({ start: 'page-b' })
    expect(menuMarkup).toContain('elce-document-menu-scroll')
    expect(menuMarkup).not.toContain('elce-menu-scenario-entries')
    expect(summaryMarkup).toContain(`<!-- data-part="${document.id}:summary:menu:entry:page-a" -->`)
    expect(summaryMarkup).toContain(`<!-- data-part="${document.id}:summary:menu:entry:page-root" -->`)
    expect(summaryMarkup).toContain(`<!-- data-part="${document.id}:summary:menu:entry:page-b" -->`)
    expect(summaryMarkup.indexOf(`data-part="${document.id}:summary:menu:entry:page-a"`))
      .toBeLessThan(summaryMarkup.indexOf(`data-part="${document.id}:summary:menu:entry:page-root"`))
    expect(summaryMarkup.indexOf(`data-part="${document.id}:summary:menu:entry:page-root"`))
      .toBeLessThan(summaryMarkup.indexOf(`data-part="${document.id}:summary:menu:entry:page-b"`))
    expect(summaryMarkup).not.toContain('page-catalog')
    expect(summaryMenuScene !== undefined && 'stories' in summaryMenuScene
      ? summaryMenuScene.stories.main?.persos.some((perso) => perso.id === `${document.id}:summary:menu-button-page-catalog`)
      : false).toBe(false)
  })

  it('keeps multi-SCO navigation and page access within the launched chapter', () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-sco-a', name: 'Chapitre SCO A',
    })
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-sco-b', name: 'Chapitre SCO B',
    })
    document = applyDocumentCommand(document, {
      type: 'page.move', pageId: 'page-a', placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-sco-a' },
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-b', bdcId: 'bdc-section-b', name: 'Page B',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-sco-b' },
    }))
    const scenario = learningScenarioBuilder.build(document, {})
    const chapterContext = {
      [ELCE_SCORM_CHAPTER_CONTEXT_KEY]: 'chapter-sco-b',
      finishedPages: document.scenarioPageIds,
    }

    expect(pageAccessGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-a` },
      context: chapterContext,
      state: {},
    })).toBe(false)
    expect(pageAccessGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-b` },
      context: chapterContext,
      state: {},
    })).toBe(true)
    expect(pageAccessGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: ELCE_EVENTS.RUNTIME_INITIALIZE },
      context: chapterContext,
      state: {},
    })).toBe(true)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-a',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-b` },
      context: chapterContext,
      state: {},
    })).toBe(true)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: ELCE_EVENTS.NAVIGATION_PREVIOUS },
      context: chapterContext,
      state: {},
    })).toBe(true)
    const scormChapterContext = {
      ...chapterContext,
      [ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]: {
        'chapter-sco-a': 'ITEM-a',
        'chapter-sco-b': 'ITEM-b',
      },
      [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: {
        saveReaderState: async () => undefined,
        recordEvaluationResult: async () => undefined,
        navigateToChapter: async () => true,
      },
    }
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: ELCE_EVENTS.NAVIGATION_PREVIOUS },
      context: scormChapterContext,
      state: {},
    })).toBe(true)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: scormChapterContext,
      state: {},
    })).toBe(true)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: chapterContext,
      state: {},
    })).toBe(true)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: { [ELCE_SCORM_CHAPTER_CONTEXT_KEY]: 'chapter-sco-b' },
      state: {},
    })).toBe(false)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-a` },
      context: chapterContext,
      state: {},
    })).toBe(false)
    expect(pageExitGuard({
      data: scenario.data ?? {},
      sceneKey: 'scene-page-b',
      event: { name: `${ELCE_EVENTS.MENU_PREFIX}page-b` },
      context: chapterContext,
      state: {},
    })).toBe(true)
  })

  it('computes SCORM boundary buttons from their destinations and guards only Next exit', async () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-sco-b', name: 'Chapitre SCO B',
    })
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-sco-c', name: 'Chapitre SCO C',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-b', bdcId: 'bdc-section-b', name: 'Page B',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-sco-b' },
    }))
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-c', bdcId: 'bdc-section-c', name: 'Page C',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-sco-c' },
    }))
    const scenario = learningScenarioBuilder.build(document, {})
    const scenarioPagePaths = scenario.data?.pagePaths as Readonly<Record<string, string>> | undefined
    const selection = {
      slotName: ELCE_SCENARIO.CONTENT_SLOT,
      view: { path: scenarioPagePaths?.['page-b'] ?? '' },
      sceneKey: 'scene-page-b',
    }
    const sent: Readonly<{ sceneKey: string; event: Readonly<{ name: string; data?: unknown }> }>[] = []
    const canExit = vi.fn(async () => false)
    const canAccess = vi.fn(async () => true)
    const readerContext: Record<string, unknown> = {
      [ELCE_SCORM_CHAPTER_CONTEXT_KEY]: 'chapter-sco-b',
      [ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]: {
        'chapter-1': 'ITEM-a',
        'chapter-sco-c': 'ITEM-c',
      },
      [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: {
        saveReaderState: async () => undefined,
        recordEvaluationResult: async () => undefined,
        navigateToChapter: async () => true,
      },
    }
    const context = {
      event: { name: ELCE_EVENTS.PRESENTATION_REFRESH },
      data: scenario.data ?? {},
      context: readerContext,
      state: {},
      scenarioState: { active: selection, current: [selection], canAccess, canExit },
      send: async (sceneKey: string, event: Readonly<{ name: string; data?: unknown }>) => {
        sent.push({ sceneKey, event })
      },
    } as unknown as Parameters<typeof refreshPresentationAction>[0]

    await refreshPresentationAction(context)

    /** Reads one button's disabled state from the emitted presentation update. */
    const attributes = (name: string): Readonly<{ disabled: boolean }> => {
      const event = sent.find((entry) => entry.event.name === name)?.event
      return (event?.data as { attr: Readonly<{ disabled: boolean }> }).attr
    }
    expect(attributes(ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS).disabled).toBe(false)
    expect(attributes(ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT).disabled).toBe(true)
    expect(canExit).toHaveBeenCalledOnce()
    expect(canExit).toHaveBeenCalledWith(
      { path: scenarioPagePaths?.['page-b'] },
      { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
    )
    expect(canAccess).not.toHaveBeenCalled()

    canExit.mockResolvedValue(true)
    readerContext[ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY] = { 'chapter-1': 'ITEM-a' }
    sent.splice(0)
    await refreshPresentationAction(context)

    expect(attributes(ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS).disabled).toBe(false)
    expect(attributes(ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT).disabled).toBe(true)

    readerContext[ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY] = {
      'chapter-1': 'ITEM-a',
      'chapter-sco-c': 'ITEM-c',
    }
    sent.splice(0)
    await refreshPresentationAction(context)

    expect(attributes(ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS).disabled).toBe(false)
    expect(attributes(ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT).disabled).toBe(false)
  })

  it('persists the chapter end before requesting the next manifest SCO', async () => {
    let document = learningDocumentService.createInitialDocument()
    document = applyDocumentCommand(document, {
      type: 'chapter.create', chapterId: 'chapter-sco-b', name: 'Chapitre SCO B',
    })
    document = applyDocumentCommand(document, {
      type: 'page.move', pageId: 'page-a', placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-1' },
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-b', bdcId: 'bdc-section-b', name: 'Page B',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-sco-b' },
    }))
    const scenario = learningScenarioBuilder.build(document, {})
    const selection = {
      slotName: ELCE_SCENARIO.CONTENT_SLOT,
      view: { path: `${ELCE_SCENARIO.ROOT_VIEW}/chapter-1/page-a` },
      sceneKey: 'scene-page-a',
    }
    const saved: unknown[] = []
    const navigate = vi.fn(async () => true)
    const scormSink = {
      saveReaderState: async (...args: unknown[]) => { saved.push(args) },
      recordEvaluationResult: async () => undefined,
      navigateToChapter: navigate,
    }
    const context = {
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT, sourceSceneKey: ELCE_SCENARIO.NAVIGATION_SCENE },
      data: scenario.data ?? {},
      context: {
        [ELCE_SCORM_CHAPTER_CONTEXT_KEY]: 'chapter-1',
        [ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]: { 'chapter-sco-b': 'ITEM-b' },
        [ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]: scormSink,
        finishedPages: ['page-a'],
      },
      state: {},
      scenarioState: {
        active: selection,
        current: [selection],
        context: {},
        canAccess: async () => true,
        canExit: async () => true,
      },
      updateContext: async () => undefined,
      send: async () => undefined,
    } as unknown as Parameters<typeof navigateScormChapterAction>[0]

    await navigateScormChapterAction(context)

    expect(saved.at(-1)).toMatchObject([expect.any(Object), 'page-a'])
    expect(navigate).toHaveBeenCalledWith('chapter-sco-b')

    const savedCount = saved.length
    await navigateScormChapterAction({
      ...context,
      context: { ...context.context, finishedPages: [] },
    } as unknown as Parameters<typeof navigateScormChapterAction>[0])
    await navigateScormChapterAction({
      ...context,
      context: { ...context.context, [ELCE_SCORM_CHAPTER_SCO_IDENTIFIERS_CONTEXT_KEY]: {} },
    } as unknown as Parameters<typeof navigateScormChapterAction>[0])

    expect(saved).toHaveLength(savedCount)
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})

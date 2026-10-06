import { describe, expect, it } from 'vitest'
import type { SceneDoc } from 'codplay/scene/types'
import { BDC_LOCATION, BDC_TYPE, CHAPTER_TYPE, DEFAULT_PRESET_ID, ELCE_EVENTS, ELCE_SCENARIO_HANDLERS, PAGE_LOCATION, QUESTION_TYPE } from '../config/document-config'
import { applyDocumentCommand, createPageCommand } from '../app/commands/document-commands'
import { createInitialDocument } from '../domain/document-model'
import { ElceQuestionService } from '../domain/question-service'
import { buildScenario } from './scenario-builder'

const emptyScene: SceneDoc<string> = { id: 'empty-scene', stories: {} }

describe('Elcé scenario builder', () => {
  it('routes the shared page-completion event to the Sighty action', () => {
    const scenario = buildScenario(createInitialDocument(), {})
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
    const document = createInitialDocument()
    const scenario = buildScenario(document, { 'scene-page-a': emptyScene })

    expect(scenario.scenes?.['scene-page-a']).toBe(emptyScene)
    expect(scenario.scenes?.['scene-layout']).toMatchObject({ id: 'elce-document-layout-scene' })
    expect(scenario.scenes?.['scene-menu']).toMatchObject({ id: 'elce-document-menu-scene' })
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
  })

  it('gates an Evaluation chapter on answered Questions and the configured 80 percent threshold', () => {
    const questionService = new ElceQuestionService()
    let document = createInitialDocument()
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
    const scenario = buildScenario(document, {})
    const pageExitGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_EXIT] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean
    const summaryInput = {
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
  })

  it('leaves an Evaluation chapter without Questions readable and unscored', () => {
    let document = createInitialDocument()
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
    const scenario = buildScenario(document, {})
    const pageExitGuard = scenario.guards?.[ELCE_SCENARIO_HANDLERS.PAGE_EXIT] as unknown as (input: {
      readonly sceneKey: `scene-${string}`
      readonly event?: { readonly name: string }
      readonly context: Readonly<Record<string, unknown>>
    }) => boolean

    expect(pageExitGuard({
      sceneKey: 'scene-page-a',
      event: { name: ELCE_EVENTS.NAVIGATION_NEXT },
      context: { finishedPages: ['page-a'] },
    })).toBe(true)
  })

  it('preserves mixed root order in Sighty, navigation paths, and the menu', () => {
    const initial = createInitialDocument()
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
    const scenario = buildScenario(document, {
      'scene-page-a': emptyScene,
      'scene-page-root': emptyScene,
      'scene-page-b': emptyScene,
    }, 'page-root')
    const menuScene = scenario.scenes?.['scene-menu']
    const menuPanel = menuScene !== undefined && 'stories' in menuScene
      ? menuScene.stories.main?.persos.find((perso) => perso.id === `${document.id}-menu-panel`)
      : undefined
    const menuMarkup = menuPanel?.initial && 'markup' in menuPanel.initial
      ? String(menuPanel.initial.markup)
      : ''

    expect(scenario.data?.pageIds).toEqual(['page-a', 'page-root', 'page-b'])
    expect(scenario.data?.pagePaths).toMatchObject({
      'page-root': 'main/page-page-root/slot-content/page-root',
      'page-a': 'main/chapter-chapter-1/slot-content/page-a',
      'page-b': 'main/chapter-chapter-2/slot-content/page-b',
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
    expect(menuMarkup).toContain('id="elce-menu-scenario-entries"')
    expect(menuMarkup.indexOf('id="elce-menu-chapter-chapter-1"')).toBeLessThan(menuMarkup.indexOf('id="elce-menu-page-row-page-root"'))
    expect(menuMarkup.indexOf('id="elce-menu-page-row-page-root"')).toBeLessThan(menuMarkup.indexOf('id="elce-menu-chapter-chapter-2"'))
    expect(menuMarkup).not.toContain('page-catalog')
    expect(menuScene !== undefined && 'stories' in menuScene
      ? menuScene.stories.main?.persos.some((perso) => perso.id === 'elce-menu-page-button-page-catalog')
      : false).toBe(false)
  })
})

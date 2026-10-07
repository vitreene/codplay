import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { BDC_TYPE, CATALOG_TAB, CHAPTER_TYPE, EVALUATION_RETRY_SCOPE, PAGE_LOCATION } from '../../config/document-config'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from './editor-actions-facade'

describe('EditorActionsFacade', () => {
  it('routes page creation, rename and selection through the existing controller', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new EditorActionsFacade(actor)
    actor.start()
    actor.send({ type: 'editor.access.activate' })

    actions.createPage({ kind: PAGE_LOCATION.SCENARIO })

    const page = actor.getSnapshot().context.document.pages[1]
    expect(page).toMatchObject({ name: 'Page B', chapterId: null })
    expect(actor.getSnapshot().context.selectedPageId).toBe(page?.id)

    actions.renamePage(page!.id, 'Introduction')
    expect(actor.getSnapshot().context.document.pages[1]?.name).toBe('Introduction')

    actions.selectPage('page-a')
    expect(actor.getSnapshot().context.selectedPageId).toBe('page-a')
    expect(actor.getSnapshot().context.selectedChapterId).toBeNull()

    actor.stop()
  })

  it('routes chapter settings and catalogue selection through the same actor', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new EditorActionsFacade(actor)
    actor.start()
    actor.send({ type: 'editor.access.activate' })

    actions.createEvaluationChapter(actor.getSnapshot().context.document)
    const chapter = actor.getSnapshot().context.document.chapters[1]!
    expect(chapter).toMatchObject({ type: CHAPTER_TYPE.EVALUATION, name: 'Évaluation' })

    actions.updateEvaluationChapterSettings(chapter.id, 3, EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS)
    actions.selectChapter(chapter.id)
    actions.selectCatalogTab(CATALOG_TAB.MEDIA)

    expect(actor.getSnapshot().context.document.chapters[1]).toMatchObject({
      evaluationAttemptLimit: 3,
      evaluationRetryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
    })
    expect(actor.getSnapshot().context.selectedChapterId).toBe(chapter.id)
    expect(actor.getSnapshot().context.catalogTab).toBe(CATALOG_TAB.MEDIA)

    actor.stop()
  })

  it('uses the existing Question facade and document-command path for BDC actions', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new EditorActionsFacade(actor)
    actor.start()
    actor.send({ type: 'editor.access.activate' })

    actions.createQuestion(actor.getSnapshot().context.document, 'page-a', 1)

    expect(actor.getSnapshot().context.document.pages[0]?.bdcIds).toHaveLength(2)
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === BDC_TYPE.QUESTION)?.pageId).toBe('page-a')
    expect(actor.getSnapshot().context.document.bdcs.filter((bdc) => bdc.type === BDC_TYPE.QUESTION)).toHaveLength(1)

    actor.stop()
  })
})

import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { BDC_TYPE } from '../learning-definition'
import { CATALOG_TAB } from './learning-authoring-config'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { EVALUATION_RETRY_SCOPE } from '../evaluation/learning-evaluation-config'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { learningControllerMachine as controllerMachine } from './learning-controller-machine'
import { LearningEditorFacade } from './learning-editor-facade'

describe('LearningEditorFacade', () => {
  it('routes page creation, rename and selection through the existing controller', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new LearningEditorFacade(actor)
    actor.start()
    actor.send({ type: 'editor.access.activate' })

    actions.createPage({ kind: PAGE_LOCATION.SCENARIO })

    const page = actor.getSnapshot().context.document.pages[1]
    expect(page).toMatchObject({ name: 'Page B', chapterId: null })
    expect(actor.getSnapshot().context.selection.selectedPageId).toBe(page?.id)

    actions.renamePage(page!.id, 'Introduction')
    expect(actor.getSnapshot().context.document.pages[1]?.name).toBe('Introduction')

    actions.selectPage('page-a')
    expect(actor.getSnapshot().context.selection.selectedPageId).toBe('page-a')
    expect(actor.getSnapshot().context.selection.selectedChapterId).toBeNull()

    actor.stop()
  })

  it('routes chapter settings and catalogue selection through the same actor', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new LearningEditorFacade(actor)
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
    expect(actor.getSnapshot().context.selection.selectedChapterId).toBe(chapter.id)
    expect(actor.getSnapshot().context.composition.catalogTab).toBe(CATALOG_TAB.MEDIA)

    actor.stop()
  })

  it('uses the existing Question facade and document-command path for BDC actions', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new LearningEditorFacade(actor)
    actor.start()
    actor.send({ type: 'editor.access.activate' })

    actions.createQuestion(actor.getSnapshot().context.document, 'page-a', 1)

    expect(actor.getSnapshot().context.document.pages[0]?.bdcIds).toHaveLength(2)
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === BDC_TYPE.QUESTION)?.pageId).toBe('page-a')
    expect(actor.getSnapshot().context.document.bdcs.filter((bdc) => bdc.type === BDC_TYPE.QUESTION)).toHaveLength(1)

    actor.stop()
  })

  it('reads the latest Question and Card values for successive edits and shared Undo/Redo', () => {
    const actor = createActor(controllerMachine, { input: {} })
    const actions = new LearningEditorFacade(actor)
    actor.start()
    actor.send({ type: 'editor.access.activate' })
    const initial = actor.getSnapshot().context.document
    const page = initial.pages[0]
    if (page === undefined) throw new Error('La fixture Learning doit contenir une page.')

    actions.createQuestion(initial, page.id, page.bdcIds.length)
    const questionBdcId = actor.getSnapshot().context.document.pages[0]?.bdcIds.at(-1)
    if (questionBdcId === undefined) throw new Error('La façade doit créer la Question.')
    const question = actions.createQuestionEditorActions(questionBdcId)
    question.setTitle('Titre actuel')
    question.setPrompt('Énoncé actuel')
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionBdcId)?.question)
      .toMatchObject({ title: 'Titre actuel', prompt: 'Énoncé actuel' })

    actions.createStandaloneCard(page.id)
    const cardBdcId = actor.getSnapshot().context.document.pages[0]?.bdcIds.at(-1)
    if (cardBdcId === undefined) throw new Error('La façade doit créer une Carte directe.')
    const card = actions.createCardEditorActions()
    card.setCardText(cardBdcId, 'title', 'Titre Carte')
    card.setCardText(cardBdcId, 'message', 'Message Carte')
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === cardBdcId)?.card)
      .toMatchObject({ title: 'Titre Carte', message: 'Message Carte' })

    actor.send({ type: 'history.undo' })
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === cardBdcId)?.card?.message).toBe('')
    actor.send({ type: 'history.redo' })
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === cardBdcId)?.card?.message).toBe('Message Carte')
    actor.stop()
  })
})

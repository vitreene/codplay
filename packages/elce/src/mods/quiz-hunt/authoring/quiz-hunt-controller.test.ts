import { createActor, waitFor } from 'xstate'
import { describe, expect, it } from 'vitest'
import type { DocumentStore, MediaBlob } from '../../../core/persistence/indexed-db/document-store-types'
import { QUESTION_TYPE } from '../../../resources/bdcs/question/question-config'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { createQuizHuntControllerMachine } from './quiz-hunt-controller'
import { QuizHuntEditorFacade } from './quiz-hunt-editor-facade'

describe('Quiz Hunt shared authoring controller', () => {
  it('queues bank edits and restores the document and selection through the shared Undo/Redo history', async () => {
    const controller = createActor(createQuizHuntControllerMachine(), { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const initial = controller.getSnapshot().context.document
    const bank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    controller.send({ type: 'page.create', chapterId: bank.id, name: 'Épreuve à conserver' })
    await waitFor(controller, (snapshot) => snapshot.context.history.past.length === 1)
    const created = controller.getSnapshot().context.document
    const page = created.pages.at(-1)!
    controller.send({ type: 'document.apply', command: { type: 'page.mandatory.set', pageId: page.id, mandatory: true } })
    controller.send({ type: 'document.apply', command: { type: 'page.color.set', pageId: page.id, colorId: initial.settings.groups[0]!.id } })
    await waitFor(controller, (snapshot) => snapshot.context.history.past.length === 3)
    const authored = controller.getSnapshot().context.document
    expect(authored.pages.at(-1)).toMatchObject({ mandatory: true, colorId: initial.settings.groups[0]!.id })
    expect(controller.getSnapshot().context.selection.pageId).toBe(page.id)

    controller.send({ type: 'history.undo' })
    expect(controller.getSnapshot().context.document.pages.at(-1)).toMatchObject({ mandatory: true, colorId: null })
    controller.send({ type: 'history.undo' })
    controller.send({ type: 'history.undo' })
    expect(controller.getSnapshot().context.document).toBe(initial)
    expect(controller.getSnapshot().context.selection.pageId).toBe(initial.pages[0]!.id)

    controller.send({ type: 'history.redo' })
    controller.send({ type: 'history.redo' })
    controller.send({ type: 'history.redo' })
    expect(controller.getSnapshot().context.document).toBe(authored)
    expect(controller.getSnapshot().context.selection.pageId).toBe(page.id)
    controller.stop()
  })

  it('keeps successive shared Question and result Card edits, media, and history in the Quiz Hunt document', async () => {
    const store = new QuizHuntMediaStore()
    const controller = createActor(createQuizHuntControllerMachine(), { input: { documentStore: store } })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const facade = new QuizHuntEditorFacade(controller)
    const initial = controller.getSnapshot().context.document
    const questionPage = initial.pages.find((page) => page.chapterId !== null)
    const questionBdcId = questionPage?.bdcIds[0]
    const successCardId = initial.settings.successCardBdcId
    if (questionPage === undefined || questionBdcId === undefined) throw new Error('La banque doit contenir sa Question requise.')

    const question = facade.createQuestionEditorActions(questionBdcId)
    question.setTitle('Question conservée')
    question.setPrompt('Quel astre éclaire la Terre ?')
    question.setType(QUESTION_TYPE.CHOICE)
    question.addAnswer()
    let authoredQuestion = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionBdcId)?.question
    const firstAnswerId = authoredQuestion?.answers[0]?.id
    const addedAnswerId = authoredQuestion?.answers.at(-1)?.id
    if (firstAnswerId === undefined || addedAnswerId === undefined) throw new Error('Les réponses de la Question doivent être éditables.')
    question.moveAnswer(addedAnswerId, 0)
    question.removeAnswer(firstAnswerId)
    authoredQuestion = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionBdcId)?.question
    expect(authoredQuestion).toMatchObject({ title: 'Question conservée', prompt: 'Quel astre éclaire la Terre ?', type: QUESTION_TYPE.CHOICE })
    expect(authoredQuestion?.answers[0]?.id).toBe(addedAnswerId)
    expect(authoredQuestion?.answers.some((answer) => answer.id === firstAnswerId)).toBe(false)

    const card = facade.createCardEditorActions()
    card.setCardText(successCardId, 'title', 'Réussite conservée')
    card.setCardText(successCardId, 'message', 'Le résultat est validé.')
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === successCardId)?.card)
      .toMatchObject({ title: 'Réussite conservée', message: 'Le résultat est validé.' })

    question.importMedia(new File(['illustration'], 'question.png', { type: 'image/png' }))
    await waitFor(controller, (snapshot) => snapshot.context.document.bdcs
      .find((bdc) => bdc.id === questionBdcId)?.question?.mediaId !== null)
    const importedMediaId = controller.getSnapshot().context.document.bdcs
      .find((bdc) => bdc.id === questionBdcId)?.question?.mediaId
    if (importedMediaId == null) throw new Error('L’image importée doit être associée à la Question.')
    expect(store.media.has(importedMediaId)).toBe(true)

    question.clearMedia()
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionBdcId)?.question?.mediaId).toBeNull()
    controller.send({ type: 'history.undo' })
    await waitFor(controller, (snapshot) => snapshot.context.document.bdcs
      .find((bdc) => bdc.id === questionBdcId)?.question?.mediaId === importedMediaId)
    controller.send({ type: 'history.redo' })
    await waitFor(controller, (snapshot) => snapshot.context.document.bdcs
      .find((bdc) => bdc.id === questionBdcId)?.question?.mediaId === null)

    question.deleteQuestion()
    expect(controller.getSnapshot().context.document.pages.find((page) => page.id === questionPage.id)?.bdcIds)
      .toContain(questionBdcId)
    controller.stop()
  })
})

/** Stores imported Quiz Hunt media for controller tests without IndexedDB. */
class QuizHuntMediaStore implements DocumentStore<QuizHuntDocument> {
  public readonly media = new Map<string, Blob>()

  public async loadDocument(): Promise<null> { return null }
  public async saveDocument(): Promise<void> { }
  public async saveDocumentAndDeleteMedia(): Promise<void> { }
  public async deleteDocument(): Promise<void> { }
  public async deleteMedia(mediaIds: readonly string[]): Promise<void> {
    mediaIds.forEach((mediaId) => this.media.delete(mediaId))
  }
  public async loadSyncState(documentId: string) {
    return { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' as const }
  }
  public async saveSyncState(): Promise<void> { }
  public async saveMedia(media: MediaBlob): Promise<void> { this.media.set(media.id, media.blob) }
  public async loadMedia(mediaId: string): Promise<Blob | null> { return this.media.get(mediaId) ?? null }
}

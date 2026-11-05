import { createActor, waitFor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { createQuizHuntControllerMachine } from './quiz-hunt-controller'

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
})

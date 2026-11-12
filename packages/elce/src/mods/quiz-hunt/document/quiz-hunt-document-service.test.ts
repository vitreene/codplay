import { describe, expect, it } from 'vitest'
import { ElceQuestionService } from '../../../resources/bdcs/question/domain/question-service'
import { QuizHuntDocumentService } from './quiz-hunt-document-service'

describe('Quiz Hunt authoring operations', () => {
  const documents = new QuizHuntDocumentService()

  it('edits and validates the question created with a bank page using the shared Question service', () => {
    const initial = documents.createInitialDocument()
    const bank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const created = documents.createPage(initial, bank.id, 'Une épreuve')
    const page = created.pages.at(-1)!
    const bdc = created.bdcs.find((candidate) => page.bdcIds.includes(candidate.id))!
    const questions = new ElceQuestionService()
    const edited = questions.setPrompt(bdc.question!, 'Quel est le satellite naturel de la Terre ?')
    const changed = documents.updateQuestion(created, bdc.id, edited)
    const question = changed.bdcs.find((candidate) => candidate.id === bdc.id)!.question!
    const answerIds = question.answers.map((answer) => answer.id)
    const expectedIds = question.answers.filter((answer) => answer.correct).map((answer) => answer.id)
    const selection = questions.selectAnswer(answerIds, 'single', [], expectedIds[0]!)

    expect(question.prompt).toBe(edited.prompt)
    expect(questions.validateAnswer(answerIds, expectedIds, selection).isCorrect).toBe(true)
    expect(created.bdcs.find((candidate) => candidate.id === bdc.id)!.question!.prompt).toBe('')
  })

  it('adds Sections on both sides of a question without changing its identity or content', () => {
    const initial = documents.createInitialDocument()
    const created = documents.createPage(initial, initial.chapters[0]!.id, 'Question illustrée')
    const page = created.pages.at(-1)!
    const questionId = page.bdcIds[0]!
    const before = documents.addSection(created, page.id, 0)
    const after = documents.addSection(before, page.id, 2)
    const ids = after.pages.find((candidate) => candidate.id === page.id)!.bdcIds

    expect(ids[1]).toBe(questionId)
    expect(ids.map((id) => after.bdcs.find((bdc) => bdc.id === id)!.type)).toEqual(['section', 'question', 'section'])
    expect(after.bdcs.find((bdc) => bdc.id === questionId)).toBe(created.bdcs.find((bdc) => bdc.id === questionId))
    expect(page.bdcIds).toEqual([questionId])
  })

  it('renames banks without changing the role or ownership of their questions', () => {
    const initial = documents.createInitialDocument()
    const bank = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const created = documents.createPage(initial, bank.id, 'Finale thématique')
    const renamed = documents.renameChapter(created, bank.id, 'Défis ultimes')
    const changed = renamed.chapters.find((chapter) => chapter.id === bank.id)!

    expect(changed.name).toBe('Défis ultimes')
    expect(changed.type).toBe(bank.type)
    expect(changed.pageIds).toEqual(created.chapters.find((chapter) => chapter.id === bank.id)!.pageIds)
    expect(renamed.pages).toBe(created.pages)
  })

  it('clears a deleted color in both banks while preserving their authored questions', () => {
    const initial = documents.createInitialDocument()
    const group = { id: 'ocean', name: 'Océan', color: '#24618b' }
    const configured = documents.setGroup(initial, group)
    const assigned = configured.chapters.reduce((document, chapter) => {
      const created = documents.createPage(document, chapter.id, `Contenu ${chapter.type}`)
      return documents.setPageColor(created, created.pages.at(-1)!.id, group.id)
    }, configured)
    const removed = documents.removeGroup(assigned, group.id)
    const assignedPageIds = assigned.pages.filter((page) => page.colorId === group.id).map((page) => page.id)

    expect(assignedPageIds.map((pageId) => removed.pages.find((page) => page.id === pageId)!.colorId)).toEqual([null, null])
    expect(removed.pages.map((page) => page.id)).toEqual(assigned.pages.map((page) => page.id))
    expect(removed.bdcs).toBe(assigned.bdcs)
    expect(removed.chapters).toBe(assigned.chapters)
    const reassigned = documents.setPageColor(removed, removed.pages.at(-1)!.id, removed.settings.groups[0]!.id)
    expect(reassigned.pages.at(-1)!.colorId).toBe(removed.settings.groups[0]!.id)
  })

  it('allows progressive authoring and mandatory choices beyond the displayed capacity', () => {
    const initial = documents.createInitialDocument()
    const bank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const authored = Array.from({ length: 6 }).reduce<typeof initial>((document, _, index) => {
      const created = documents.createPage(document, bank.id, `Épreuve ${index}`)
      return documents.setMandatory(created, created.pages.at(-1)!.id, true)
    }, initial)

    expect(authored.pages.filter((page) => page.mandatory)).toHaveLength(6)
    expect(authored.chapters.find((chapter) => chapter.type === 'finals')!.pageIds).toEqual([])
    expect(authored.pages.filter((page) => page.chapterId !== null).every((page) => page.colorId === null)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { createStableId } from '../../../core/document/stable-id'
import { applyDocumentCommand } from '../../../domain/commands/document-commands'
import { createQuestionBdcCommand } from '../../../resources/bdcs/question/authoring/question-command-factory'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG } from '../organization/learning-organization-config'
import { ELCE_DOCUMENT_VERSION, LearningDocument } from './learning-document'
import { learningDocumentService } from './learning-document-service'

describe('Learning document model and creation service', () => {
  it('creates and round-trips the current document shape', () => {
    const document = learningDocumentService.createInitialDocument()
    const rehydrated = LearningDocument.fromJSON(document.toJSON())

    expect(document.toJSON()).toMatchObject({
      id: 'elce-document',
      version: ELCE_DOCUMENT_VERSION,
      name: 'Document Elcé',
      chapters: [{ id: 'chapter-1', type: CHAPTER_TYPE.STANDARD, pageIds: ['page-a'] }],
      pages: [{ id: 'page-a', type: 'flux', chapterId: 'chapter-1' }],
      bdcs: [{ id: 'bdc-section-1', type: 'section', presetId: 'section-basic' }],
      scenarioEntries: [{ kind: 'chapter', chapterId: 'chapter-1' }],
    })
    expect(rehydrated.toJSON()).toEqual(document.toJSON())
    expect(rehydrated.scenarioPageIds).toEqual(['page-a'])
  })

  it('rejects a document version outside the current Learning format', () => {
    const document = learningDocumentService.createInitialDocument()

    expect(() => LearningDocument.fromJSON({ ...document.toJSON(), version: 6 } as never))
      .toThrow('Version de document Elcé non supportée : 6')
  })

  it('keeps page and chapter naming in the Learning creation service', () => {
    const document = learningDocumentService.createInitialDocument()

    expect(learningDocumentService.nextPageName(document)).toBe('Page B')
    expect(learningDocumentService.nextChapterName(document)).toBe('Chapitre 2')
    expect(learningDocumentService.nextChapterName(document, CHAPTER_TYPE.EVALUATION))
      .toBe(CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].defaultName)
  })

  it('flattens legacy rich Question answer labels when rehydrating v9 documents', () => {
    const source = learningDocumentService.createInitialDocument()
    const withQuestion = applyDocumentCommand(source, createQuestionBdcCommand('bdc-question-legacy', 'page-a', 1))
    const richLabel = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Oui' }] }],
    }
    const saved: unknown = {
      ...withQuestion.toJSON(),
      bdcs: withQuestion.bdcs.map((bdc) => bdc.id !== 'bdc-question-legacy' || bdc.question == null
        ? bdc
        : { ...bdc, question: { ...bdc.question, answers: bdc.question.answers.map((answer, index) => index === 0
          ? { ...answer, label: richLabel }
          : answer) } }),
    }

    const restored = LearningDocument.fromJSON(saved)

    expect(restored.bdcs.find((bdc) => bdc.id === 'bdc-question-legacy')?.question?.answers[0]?.label).toBe('Oui')
  })

  it('creates stable identifiers with the requested prefix', () => {
    expect(createStableId('page')).toMatch(/^page-[0-9a-f-]{36}$/)
  })
})

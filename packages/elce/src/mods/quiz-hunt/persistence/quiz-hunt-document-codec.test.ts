import { describe, expect, it } from 'vitest'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import { readQuizHuntDocument, writeQuizHuntDocument } from './quiz-hunt-document-codec'

describe('Quiz Hunt document codec', () => {
  it('exposes the shared IndexedDB indexes alongside its versioned document', () => {
    const document = new QuizHuntDocumentService().createInitialDocument('quiz-hunt-cache', 'Cache')
    const serialized = writeQuizHuntDocument(document)

    expect(serialized.id).toBe(document.id)
    expect(serialized.medias).toEqual(document.medias.map(({ id }) => ({ id })))
    expect(serialized.version).toBe(1)
    expect(readQuizHuntDocument(serialized)).toEqual(document)
  })
})

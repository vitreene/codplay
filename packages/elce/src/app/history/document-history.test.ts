import { describe, expect, it } from 'vitest'
import { createInitialDocument } from '../../domain/document/document-model'
import { applyDocumentCommand } from '../../domain/commands/document-commands'
import { EMPTY_DOCUMENT_HISTORY, recordDocumentHistory, redoDocumentHistory, undoDocumentHistory } from './document-history'
import type { DocumentHistoryPosition } from './document-history'

/** Creates one history position without involving the editor actor. */
function position(name: string): DocumentHistoryPosition {
  return {
    document: applyDocumentCommand(createInitialDocument(), { type: 'document.rename', name }),
    selectedPageId: 'page-a',
    selectedChapterId: null,
    selectedCarouselCardBdcId: null,
    sectionSelection: null,
  }
}

describe('document history', () => {
  it('groups only adjacent edits of the same field within 500 ms', () => {
    const first = position('Avant')
    const second = position('A')
    const third = position('AB')
    const fourth = position('ABC')
    const fifth = position('ABCD')
    let history = recordDocumentHistory(EMPTY_DOCUMENT_HISTORY, first, second, 'title', 100)
    history = recordDocumentHistory(history, second, third, 'title', 599)
    expect(history.past).toHaveLength(1)
    expect(history.past[0]?.before).toBe(first)
    history = recordDocumentHistory(history, third, fourth, 'other', 600)
    history = recordDocumentHistory(history, fourth, fifth, 'other', 1101)
    expect(history.past).toHaveLength(3)
  })

  it('abandons Redo after a new author gesture', () => {
    const first = position('Avant')
    const second = position('Après')
    const alternative = position('Autre')
    const history = recordDocumentHistory(EMPTY_DOCUMENT_HISTORY, first, second, null, 100)
    const undone = undoDocumentHistory(history)
    expect(undone?.position).toBe(first)
    expect(redoDocumentHistory(undone!.history)?.position).toBe(second)
    const replaced = recordDocumentHistory(undone!.history, first, alternative, null, 200)
    expect(replaced.future).toHaveLength(0)
    expect(redoDocumentHistory(replaced)).toBeNull()
  })
})

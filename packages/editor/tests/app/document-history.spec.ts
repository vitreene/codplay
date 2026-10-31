import { describe, expect, it } from 'vitest'
import { createEmptyEditorScene } from '../../src/app/scenes/editor-scene'
import { DocumentHistory, MAX_DOCUMENT_HISTORY } from '../../src/app/history/document-history'
import type { EditorScene } from '../../src/app/commands/types'
import type { Selection } from '../../src/app/controller/types'

/** Creates a standalone history fixture with one stable document identity. */
function scene(title: string): EditorScene {
  return { ...createEmptyEditorScene(title), id: 'history-test-scene' }
}

describe('Editor document history', () => {
  it('restores one committed before/after pair through Undo and Redo', () => {
    const history = new DocumentHistory()
    const beforeScene = scene('Before')
    const afterScene = { ...beforeScene, meta: { ...beforeScene.meta, title: 'After' } }
    const beforeSelection: Selection = { itemIds: [] }
    const afterSelection: Selection = { itemIds: [] }

    history.record({ beforeScene, afterScene, beforeSelection, afterSelection })

    expect(history.getState()).toEqual({ canUndo: true, canRedo: false })
    expect(history.undo()).toEqual({ scene: beforeScene, selection: beforeSelection })
    expect(history.getState()).toEqual({ canUndo: false, canRedo: true })
    expect(history.redo()).toEqual({ scene: afterScene, selection: afterSelection })
    expect(history.getState()).toEqual({ canUndo: true, canRedo: false })
  })

  it('does not record a fresh wrapper whose document values are unchanged', () => {
    const history = new DocumentHistory()
    const beforeScene = scene('Unchanged')
    const afterScene = { ...beforeScene, meta: { ...beforeScene.meta } }

    history.record({
      beforeScene,
      afterScene,
      beforeSelection: { itemIds: [] },
      afterSelection: { itemIds: [] },
    })

    expect(history.getState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('drops the abandoned Redo branch after a new document commit', () => {
    const history = new DocumentHistory()
    const initial = scene('Initial')
    const first = { ...initial, meta: { ...initial.meta, title: 'First' } }
    const second = { ...initial, meta: { ...initial.meta, title: 'Second' } }
    const selection: Selection = { itemIds: [] }

    history.record({ beforeScene: initial, afterScene: first, beforeSelection: selection, afterSelection: selection })
    history.undo()
    history.record({ beforeScene: initial, afterScene: second, beforeSelection: selection, afterSelection: selection })

    expect(history.getState()).toEqual({ canUndo: true, canRedo: false })
    expect(history.redo()).toBeNull()
    expect(history.undo()?.scene).toBe(initial)
  })

  it('keeps only the latest one hundred committed steps', () => {
    const history = new DocumentHistory()
    const selection: Selection = { itemIds: [] }

    Array.from({ length: MAX_DOCUMENT_HISTORY + 1 }).reduce<EditorScene>((beforeScene, _, index) => {
      const afterScene = { ...beforeScene, meta: { ...beforeScene.meta, title: `Step ${index}` } }
      history.record({ beforeScene, afterScene, beforeSelection: selection, afterSelection: selection })
      return afterScene
    }, scene('Initial'))

    expect(history.getState().canUndo).toBe(true)
    expect(Array.from({ length: MAX_DOCUMENT_HISTORY }, () => history.undo()).every(Boolean)).toBe(true)
    expect(history.undo()).toBeNull()
  })

  it('copies selection endpoints and removes references absent from a restored document', () => {
    const history = new DocumentHistory()
    const beforeScene = {
      ...scene('With item'),
      items: [{
        id: 'item',
        type: 'text' as const,
        parentId: null,
        order: 'a',
        visible: true,
        contentId: null,
        initialDecorId: 'decor',
        keyframes: [{ id: 'first', timeMs: 0, decorId: 'decor' }],
      }],
    }
    const afterScene = scene('Without item')
    const beforeSelection: Selection = { itemIds: ['item'], keyframeId: 'first' }
    const afterSelection: Selection = { itemIds: ['item'], keyframeId: 'missing' }

    history.record({ beforeScene, afterScene, beforeSelection, afterSelection })
    beforeSelection.itemIds.pop()
    afterSelection.itemIds.pop()

    expect(history.undo()?.selection).toEqual({ itemIds: ['item'], keyframeId: 'first' })
    expect(history.redo()?.selection).toEqual({ itemIds: [] })

    history.clear()
    expect(history.getState()).toEqual({ canUndo: false, canRedo: false })
  })
})

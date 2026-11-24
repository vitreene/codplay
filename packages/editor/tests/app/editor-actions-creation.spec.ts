import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import { EditorActionsFacade } from '../../src/app/facades/editor-actions-facade'
import { createEmptyEditorScene } from '../../src/app/scenes/editor-scene'

/** Starts the real controller and actions facade on an empty free-placement scene. */
function startEditor() {
  const controller = createActor(controllerMachine)
  controller.start()
  const actions = new EditorActionsFacade(controller)
  const scene = createEmptyEditorScene('Creation')
  actions.loadScene({ ...scene, rootCapsule: { ...scene.rootCapsule!, grid: { rows: 1, cols: 1 } } })
  return { controller, actions }
}

describe('EditorActionsFacade — item creation', () => {
  it('creates a text item in one transaction: one Undo step removes it completely', () => {
    const { controller, actions } = startEditor()
    actions.createItem({ type: 'text', geometry: { translate: { x: 20, y: 18 }, width: 60, height: 18 }, introTimeMs: 2000 })

    const { scene, selection } = controller.getSnapshot().context
    const item = scene!.items[0]!
    expect(scene!.items).toHaveLength(1)
    expect(item.type).toBe('text')
    // The item is born at the playhead: its intro is a keyframe at that time, sharing the initial decor.
    expect(item.keyframes.map((keyframe) => [keyframe.timeMs, keyframe.decorId === item.initialDecorId])).toEqual([[2000, true]])
    expect(scene!.contents[item.contentId!]?.text).toBe('Nouveau texte')
    expect(selection.itemIds).toEqual([item.id])

    actions.undo()
    expect(controller.getSnapshot().context.scene!.items).toEqual([])
    expect(actions.getHistoryState().canUndo).toBe(false)
  })

  it('creates a block without typing it', () => {
    const { controller, actions } = startEditor()
    actions.createItem({ type: 'bloc', geometry: { translate: { x: 0, y: 0 }, width: 10, height: 10 }, introTimeMs: 0 })
    const item = controller.getSnapshot().context.scene!.items[0]!
    expect(item.type).toBe('bloc')
    expect(item.contentId).toBeNull()
  })
})

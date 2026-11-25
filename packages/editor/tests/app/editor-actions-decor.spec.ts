import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import { EditorActionsFacade } from '../../src/app/facades/editor-actions-facade'
import type { EditorScene } from '../../src/app/commands/types'

/** One block on a fine-grid root with one root zone. */
function scene(): EditorScene {
  return {
    id: 'decor-actions',
    meta: { title: 'Decor actions', durationMs: 5_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    rootCapsule: { kind: 'card', distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 }, grid: { rows: 90, cols: 160 } },
    items: [{ id: 'item', type: 'bloc', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'decor', keyframes: [] }],
    contents: {},
    decors: { decor: { id: 'decor', style: { color: 'red' } } },
    zones: {
      zone: {
        id: 'zone', capsuleId: null, name: 'A',
        surfaces: { landscape: { row: 1, col: 1, rowSpan: 4, colSpan: 4 }, portrait: { row: 1, col: 1, rowSpan: 4, colSpan: 4 } },
      },
    },
    markerTracks: {},
  }
}

/** Starts the real controller and facade on the fixture. */
function startEditor() {
  const controller = createActor(controllerMachine)
  controller.start()
  const actions = new EditorActionsFacade(controller)
  actions.loadScene(scene())
  return { controller, actions }
}

describe('EditorActionsFacade — Decor operations', () => {
  it('commits a Decor edit as one Undo step', () => {
    const { controller, actions } = startEditor()
    actions.commitDecorEdit([
      { name: 'setDecor', args: { decorId: 'decor', patch: { style: { color: 'blue' } } } },
      { name: 'setDecor', args: { decorId: 'decor', patch: { offset: { width: 12 } } } },
    ])
    expect(controller.getSnapshot().context.scene!.decors.decor).toMatchObject({ style: { color: 'blue' }, offset: { width: 12 } })
    actions.undo()
    expect(controller.getSnapshot().context.scene!.decors.decor).toEqual({ id: 'decor', style: { color: 'red' } })
    expect(actions.getHistoryState().canUndo).toBe(false)
  })

  it('selects a zone and replaces a surface as one Undo step', () => {
    const { controller, actions } = startEditor()
    actions.selectZone('zone')
    expect(controller.getSnapshot().context.selectedZoneId).toBe('zone')
    actions.setZonesSurface({
      capsuleId: null,
      orientation: 'landscape',
      zones: [{ id: 'zone', name: 'A', area: { row: 2, col: 2, rowSpan: 4, colSpan: 4 } }],
    })
    expect(controller.getSnapshot().context.scene!.zones.zone!.surfaces.landscape).toMatchObject({ row: 2, col: 2 })
    actions.undo()
    expect(controller.getSnapshot().context.scene!.zones.zone!.surfaces.landscape).toMatchObject({ row: 1, col: 1 })
  })

  it('abandons a Decor phase without writing the document', () => {
    const { controller, actions } = startEditor()
    const before = controller.getSnapshot().context.scene
    actions.abortDecorEdit()
    expect(controller.getSnapshot().context.scene).toBe(before)
    expect(actions.getHistoryState().canUndo).toBe(false)
  })
})

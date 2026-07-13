import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import type { EditorScene } from '../../src/app/commands/types'

function sceneFixture(): EditorScene {
  return {
    id: 'scene-1',
    meta: {
      title: 'Fixture scene',
      durationMs: 5000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items: [],
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
  }
}

describe('controllerMachine — initial state', () => {
  it('starts idle, with no scene loaded and an empty selection', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.scene).toBeNull()
    expect(actor.getSnapshot().context.selection).toEqual({ itemIds: [] })
  })
})

describe('controllerMachine — scene lifecycle', () => {
  it('loads a scene via SCENE_LOADED', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: sceneFixture() })

    expect(actor.getSnapshot().context.scene?.id).toBe('scene-1')
    expect(actor.getSnapshot().context.currentSceneId).toBe('scene-1')
  })
})

describe('controllerMachine — selection, two emitters converging on one truth (§5)', () => {
  it('SELECT_ITEM sets the selection regardless of which module emitted it', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'], keyframeId: 'kf-1' })

    expect(actor.getSnapshot().context.selection).toEqual({ itemIds: ['item-1'], keyframeId: 'kf-1' })
  })

  it('CLEAR_SELECTION empties the selection', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
    actor.send({ type: 'CLEAR_SELECTION' })

    expect(actor.getSnapshot().context.selection).toEqual({ itemIds: [] })
  })

  it('selection survives independently of the create mode (context, not gated by state)', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SELECT_ITEM', itemIds: ['item-1'] })
    actor.send({ type: 'CREATE_MODE_ENTER', itemType: 'text' })

    expect(actor.getSnapshot().value).toBe('creating')
    expect(actor.getSnapshot().context.selection).toEqual({ itemIds: ['item-1'] })
  })
})

describe('controllerMachine — create mode (§3)', () => {
  it('CREATE_MODE_ENTER moves to creating and records the target type', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'CREATE_MODE_ENTER', itemType: 'image' })

    expect(actor.getSnapshot().value).toBe('creating')
    expect(actor.getSnapshot().context.creatingType).toBe('image')
  })

  it('CREATE_CANCEL returns to idle without mutating the document', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: sceneFixture() })
    actor.send({ type: 'CREATE_MODE_ENTER', itemType: 'text' })
    actor.send({ type: 'CREATE_CANCEL' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.creatingType).toBeNull()
    expect(actor.getSnapshot().context.scene?.items).toHaveLength(0)
  })

  it('CREATE_COMMIT returns to idle and clears the recorded type', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'CREATE_MODE_ENTER', itemType: 'text' })
    actor.send({ type: 'CREATE_COMMIT' })

    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.creatingType).toBeNull()
  })
})

describe('controllerMachine — RUN_COMMAND is the only write path (§4)', () => {
  it('applies a createItem command onto the loaded scene', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: sceneFixture() })
    actor.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })

    expect(actor.getSnapshot().context.scene?.items).toHaveLength(1)
  })

  it('a mutation from one region (RUN_COMMAND) reflects onto what any other region reads (context is the single source)', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: sceneFixture() })
    actor.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })

    const itemId = actor.getSnapshot().context.scene!.items[0]!.id
    actor.send({ type: 'SELECT_ITEM', itemIds: [itemId] })

    const snapshot = actor.getSnapshot()
    expect(snapshot.context.selection.itemIds).toEqual([itemId])
    expect(snapshot.context.scene?.items.find((i) => i.id === itemId)).toBeDefined()
  })

  it('RUN_TRANSACTION applies N commands as one resulting document', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'SCENE_LOADED', scene: sceneFixture() })
    actor.send({
      type: 'RUN_TRANSACTION',
      commands: [
        { name: 'createItem', args: { geometry: {} } },
        { name: 'createItem', args: { geometry: {} } },
      ],
    })

    expect(actor.getSnapshot().context.scene?.items).toHaveLength(2)
  })

  it('does nothing when no scene is loaded yet (no crash, no-op)', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })

    expect(actor.getSnapshot().context.scene).toBeNull()
  })
})

describe('controllerMachine — panels', () => {
  it('OPEN_PANEL adds a panel without duplicating it', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'OPEN_PANEL', panel: 'decor' })
    actor.send({ type: 'OPEN_PANEL', panel: 'decor' })

    expect(actor.getSnapshot().context.openPanels).toEqual(['decor'])
  })

  it('CLOSE_PANEL removes just that panel', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    actor.send({ type: 'OPEN_PANEL', panel: 'decor' })
    actor.send({ type: 'OPEN_PANEL', panel: 'capsule' })
    actor.send({ type: 'CLOSE_PANEL', panel: 'decor' })

    expect(actor.getSnapshot().context.openPanels).toEqual(['capsule'])
  })
})

describe('controllerMachine — zones visibility (§3, ephemeral toggle)', () => {
  it('TOGGLE_ZONES_VISIBLE flips the flag', () => {
    const actor = createActor(controllerMachine)
    actor.start()
    expect(actor.getSnapshot().context.zonesVisible).toBe(false)

    actor.send({ type: 'TOGGLE_ZONES_VISIBLE' })
    expect(actor.getSnapshot().context.zonesVisible).toBe(true)

    actor.send({ type: 'TOGGLE_ZONES_VISIBLE' })
    expect(actor.getSnapshot().context.zonesVisible).toBe(false)
  })
})

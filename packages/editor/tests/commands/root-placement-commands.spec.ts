import { describe, expect, it } from 'vitest'
import { transaction, runCommand } from '../../src/app/commands/facade'
import { createEmptyEditorScene } from '../../src/app/scenes/editor-scene'
import { rootPlacementModeForScene } from '../../src/app/commands/root-placement-commands'

describe('root placement commands', () => {
  it('creates a root block and its spanning zone in one document transaction', () => {
    const scene = createEmptyEditorScene()
    const updated = transaction(scene, [
      { name: 'setRootPlacementMode', args: { mode: 'fine-grid' } },
      { name: 'createRootZone', args: { zoneId: 'zone-a', area: { row: 12, col: 21, rowSpan: 8, colSpan: 14 } } },
      { name: 'createItem', args: { geometry: {}, zoneId: 'zone-a' } },
    ])
    const item = updated.items[0]!
    const zone = updated.zones['zone-a']!

    expect(rootPlacementModeForScene(updated)).toBe('fine-grid')
    expect(zone).toEqual({
      id: 'zone-a',
      capsuleId: null,
      name: 'z1',
      surfaces: {
        portrait: { row: 12, col: 21, rowSpan: 8, colSpan: 14 },
        landscape: { row: 12, col: 21, rowSpan: 8, colSpan: 14 },
      },
    })
    expect(item).toMatchObject({ type: 'bloc', contentId: null, parentId: null })
    expect(updated.decors[item.initialDecorId]).toMatchObject({ zoneId: 'zone-a' })
    expect(updated.decors[item.initialDecorId]?.offset).toEqual({})
  })

  it('keeps the root zone parent constraint when creating an item', () => {
    const scene = createEmptyEditorScene()
    const fineGridScene = runCommand(scene, { name: 'setRootPlacementMode', args: { mode: 'fine-grid' } })
    const zonedScene = runCommand(fineGridScene, {
      name: 'createRootZone',
      args: { zoneId: 'zone-root', area: { row: 1, col: 1, rowSpan: 1, colSpan: 1 } },
    })

    expect(() => runCommand(zonedScene, {
      name: 'createItem',
      args: { geometry: {}, parentId: 'nested-capsule', zoneId: 'zone-root' },
    })).toThrow(/does not belong to the item's parent capsule/)
  })

  it('does not reinterpret root zone spans as a one-cell layout', () => {
    const scene = createEmptyEditorScene()
    const fineGridScene = runCommand(scene, { name: 'setRootPlacementMode', args: { mode: 'fine-grid' } })
    const zonedScene = runCommand(fineGridScene, {
      name: 'createRootZone',
      args: { zoneId: 'zone-root', area: { row: 1, col: 1, rowSpan: 2, colSpan: 2 } },
    })

    expect(() => runCommand(zonedScene, { name: 'setRootPlacementMode', args: { mode: 'transform' } }))
      .toThrow(/root zones must be removed/)
  })

  it('rejects a root zone area outside the 90 × 160 grid', () => {
    const scene = createEmptyEditorScene()
    const fineGridScene = runCommand(scene, { name: 'setRootPlacementMode', args: { mode: 'fine-grid' } })

    expect(() => runCommand(fineGridScene, {
      name: 'createRootZone',
      args: { zoneId: 'zone-overflow', area: { row: 90, col: 160, rowSpan: 2, colSpan: 2 } },
    })).toThrow(/fit inside the 90 × 160 root grid/)
  })
})

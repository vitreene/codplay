import { describe, expect, it } from 'vitest'
import { runCommand, runCommandWithResult, transaction } from '../../src/app/commands/facade'
import type { EditorScene } from '../../src/app/commands/types'
import type { Command } from '../../src/app/controller/types'

function emptyScene(): EditorScene {
  return {
    id: 'scene-1',
    meta: {
      title: 'Test scene',
      durationMs: 5000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items: [],
    contents: {},
    decors: {},
    zones: {},
  }
}

describe('runCommand', () => {
  it('dispatches createItem by name and returns the resulting document', () => {
    const command: Command = { name: 'createItem', args: { geometry: {} } }
    const next = runCommand(emptyScene(), command)
    expect(next.items).toHaveLength(1)
  })

  it('dispatches setDecor by name', () => {
    const created = runCommandWithResult(emptyScene(), { name: 'createItem', args: { geometry: {} } })
    const itemId = created.itemId as string
    const item = created.scene.items[0]!

    const next = runCommand(created.scene, {
      name: 'setDecor',
      args: { decorId: item.initialDecorId, patch: { style: { color: 'blue' } } },
    })
    expect(next.decors[item.initialDecorId]?.style).toEqual({ color: 'blue' })
  })
})

describe('runCommandWithResult', () => {
  it('surfaces the created itemId alongside the document for createItem', () => {
    const result = runCommandWithResult(emptyScene(), { name: 'createItem', args: { geometry: {} } })
    expect(typeof result.itemId).toBe('string')
    expect(result.scene.items).toHaveLength(1)
  })
})

describe('transaction (facade)', () => {
  it('runs a sequence of named commands as one resulting document — the macro pattern (lot→carousel…)', () => {
    const createFirst = runCommandWithResult(emptyScene(), { name: 'createItem', args: { geometry: {} } })
    const firstItemId = createFirst.itemId as string

    const next = transaction(createFirst.scene, [
      { name: 'assignType', args: { itemId: firstItemId, type: 'text' } },
      { name: 'createItem', args: { geometry: {} } },
    ])

    expect(next.items).toHaveLength(2)
    expect(next.items.find((i) => i.id === firstItemId)?.type).toBe('text')
  })
})

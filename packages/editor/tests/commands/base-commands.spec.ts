import { describe, expect, it } from 'vitest'
import * as commands from '../../src/app/commands/base-commands'
import type { EditorScene } from '../../src/app/commands/types'
import { createId } from '../../src/app/commands/ids'
import { createNamedKeyframe } from '../../src/sequence-editor/commands'

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
    markerTracks: {},
  }
}

describe('createItem', () => {
  it('creates a bloc item with a derived initial decor, attached at scene root by default', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: { width: 100, height: 50 } })

    const item = scene.items.find((i) => i.id === itemId)!
    expect(item.type).toBe('bloc')
    expect(item.parentId).toBeNull()
    expect(item.contentId).toBeNull()
    expect(scene.decors[item.initialDecorId]?.offset).toEqual({ width: 100, height: 50 })
  })

  it('attaches the item under the given parent and orders it after existing siblings', () => {
    const first = commands.createItem(emptyScene(), { geometry: {}, parentId: 'capsule-1' })
    const second = commands.createItem(first.scene, { geometry: {}, parentId: 'capsule-1' })

    const firstItem = second.scene.items.find((i) => i.id === first.itemId)!
    const secondItem = second.scene.items.find((i) => i.id === second.itemId)!
    expect(firstItem.parentId).toBe('capsule-1')
    expect(secondItem.parentId).toBe('capsule-1')
    expect(secondItem.order > firstItem.order).toBe(true)
  })

  it('generates item, decor, content, and keyframe IDs that do not collide with restored document IDs', () => {
    const restored: EditorScene = {
      ...emptyScene(),
      items: [{
        id: 'item-1',
        type: 'text',
        parentId: null,
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-2',
        keyframes: [{ id: 'kf-4', timeMs: 1000, decorId: 'decor-2' }],
      }],
      contents: { 'content-3': { id: 'content-3', type: 'text', text: 'Restauré' } },
      decors: { 'decor-2': { id: 'decor-2' } },
    }

    const created = commands.createItem(restored, { geometry: {} })
    const typed = commands.assignType(created.scene, { itemId: created.itemId, type: 'text' })
    const withContent = commands.assignContent(typed, { itemId: created.itemId, content: { type: 'text', text: 'Nouveau' } })
    // Keyframe and decor ids come from the single `createId` generator, as every editor caller does.
    const keyframe = { keyframeId: createId('kf'), decorId: createId('decor') }
    const withKeyframe = createNamedKeyframe(withContent, { itemId: 'item-1', timeMs: 2000, ...keyframe })
    const newItem = created.scene.items.find((item) => item.id === created.itemId)!
    const contentId = withContent.items.find((item) => item.id === created.itemId)!.contentId!

    expect(created.itemId).not.toBe('item-1')
    expect(newItem.initialDecorId).not.toBe('decor-2')
    expect(contentId).not.toBe('content-3')
    expect(keyframe.keyframeId).not.toBe('kf-4')
    expect(keyframe.decorId).not.toBe('decor-2')
    expect(withKeyframe.items.find((item) => item.id === 'item-1')!.keyframes.map((kf) => kf.id))
      .toEqual(['kf-4', keyframe.keyframeId])
  })
})

describe('createItem — born at the playhead', () => {
  it('places the intro on the initial decor at the given time and leaves the outro automatic', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {}, introTimeMs: 2000 })
    const item = scene.items.find((candidate) => candidate.id === itemId)!
    expect(item.keyframes).toEqual([
      { id: expect.stringMatching(/^kf-/), timeMs: 2000, decorId: item.initialDecorId, channel: 'pose' },
    ])
  })

  it('keeps the intro inside the scene duration', () => {
    const durationMs = emptyScene().meta.durationMs
    const late = commands.createItem(emptyScene(), { geometry: {}, introTimeMs: durationMs + 900 })
    const early = commands.createItem(emptyScene(), { geometry: {}, introTimeMs: -50 })
    expect(late.scene.items[0]!.keyframes[0]!.timeMs).toBe(durationMs)
    expect(early.scene.items[0]!.keyframes[0]!.timeMs).toBe(0)
  })

  it('gives a capsule the same birth', () => {
    const { scene, itemId } = commands.createCapsule(emptyScene(), {
      geometry: {}, capsuleDef: { kind: 'carousel', distribution: { mode: 'sequential' } }, introTimeMs: 1500,
    })
    expect(scene.items.find((candidate) => candidate.id === itemId)!.keyframes.map((keyframe) => keyframe.timeMs)).toEqual([1500])
  })

  it('creates no keyframe when no time is given', () => {
    expect(commands.createItem(emptyScene(), { geometry: {} }).scene.items[0]!.keyframes).toEqual([])
  })
})

describe('assignType', () => {
  it('differentiates a bloc into a concrete type', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.assignType(scene, { itemId, type: 'text' })
    expect(next.items.find((i) => i.id === itemId)?.type).toBe('text')
  })

  it('keeps the creation geometry when the type preset supplies a default width', () => {
    const geometry = { translate: { x: 20, y: 35 }, width: 60, height: 18 }
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry })

    const next = commands.assignType(scene, { itemId, type: 'text' })
    const item = next.items.find((candidate) => candidate.id === itemId)!

    expect(next.decors[item.initialDecorId]?.offset).toEqual(geometry)
  })

  it('rejects re-typing an item that is no longer a bloc', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const typed = commands.assignType(scene, { itemId, type: 'text' })
    expect(() => commands.assignType(typed, { itemId, type: 'image' })).toThrow()
  })

  // `specs/item-presentation-spec.md` — le preset se pose une seule fois, bundlé
  // dans `assignType`, jamais une commande séparée que l'appelant devrait penser à enchaîner.
  it('applies the type default preset to initialDecorId, bundled in the same command', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.assignType(scene, { itemId, type: 'text' })
    const item = next.items.find((i) => i.id === itemId)!
    const decor = next.decors[item.initialDecorId]
    expect(decor?.style?.['background-color']).toBe('oklch(0.45 0.12 235)')
    expect(decor?.style?.['border-style']).toBe('solid')
    expect(decor?.style?.['text-align']).toBe('center')
    expect(decor?.offset?.width).toBe(80)
  })

  it('leaves initialDecorId untouched for a type with no preset entry', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.assignType(scene, { itemId, type: 'image' })
    const item = next.items.find((i) => i.id === itemId)!
    expect(next.decors[item.initialDecorId]).toEqual({ id: item.initialDecorId })
  })
})

describe('assignContent', () => {
  it('creates a content entry and links it to the item', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const typed = commands.assignType(scene, { itemId, type: 'text' })
    const next = commands.assignContent(typed, { itemId, content: { type: 'text', text: 'Bonjour' } })

    const item = next.items.find((i) => i.id === itemId)!
    expect(item.contentId).not.toBeNull()
    expect(next.contents[item.contentId!]?.text).toBe('Bonjour')
  })
})

describe('attachItem', () => {
  it('changes parent and computes a fresh order key when none is given', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.attachItem(created.scene, { itemId: created.itemId, parentId: 'capsule-2' })
    expect(next.items.find((i) => i.id === created.itemId)?.parentId).toBe('capsule-2')
  })

  it('inserts between adjacent siblings without changing their order keys', () => {
    const source = commands.createItem(emptyScene(), { geometry: {} })
    const first = commands.createItem(source.scene, { geometry: {} })
    const second = commands.createItem(first.scene, { geometry: {} })
    const firstOrder = first.scene.items.find((item) => item.id === first.itemId)?.order
    const secondOrder = second.scene.items.find((item) => item.id === second.itemId)?.order
    const next = commands.attachItem(second.scene, {
      itemId: source.itemId,
      parentId: null,
      afterItemId: first.itemId,
      beforeItemId: second.itemId,
    })

    const ordered = [...next.items].sort((left, right) => left.order.localeCompare(right.order))
    expect(ordered.map((item) => item.id)).toEqual([first.itemId, source.itemId, second.itemId])
    expect(next.items.find((item) => item.id === first.itemId)?.order).toBe(firstOrder)
    expect(next.items.find((item) => item.id === second.itemId)?.order).toBe(secondOrder)
  })

  it('chooses a unique key when adjacent sibling keys share a prefix', () => {
    const scene = {
      ...emptyScene(),
      items: ['back', 'front', 'moving'].map((id, index) => ({
        id,
        type: 'text' as const,
        parentId: null,
        order: ['mmo', 'mmom', 'mmp'][index]!,
        visible: true,
        contentId: null,
        initialDecorId: `decor-${id}`,
        keyframes: [],
      })),
    }
    const next = commands.attachItem(scene, {
      itemId: 'moving',
      parentId: null,
      afterItemId: 'back',
      beforeItemId: 'front',
    })
    const orders = next.items.map((item) => item.order)

    expect(orders).toContain('mmog')
    expect(new Set(orders).size).toBe(orders.length)
    expect([...next.items].sort((left, right) => left.order.localeCompare(right.order)).map((item) => item.id))
      .toEqual(['back', 'moving', 'front'])
  })

  it('rejects a parent change that would create a capsule cycle', () => {
    const capsuleDef = { kind: 'rangee' as const, distribution: { mode: 'sequential' as const } }
    const outer = commands.createCapsule(emptyScene(), { geometry: {}, capsuleDef })
    const inner = commands.createCapsule(outer.scene, { geometry: {}, capsuleDef, parentId: outer.itemId })

    expect(() => commands.attachItem(inner.scene, {
      itemId: outer.itemId,
      parentId: inner.itemId,
    })).toThrow(/descendants/)
  })

  it('rebalances a sibling set when an insertion reaches an order-key boundary', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const target = commands.createItem(created.scene, { geometry: {} })
    const boundaryScene = {
      ...target.scene,
      items: target.scene.items.map((item) => item.id === target.itemId ? { ...item, order: 'aaa' } : item),
    }
    const next = commands.attachItem(boundaryScene, {
      itemId: created.itemId,
      parentId: null,
      beforeItemId: target.itemId,
    })

    const ordered = [...next.items].sort((left, right) => left.order.localeCompare(right.order))
    expect(ordered.map((item) => item.id)).toEqual([created.itemId, target.itemId])
    expect(ordered.every((item) => item.order !== 'aaa')).toBe(true)
  })
})

describe('setDecor', () => {
  it('merges a patch onto an existing decor without dropping other fields', () => {
    const created = commands.createItem(emptyScene(), { geometry: { width: 10 } })
    const item = created.scene.items[0]!
    const next = commands.setDecor(created.scene, { decorId: item.initialDecorId, patch: { style: { color: 'red' } } })

    const decor = next.decors[item.initialDecorId]!
    expect(decor.style).toEqual({ color: 'red' })
    expect(decor.offset).toEqual({ width: 10 })
  })

  it('throws for an unknown decor id', () => {
    expect(() => commands.setDecor(emptyScene(), { decorId: 'missing', patch: {} })).toThrow()
  })
})

describe('setDecor and keyframes', () => {
  it('never fires implicitly from setDecor — it is the only volitional act that creates a keyframe', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const item = created.scene.items[0]!
    const afterSetDecor = commands.setDecor(created.scene, { decorId: item.initialDecorId, patch: { style: {} } })
    expect(afterSetDecor.items[0]!.keyframes).toHaveLength(0)
  })
})

describe('createCapsule', () => {
  it('creates an item typed capsule with its CapsuleDef attached', () => {
    const capsuleDef = { kind: 'carousel' as const, distribution: { mode: 'sequential' as const } }
    const { scene, itemId } = commands.createCapsule(emptyScene(), { geometry: {}, capsuleDef })

    const item = scene.items.find((i) => i.id === itemId)!
    expect(item.type).toBe('capsule')
    expect(item.capsule).toEqual(capsuleDef)
  })
})

describe('setCapsuleDef', () => {
  it('patches an existing CapsuleDef', () => {
    const capsuleDef = { kind: 'carousel' as const, distribution: { mode: 'sequential' as const } }
    const created = commands.createCapsule(emptyScene(), { geometry: {}, capsuleDef })
    const next = commands.setCapsuleDef(created.scene, { itemId: created.itemId, patch: { behavior: 'loop' } })
    expect(next.items.find((i) => i.id === created.itemId)?.capsule?.behavior).toBe('loop')
  })

  it('throws when the target item has no CapsuleDef', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    expect(() => commands.setCapsuleDef(created.scene, { itemId: created.itemId, patch: {} })).toThrow()
  })
})

describe('deleteItem', () => {
  it('removes the item and its own decor/content, leaving unrelated data untouched', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const typed = commands.assignType(created.scene, { itemId: created.itemId, type: 'text' })
    const withContent = commands.assignContent(typed, { itemId: created.itemId, content: { type: 'text', text: 'x' } })

    const next = commands.deleteItem(withContent, { itemId: created.itemId })
    expect(next.items).toHaveLength(0)
    expect(Object.keys(next.decors)).toHaveLength(0)
    expect(Object.keys(next.contents)).toHaveLength(0)
  })

  it('removes descendants when deleting a capsule', () => {
    const capsuleDef = { kind: 'carousel' as const, distribution: { mode: 'sequential' as const } }
    const capsule = commands.createCapsule(emptyScene(), { geometry: {}, capsuleDef })
    const child = commands.createItem(capsule.scene, { geometry: {}, parentId: capsule.itemId })

    const next = commands.deleteItem(child.scene, { itemId: capsule.itemId })
    expect(next.items).toHaveLength(0)
  })

  it('leaves siblings and their data untouched', () => {
    const a = commands.createItem(emptyScene(), { geometry: {} })
    const b = commands.createItem(a.scene, { geometry: {} })

    const next = commands.deleteItem(b.scene, { itemId: a.itemId })
    expect(next.items).toHaveLength(1)
    expect(next.items[0]!.id).toBe(b.itemId)
    expect(Object.keys(next.decors)).toHaveLength(1)
  })

  it('preserves a decor shared by a remaining sibling keyframe', () => {
    const removed = commands.createItem(emptyScene(), { geometry: {} })
    const kept = commands.createItem(removed.scene, { geometry: {} })
    const sharedDecorId = removed.scene.items.find((item) => item.id === removed.itemId)!.initialDecorId
    const withSharedKeyframe = {
      ...kept.scene,
      items: kept.scene.items.map((item) => item.id === kept.itemId
        ? { ...item, keyframes: [{ id: 'kept-kf', timeMs: 0, decorId: sharedDecorId }] }
        : item),
    }

    const next = commands.deleteItem(withSharedKeyframe, { itemId: removed.itemId })
    expect(next.items).toHaveLength(1)
    expect(next.decors[sharedDecorId]).toBeDefined()
  })

  it('preserves a decor still referenced by the scene root', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const item = created.scene.items.find((candidate) => candidate.id === created.itemId)!
    const rooted = { ...created.scene, rootDecorId: item.initialDecorId }
    const next = commands.deleteItem(rooted, { itemId: created.itemId })
    expect(next.decors[item.initialDecorId]).toBeDefined()
    expect(next.rootDecorId).toBe(item.initialDecorId)
  })

  it('preserves content shared by a remaining item', () => {
    const removed = commands.createItem(emptyScene(), { geometry: {} })
    const kept = commands.createItem(removed.scene, { geometry: {} })
    const sharedContentId = 'shared-content'
    const withSharedContent = {
      ...kept.scene,
      contents: { [sharedContentId]: { id: sharedContentId, type: 'text' as const, text: 'shared' } },
      items: kept.scene.items.map((item) => ({ ...item, contentId: sharedContentId })),
    }

    const next = commands.deleteItem(withSharedContent, { itemId: removed.itemId })
    expect(next.items).toHaveLength(1)
    expect(next.contents[sharedContentId]).toEqual({ id: sharedContentId, type: 'text', text: 'shared' })
  })
})

describe('transaction', () => {
  it('applies N mutations in sequence, each step seeing the previous one’s result', () => {
    let firstItemId = ''
    const next = commands.transaction(emptyScene(), [
      (s) => {
        const created = commands.createItem(s, { geometry: {} })
        firstItemId = created.itemId
        return created.scene
      },
      (s) => commands.assignType(s, { itemId: firstItemId, type: 'text' }),
      (s) => commands.createItem(s, { geometry: {} }).scene,
    ])

    expect(next.items).toHaveLength(2)
    expect(next.items.find((i) => i.id === firstItemId)?.type).toBe('text')
  })
})

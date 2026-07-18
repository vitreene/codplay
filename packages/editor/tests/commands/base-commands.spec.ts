import { describe, expect, it } from 'vitest'
import * as commands from '../../src/app/commands/base-commands'
import type { EditorScene } from '../../src/app/commands/types'

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
})

describe('assignType', () => {
  it('differentiates a bloc into a concrete type', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.assignType(scene, { itemId, type: 'text' })
    expect(next.items.find((i) => i.id === itemId)?.type).toBe('text')
  })

  it('rejects re-typing an item that is no longer a bloc', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const typed = commands.assignType(scene, { itemId, type: 'text' })
    expect(() => commands.assignType(typed, { itemId, type: 'image' })).toThrow()
  })

  // `2026-07-17-decor-keyframe-layering-plan.md` §2 — le preset se pose une seule fois, bundlé
  // dans `assignType`, jamais une commande séparée que l'appelant devrait penser à enchaîner.
  it('applies the type default preset to initialDecorId, bundled in the same command', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.assignType(scene, { itemId, type: 'text' })
    const item = next.items.find((i) => i.id === itemId)!
    const decor = next.decors[item.initialDecorId]
    expect(decor?.style?.['background-color']).toBe('oklch(0.45 0.12 235)')
    expect(decor?.style?.['text-align']).toBe('center')
    expect(decor?.offset?.width).toBe(80)
  })

  it('leaves initialDecorId untouched for a type with no preset entry', () => {
    const { scene, itemId } = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.assignType(scene, { itemId, type: 'image' })
    const item = next.items.find((i) => i.id === itemId)!
    expect(next.decors[item.initialDecorId]).toEqual({ id: item.initialDecorId, offset: {} })
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

describe('createKeyframe', () => {
  it('never fires implicitly from setDecor — it is the only volitional act that creates a keyframe', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const item = created.scene.items[0]!
    const afterSetDecor = commands.setDecor(created.scene, { decorId: item.initialDecorId, patch: { style: {} } })
    expect(afterSetDecor.items[0]!.keyframes).toHaveLength(0)
  })

  it('creates a keyframe with a fresh decor when none is given', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const { scene, keyframeId, decorId } = commands.createKeyframe(created.scene, { itemId: created.itemId, timeMs: 1000 })

    const item = scene.items.find((i) => i.id === created.itemId)!
    expect(item.keyframes).toHaveLength(1)
    expect(item.keyframes[0]!.id).toBe(keyframeId)
    expect(scene.decors[decorId]).toBeDefined()
  })

  it('rejects a decorId that does not exist yet', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    expect(() => commands.createKeyframe(created.scene, { itemId: created.itemId, timeMs: 0, decorId: 'missing' })).toThrow()
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

describe('placeInZone', () => {
  it('assigns a zone id onto the item initial decor', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const next = commands.placeInZone(created.scene, { itemId: created.itemId, zoneId: 'zone-1' })
    const item = next.items.find((i) => i.id === created.itemId)!
    expect(next.decors[item.initialDecorId]?.zoneId).toBe('zone-1')
  })

  it('clears the zone id when given null', () => {
    const created = commands.createItem(emptyScene(), { geometry: {} })
    const placed = commands.placeInZone(created.scene, { itemId: created.itemId, zoneId: 'zone-1' })
    const cleared = commands.placeInZone(placed, { itemId: created.itemId, zoneId: null })
    const item = cleared.items.find((i) => i.id === created.itemId)!
    expect(cleared.decors[item.initialDecorId]?.zoneId).toBeNull()
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

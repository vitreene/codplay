import { describe, expect, it } from 'vitest'
import { findParentClipBounds, getParentClipMarkers } from '../../src/sequence-editor/utils'
import type { EditorScene, Item } from '../../src/sequence-editor/types'

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    type: 'text',
    label: id,
    parentId: null,
    order: 'a',
    visible: true,
    contentId: null,
    initialDecorId: 'decor-init',
    keyframes: [],
    ...overrides,
  }
}

function scene(items: Item[]): EditorScene {
  return {
    id: 'visibility-boundaries',
    meta: { title: 'Visibility boundaries', durationMs: 5000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items,
    contents: {},
    decors: {},
    zones: {},
    markerTracks: {},
  }
}

describe('sequence-editor — V2 visibility boundaries', () => {
  it('uses the earliest/latest capsule keyframes without requiring intro/outro names', () => {
    const capsule = item('capsule', {
      type: 'capsule',
      keyframes: [
        { id: 'last', timeMs: 4000, decorId: 'decor-init' },
        { id: 'first', timeMs: 1000, decorId: 'decor-init' },
      ],
    })
    const child = item('child', { parentId: 'capsule' })
    const document = scene([capsule, child])

    expect(findParentClipBounds('child', document.items, document.meta.durationMs)).toEqual({ minMs: 1000, maxMs: 4000 })
    expect(getParentClipMarkers('child', document.items)).toEqual({ introMs: 1000, outroMs: 4000 })
  })
})

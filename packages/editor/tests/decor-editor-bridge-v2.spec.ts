import { describe, expect, it } from 'vitest'
import type { CodPlaySnapshot } from 'codplay'
import { resolveKeyframeAlignment, resolveTemporaryPatch } from '../src/app/bridges/decor-editor-bridge'
import type { Item } from '../src/app/commands/types'

function snapshotFor(style: Record<string, unknown>): CodPlaySnapshot {
  return {
    states: [{ target: { storyId: 'story-main', persoId: 'item-1' }, state: { style } }],
  } as CodPlaySnapshot
}

const item: Item = {
  id: 'item-1',
  type: 'text',
  parentId: null,
  order: 'a',
  visible: true,
  contentId: null,
  initialDecorId: 'decor-0',
  keyframes: [
    { id: 'kf-a', timeMs: 0, decorId: 'decor-a' },
    { id: 'kf-b', timeMs: 1000, decorId: 'decor-b' },
  ],
}

describe('decor-editor bridge V2', () => {
  it('résout la position temporelle sans dépendre d’un node player', () => {
    expect(resolveKeyframeAlignment(item, 500)).toEqual({ kind: 'between', prevKeyframeId: 'kf-a', nextKeyframeId: 'kf-b' })
    expect(resolveKeyframeAlignment(item, 1000)).toEqual({ kind: 'exact', keyframeId: 'kf-b' })
  })

  it('lit le style temporaire depuis le snapshot logique', () => {
    const patch = resolveTemporaryPatch(snapshotFor({
      color: { kind: 'color', space: 'srgb', coords: [1, 0, 0], alpha: 1 },
      opacity: 0.5,
    }), 'item-1', [
      { path: 'style.color', kind: 'color', label: 'Texte' },
      { path: 'style.opacity', kind: 'number', label: 'Opacité' },
    ])
    expect(patch).toEqual({ style: { color: 'rgba(255, 0, 0, 1)', opacity: '0.5' } })
  })

  it('ignore une autre cible dans le snapshot', () => {
    expect(resolveTemporaryPatch(snapshotFor({ color: 'red' }), 'other-item', [
      { path: 'style.color', kind: 'color', label: 'Texte' },
    ])).toEqual({})
  })
})

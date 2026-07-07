import { describe, it, expect } from 'vitest'
import { panelsForType, panelsForTypes, findPanel } from '../src/decor-editor/palette-panel'
import type { PaletteConfig } from '../src/decor-editor/palette-panel'

function config(): PaletteConfig {
  return {
    panels: [
      { id: 'shape', label: 'Forme', fields: [{ path: 'style.background-color', kind: 'color', label: 'Fond' }] },
      { id: 'typo', label: 'Typo', fields: [{ path: 'style.font-size', kind: 'number', label: 'Taille' }] },
      { id: 'dimensions', label: 'Dimensions', fields: [{ path: 'style.width', kind: 'number', label: 'Largeur' }] },
      { id: 'custom', label: 'Custom', kind: 'custom-code' },
    ],
    panelsByItemType: {
      text: ['shape', 'typo', 'dimensions', 'custom'],
      image: ['shape', 'dimensions', 'custom'],
      media: ['shape', 'dimensions', 'custom'],
      video: ['shape', 'dimensions', 'custom'],
      capsule: ['shape', 'dimensions', 'custom'],
    },
  }
}

describe('panelsForType', () => {
  it('un item texte voit le panneau typo', () => {
    expect(panelsForType('text', config())).toContain('typo')
  })

  it('un item media ne voit pas le panneau typo', () => {
    expect(panelsForType('media', config())).not.toContain('typo')
  })

  it('type inconnu dans une config personnalisée → tableau vide', () => {
    const custom: PaletteConfig = { panels: [], panelsByItemType: {} as never }
    expect(panelsForType('text', custom)).toEqual([])
  })
})

describe('panelsForTypes — intersection (spec §7 bis, multi-sélection)', () => {
  it('un seul type → mêmes panneaux que panelsForType', () => {
    expect(panelsForTypes(['text'], config())).toEqual(panelsForType('text', config()))
  })

  it('text + media → intersection, jamais typo (absent de media)', () => {
    const result = panelsForTypes(['text', 'media'], config())
    expect(result).not.toContain('typo')
    expect(result).toContain('shape')
    expect(result).toContain('dimensions')
  })

  it('tableau vide → tableau vide', () => {
    expect(panelsForTypes([], config())).toEqual([])
  })

  it('mêmes types répétés → équivalent à un seul type', () => {
    expect(panelsForTypes(['text', 'text'], config())).toEqual(panelsForType('text', config()))
  })
})

describe('findPanel', () => {
  it('retrouve un panneau par id', () => {
    const found = findPanel(config(), 'shape')
    expect(found?.label).toBe('Forme')
  })

  it('undefined si l\'id est inconnu', () => {
    expect(findPanel(config(), 'does-not-exist')).toBeUndefined()
  })

  it('un panneau custom-code n\'a pas de fields', () => {
    const found = findPanel(config(), 'custom')
    expect(found).toEqual({ id: 'custom', label: 'Custom', kind: 'custom-code' })
  })

  it('un panneau régulier porte des fields qui référencent des propriétés CSS de la carte ouverte style', () => {
    const cfg: PaletteConfig = {
      panels: [{
        id: 'shape',
        label: 'Forme',
        fields: [
          { path: 'style.background-color', kind: 'color', label: 'Fond' },
          { path: 'style.border-width', kind: 'number', label: 'Épaisseur' },
          { path: 'style.padding', kind: 'number', label: 'Padding' },
        ],
      }],
      panelsByItemType: { text: ['shape'], image: [], media: [], video: [], capsule: [] },
    }
    const shape = findPanel(cfg, 'shape')
    expect(shape?.kind).toBeUndefined()
    if (shape?.kind === undefined) {
      const groups = shape!.fields.map(f => f.path.split('.')[0])
      expect(new Set(groups)).toEqual(new Set(['style']))
    }
  })
})

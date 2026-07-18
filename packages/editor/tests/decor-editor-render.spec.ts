// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createDecorEditorPalette } from '../src/decor-editor/render'
import { DecorEditorController } from '../src/decor-editor/controller'
import type { DecorEditorCatalogs, AttachItemInput } from '../src/decor-editor/controller'
import type { PaletteConfig } from '../src/decor-editor/palette-panel'
import type { ResolvedDecor } from '../src/decor-editor/types'

function paletteConfig(): PaletteConfig {
  return {
    panels: [{ id: 'shape', label: 'Forme', fields: [{ path: 'style.background-color', kind: 'color', label: 'Fond' }] }],
    panelsByItemType: { text: ['shape'], image: ['shape'], media: ['shape'], video: ['shape'], capsule: ['shape'] },
  }
}

function catalogs(): DecorEditorCatalogs {
  return { presets: [], cards: [], palette: paletteConfig() }
}

const DEFAULTS: ResolvedDecor = {}

function attachInput(overrides: Partial<AttachItemInput> = {}): AttachItemInput {
  return { itemId: 'item-1', itemType: 'text', defaults: DEFAULTS, chain: [], patch: {}, zones: [], context: 'horizontal', ...overrides }
}

describe('createDecorEditorPalette — champ couleur, rafraîchissement après perte de focus', () => {
  it('un patch externe reçu pendant que le champ est focus est appliqué au blur (2026-07-17-resolved-state-at-time-notes.md)', () => {
    const ctrl = new DecorEditorController(catalogs())
    const palette = createDecorEditorPalette(ctrl)
    document.body.appendChild(palette.element)
    ctrl.attachItems([attachInput({ patch: { style: { 'background-color': 'oklch(0.6 0.24 25)' } } })])
    palette.render()

    const input = palette.element.querySelector('input[type="color"]') as HTMLInputElement
    expect(input.value.toLowerCase()).toBe('#ee0b2a')

    // Le champ garde le focus (geste utilisateur en cours) pendant qu'un patch externe arrive —
    // ex. le raccourci « aller à kf1 » réattache le même item avec un décor différent.
    input.focus()
    ctrl.attachItems([attachInput({ patch: { style: { 'background-color': 'oklch(0.45 0.12 235)' } } })])
    palette.render()
    // La mise à jour est différée tant que le focus est là (ne pas couper un geste en cours).
    expect(input.value.toLowerCase()).toBe('#ee0b2a')

    input.blur()
    expect(input.value.toLowerCase()).toBe('#005d8d')

    ctrl.destroy()
    palette.element.remove()
  })

  it('sans perte de focus intermédiaire, le champ se met à jour normalement à chaque render', () => {
    const ctrl = new DecorEditorController(catalogs())
    const palette = createDecorEditorPalette(ctrl)
    ctrl.attachItems([attachInput({ patch: { style: { 'background-color': 'oklch(0.6 0.24 25)' } } })])
    palette.render()

    const input = palette.element.querySelector('input[type="color"]') as HTMLInputElement
    expect(input.value.toLowerCase()).toBe('#ee0b2a')

    ctrl.attachItems([attachInput({ patch: { style: { 'background-color': 'oklch(0.45 0.12 235)' } } })])
    palette.render()
    expect(input.value.toLowerCase()).toBe('#005d8d')

    ctrl.destroy()
  })
})

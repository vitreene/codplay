import { describe, expect, it, vi } from 'vitest'
import { DecorEditorController } from '../src/decor-editor/controller'
import type { AttachItemInput, DecorEditorCatalogs } from '../src/decor-editor/controller'
import type { PaletteConfig } from '../src/decor-editor/palette-panel'
import type { ResolvedDecor } from '../src/decor-editor/types'

function paletteConfig(): PaletteConfig {
  return {
    panels: [
      { id: 'shape', label: 'Forme', fields: [{ path: 'style.background-color', kind: 'color', label: 'Fond' }] },
      { id: 'typo', label: 'Typo', fields: [{ path: 'style.font-size', kind: 'number', label: 'Taille' }] },
    ],
    panelsByItemType: {
      text: ['shape', 'typo'],
      image: ['shape'],
      media: ['shape'],
      video: ['shape'],
      capsule: ['shape'],
    },
  }
}

function catalogs(): DecorEditorCatalogs {
  return { presets: [{ name: 'label', patch: { style: { 'font-weight': 'bold' } } }], cards: [], palette: paletteConfig() }
}

function attachInput(overrides: Partial<AttachItemInput> = {}): AttachItemInput {
  return {
    itemId: 'item-1',
    itemType: 'text',
    defaults: {} as ResolvedDecor,
    chain: [],
    patch: {},
    zones: [],
    context: 'horizontal',
    ...overrides,
  }
}

describe('DecorEditorController V2', () => {
  it('reste autonome et expose un état inactif sans item', () => {
    const controller = new DecorEditorController(catalogs())
    expect(controller.getSnapshot().value).toBe('inactive')
    expect(controller.getPatches()).toEqual([])
    controller.destroy()
  })

  it('attache un item et conserve le patch documentaire courant', () => {
    const controller = new DecorEditorController(catalogs())
    controller.attachItems([attachInput({ patch: { offset: { translate: { x: 10, y: 5 }, width: 20, height: 12 } } })])
    expect(controller.getSnapshot().value).toBe('active')
    expect(controller.getPatches()).toEqual([{
      itemId: 'item-1',
      patch: { offset: { translate: { x: 10, y: 5 }, width: 20, height: 12 } },
    }])
    controller.destroy()
  })

  it('fusionne couleur et géométrie dans un seul patch de décor', () => {
    const controller = new DecorEditorController(catalogs())
    controller.attachItems([attachInput({
      patch: { offset: { translate: { x: 10, y: 5 }, width: 20, height: 12 } },
    })])
    const changes = vi.fn()
    controller.onDecorChange(changes)

    controller.applyPatch({
      style: { 'background-color': 'blue' },
      offset: { translate: { x: 30, y: 5 }, width: 30, height: 12 },
    })

    expect(changes).toHaveBeenCalledWith([{
      itemId: 'item-1',
      patch: {
        style: { 'background-color': 'blue' },
        offset: { translate: { x: 30, y: 5 }, width: 30, height: 12 },
      },
    }])
    controller.destroy()
  })

  it('applique le même patch à chaque item d’une sélection groupée', () => {
    const controller = new DecorEditorController(catalogs())
    controller.attachItems([attachInput({ itemId: 'a' }), attachInput({ itemId: 'b' })])
    controller.applyPatch({ style: { 'background-color': 'red' } })
    expect(controller.getPatches()).toEqual([
      { itemId: 'a', patch: { style: { 'background-color': 'red' } } },
      { itemId: 'b', patch: { style: { 'background-color': 'red' } } },
    ])
    controller.destroy()
  })

  it('distingue un décor temporaire de la cible documentaire', () => {
    const controller = new DecorEditorController(catalogs())
    controller.attachItems([attachInput({ isTemporary: true })])
    expect(controller.isTemporary()).toBe(true)
    controller.detach()
    expect(controller.isTemporary()).toBe(false)
    controller.destroy()
  })

  it('émet l’événement de fin d’interaction sans posséder de bridge player', () => {
    const controller = new DecorEditorController(catalogs())
    const onEnd = vi.fn()
    controller.onInteractionEnd(onEnd)
    controller.notifyInteractionEnd()
    expect(onEnd).toHaveBeenCalledOnce()
    controller.destroy()
  })
})

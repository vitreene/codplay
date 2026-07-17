// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DecorEditorController } from '../../src/decor-editor/controller'
import { mountDecorEditor } from '../../src/decor-editor/mount'
import type { SubscribeToNode } from '../../src/decor-editor/mount'
import type { DecorEditorCatalogs } from '../../src/decor-editor/controller'
import type { PaletteConfig } from '../../src/decor-editor/palette-panel'
import type { ResolvedDecor } from '../../src/decor-editor/types'

const PALETTE_CONFIG: PaletteConfig = {
  panels: [
    {
      id: 'shape',
      label: 'Forme',
      fields: [{ path: 'style.background-color', kind: 'color', label: 'Fond' }],
    },
  ],
  panelsByItemType: { text: ['shape'], image: [], media: [], video: [], capsule: [] },
}

function minimalController(): DecorEditorController {
  const catalogs: DecorEditorCatalogs = { presets: [], cards: [], palette: PALETTE_CONFIG }
  const controller = new DecorEditorController(catalogs)
  const defaults: ResolvedDecor = { style: { 'background-color': 'red' }, text: 'hello' }
  controller.attachItems([{
    itemId: 'item-1',
    itemType: 'text',
    defaults,
    chain: [],
    patch: {},
    zones: [],
    context: 'horizontal',
  }])
  return controller
}

/**
 * Émule `subscribeToNode` : un test appelle `emit(itemId, node)` pour simuler l'apparition/
 * disparition du node réel (seek, rebuild). Implémente le contrat « appel immédiat » du vrai
 * `AuthorApi.subscribeToNode` (`v1-author-api-spec.md` §subscribeToNode) : si `emit` a déjà été
 * appelé pour cet `itemId` avant qu'un abonnement n'arrive (cas réel — le node est déjà monté
 * quand `syncNodeSubscriptions()` souscrit pour un item fraîchement attaché), l'abonné reçoit ce
 * node synchronement, pas seulement au prochain `emit` — sans quoi ce fake masquerait la classe
 * de bug qu'il sert justement à détecter (`mount.spec.ts`, « production order » ci-dessous).
 */
function fakeSubscribeToNode(): { subscribeToNode: SubscribeToNode; emit: (itemId: string, node: Element | null) => void } {
  const callbacks = new Map<string, Set<(node: Element | null) => void>>()
  const currentNodeByItemId = new Map<string, Element | null>()
  const subscribeToNode: SubscribeToNode = (itemId, cb) => {
    let set = callbacks.get(itemId)
    if (!set) {
      set = new Set()
      callbacks.set(itemId, set)
    }
    set.add(cb)
    if (currentNodeByItemId.has(itemId)) cb(currentNodeByItemId.get(itemId) ?? null)
    return () => set!.delete(cb)
  }
  const emit = (itemId: string, node: Element | null): void => {
    currentNodeByItemId.set(itemId, node)
    for (const cb of callbacks.get(itemId) ?? []) cb(node)
  }
  return { subscribeToNode, emit }
}

describe('mountDecorEditor', () => {
  let container: HTMLElement
  let controller: DecorEditorController

  afterEach(() => {
    controller?.destroy()
  })

  it('renders the palette in the container', () => {
    container = document.createElement('div')
    controller = minimalController()
    const { subscribeToNode } = fakeSubscribeToNode()

    const handle = mountDecorEditor(container, controller, subscribeToNode, { referenceWidthPx: 600 })

    expect(container.querySelector('.dedit-panel')).not.toBeNull()

    handle.destroy()
  })

  it('applies the resolved decor to the node once subscribeToNode reports it', () => {
    container = document.createElement('div')
    controller = minimalController()
    const { subscribeToNode, emit } = fakeSubscribeToNode()

    const handle = mountDecorEditor(container, controller, subscribeToNode, { referenceWidthPx: 600 })

    const itemEl = document.createElement('div')
    document.body.appendChild(itemEl)
    emit('item-1', itemEl)

    expect(itemEl.style.getPropertyValue('background-color')).toBe('red')
    expect(itemEl.textContent).toBe('hello')

    document.body.removeChild(itemEl)
    handle.destroy()
  })

  it('re-applies the decor when the node is swapped (seek/rebuild)', () => {
    container = document.createElement('div')
    controller = minimalController()
    const { subscribeToNode, emit } = fakeSubscribeToNode()

    const handle = mountDecorEditor(container, controller, subscribeToNode, { referenceWidthPx: 600 })

    const firstEl = document.createElement('div')
    document.body.appendChild(firstEl)
    emit('item-1', firstEl)
    expect(firstEl.style.getPropertyValue('background-color')).toBe('red')

    // Simulate the node disappearing then a fresh one taking its place.
    emit('item-1', null)
    const secondEl = document.createElement('div')
    document.body.appendChild(secondEl)
    emit('item-1', secondEl)

    expect(secondEl.style.getPropertyValue('background-color')).toBe('red')
    expect(secondEl.textContent).toBe('hello')

    document.body.removeChild(firstEl)
    document.body.removeChild(secondEl)
    handle.destroy()
  })

  it('re-applies the decor to the tracked node when the controller patch changes', () => {
    container = document.createElement('div')
    controller = minimalController()
    const { subscribeToNode, emit } = fakeSubscribeToNode()

    const handle = mountDecorEditor(container, controller, subscribeToNode, { referenceWidthPx: 600 })

    const itemEl = document.createElement('div')
    document.body.appendChild(itemEl)
    emit('item-1', itemEl)

    controller.applyPathPatch('style.background-color', 'blue')

    expect(itemEl.style.getPropertyValue('background-color')).toBe('blue')

    document.body.removeChild(itemEl)
    handle.destroy()
  })

  it('previews decor on an item attached AFTER mount (production order — regression, 2026-07-17)', () => {
    // `decor-editor-bridge.ts::ensureMounted()` always constructs `mountDecorEditor` BEFORE
    // `syncSelection()`/`attachItems()` runs for the current selection — `controller.getPatches()`
    // is empty at construction in every real scenario, never populated ahead of time like
    // `minimalController()` (above) does. A node-subscription loop that only runs once at
    // construction (the pre-fix behavior) never sees any subsequently attached item — the live
    // preview stayed inert until the deferred commit's rebuild painted the color from the document
    // instead. `syncNodeSubscriptions()` must re-run on every controller change, not just once.
    container = document.createElement('div')
    const catalogs: DecorEditorCatalogs = { presets: [], cards: [], palette: PALETTE_CONFIG }
    controller = new DecorEditorController(catalogs) // no attachItems yet — mirrors production order
    const { subscribeToNode, emit } = fakeSubscribeToNode()

    const handle = mountDecorEditor(container, controller, subscribeToNode, { referenceWidthPx: 600 })

    const itemEl = document.createElement('div')
    document.body.appendChild(itemEl)
    emit('item-1', itemEl) // node already present when the item gets attached below

    const defaults: ResolvedDecor = { style: { 'background-color': 'red' }, text: 'hello' }
    controller.attachItems([{ itemId: 'item-1', itemType: 'text', defaults, chain: [], patch: {}, zones: [], context: 'horizontal' }])

    expect(itemEl.style.getPropertyValue('background-color')).toBe('red')
    expect(itemEl.textContent).toBe('hello')

    controller.applyPathPatch('style.background-color', 'blue')
    expect(itemEl.style.getPropertyValue('background-color')).toBe('blue')

    document.body.removeChild(itemEl)
    handle.destroy()
  })

  it('destroy() empties the container and stops applying further decor changes', () => {
    container = document.createElement('div')
    controller = minimalController()
    const { subscribeToNode, emit } = fakeSubscribeToNode()

    const handle = mountDecorEditor(container, controller, subscribeToNode, { referenceWidthPx: 600 })

    const itemEl = document.createElement('div')
    document.body.appendChild(itemEl)
    emit('item-1', itemEl)

    handle.destroy()
    expect(container.innerHTML).toBe('')

    controller.applyPathPatch('style.background-color', 'green')
    expect(itemEl.style.getPropertyValue('background-color')).toBe('red')

    document.body.removeChild(itemEl)
  })
})

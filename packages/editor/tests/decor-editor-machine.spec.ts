import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { decorEditorMachine, resolveAttachedDecor } from '../src/decor-editor/machine'
import type { AttachItemEntry } from '../src/decor-editor/machine'
import type { DecorPatch, ResolvedDecor } from '../src/decor-editor/types'

function boot() {
  const actor = createActor(decorEditorMachine, { input: {} })
  actor.start()
  return actor
}

const DEFAULTS: ResolvedDecor = { style: { 'font-size': '10cqw' } }

function entry(overrides: Partial<AttachItemEntry> = {}): AttachItemEntry {
  return {
    itemId: 'item-1',
    itemType: 'text',
    defaults: DEFAULTS,
    chain: [],
    patch: {},
    ...overrides,
  }
}

function attachEvent(overrides: Partial<{ patch: DecorPatch; chain: DecorPatch[] }> = {}) {
  return {
    type: 'ITEMS.ATTACH' as const,
    items: [entry({ patch: overrides.patch ?? {}, chain: overrides.chain ?? [] })],
    zones: [],
    initialPanelId: 'shape',
  }
}

describe('decorEditorMachine — cycle de vie', () => {
  it('démarre inactive, sans item', () => {
    const actor = boot()
    const snap = actor.getSnapshot()
    expect(snap.value).toBe('inactive')
    expect(snap.context.items).toEqual([])
    actor.stop()
  })

  it('ITEMS.ATTACH bascule en active et pose l\'item', () => {
    const actor = boot()
    actor.send(attachEvent())
    const snap = actor.getSnapshot()
    expect(snap.value).toBe('active')
    expect(snap.context.items).toHaveLength(1)
    expect(snap.context.items[0]!.itemId).toBe('item-1')
    actor.stop()
  })

  it('ITEMS.ATTACH avec plusieurs entrées pose tous les items', () => {
    const actor = boot()
    actor.send({
      type: 'ITEMS.ATTACH',
      items: [entry({ itemId: 'a' }), entry({ itemId: 'b', itemType: 'image' })],
      zones: [],
      initialPanelId: 'shape',
    })
    const items = actor.getSnapshot().context.items
    expect(items.map(i => i.itemId)).toEqual(['a', 'b'])
    actor.stop()
  })

  it('ITEMS.ATTACH pose activePanelId depuis initialPanelId et réinitialise visualPosition/zoneMode pour une sélection RÉELLEMENT différente', () => {
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'PANEL.SELECT', panelId: 'transform' })
    actor.send({ type: 'VISUAL_POSITION.TOGGLE', on: true })
    actor.send({
      type: 'ITEMS.ATTACH',
      items: [entry({ itemId: 'item-2' })], // sélection différente (autre itemId)
      zones: [],
      initialPanelId: 'typo',
    })
    const snap = actor.getSnapshot()
    expect(snap.context.activePanelId).toBe('typo')
    expect(snap.context.visualPosition).toBe(false)
    actor.stop()
  })

  it('ITEMS.ATTACH sur la MÊME sélection préserve activePanelId/visualPosition/zoneMode (présentation — réservée à l\'utilisateur)', () => {
    // `decor-editor-bridge.ts::syncSelection` réattache le même item à CHAQUE `sceneCommitted` (pour
    // rafraîchir ses données depuis le document) — pas seulement quand la sélection change. Un
    // re-attach de ce type ne doit jamais écraser la présentation choisie par l'utilisateur.
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'PANEL.SELECT', panelId: 'transform' })
    actor.send({ type: 'VISUAL_POSITION.TOGGLE', on: true })
    actor.send({ ...attachEvent(), initialPanelId: 'typo' }) // même item-1, données rafraîchies
    const snap = actor.getSnapshot()
    expect(snap.context.activePanelId).toBe('transform')
    expect(snap.context.visualPosition).toBe(true)
    actor.stop()
  })

  it('ITEMS.DETACH revient à inactive et vide les items', () => {
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'ITEMS.DETACH' })
    const snap = actor.getSnapshot()
    expect(snap.value).toBe('inactive')
    expect(snap.context.items).toEqual([])
    actor.stop()
  })
})

describe('decorEditorMachine — édition du décor (item unique)', () => {
  it('PATCH.APPLY fusionne dans l\'écart courant', () => {
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'PATCH.APPLY', patch: { style: { 'font-size': '20cqw' } } })
    expect(actor.getSnapshot().context.items[0]!.patch.style).toEqual({ 'font-size': '20cqw' })
    actor.stop()
  })

  it('PATCH.STRIP retire un écart par propriété', () => {
    const actor = boot()
    actor.send(attachEvent({ patch: { style: { 'font-size': '20cqw', 'font-weight': 'bold' } } }))
    actor.send({ type: 'PATCH.STRIP', path: 'style.font-size' })
    expect(actor.getSnapshot().context.items[0]!.patch.style).toEqual({ 'font-weight': 'bold' })
    actor.stop()
  })

  it('PRESET.APPLY fusionne le patch du preset sans écraser le reste', () => {
    const actor = boot()
    actor.send(attachEvent({ patch: { zone: 'header' } }))
    actor.send({ type: 'PRESET.APPLY', patch: { style: { 'font-weight': 'bold' } } })
    const item = actor.getSnapshot().context.items[0]!
    expect(item.patch.style).toEqual({ 'font-weight': 'bold' })
    expect(item.patch.zone).toBe('header')
    actor.stop()
  })

  it('CHAIN.SET révise la chaîne d\'un item ciblé, sans toucher à l\'écart courant ni au panneau actif', () => {
    const actor = boot()
    actor.send(attachEvent({ patch: { style: { 'font-weight': 'bold' } } }))
    actor.send({ type: 'PANEL.SELECT', panelId: 'transform' })
    actor.send({ type: 'CHAIN.SET', itemId: 'item-1', chain: [{ style: { 'font-size': '99cqw' } }] })
    const snap = actor.getSnapshot()
    expect(snap.context.items[0]!.chain).toEqual([{ style: { 'font-size': '99cqw' } }])
    expect(snap.context.items[0]!.patch).toEqual({ style: { 'font-weight': 'bold' } })
    expect(snap.context.activePanelId).toBe('transform') // pas réinitialisé
    actor.stop()
  })

  it('CHAIN.SET ne touche que l\'item ciblé par itemId', () => {
    const actor = boot()
    actor.send({
      type: 'ITEMS.ATTACH',
      items: [entry({ itemId: 'a', chain: [] }), entry({ itemId: 'b', chain: [] })],
      zones: [],
      initialPanelId: 'shape',
    })
    actor.send({ type: 'CHAIN.SET', itemId: 'a', chain: [{ style: { 'font-size': '1cqw' } }] })
    const items = actor.getSnapshot().context.items
    expect(items.find(i => i.itemId === 'a')!.chain).toEqual([{ style: { 'font-size': '1cqw' } }])
    expect(items.find(i => i.itemId === 'b')!.chain).toEqual([])
    actor.stop()
  })
})

describe('decorEditorMachine — édition groupée (plusieurs items)', () => {
  it('PATCH.APPLY applique le même patch à chaque item attaché', () => {
    const actor = boot()
    actor.send({
      type: 'ITEMS.ATTACH',
      items: [entry({ itemId: 'a' }), entry({ itemId: 'b' })],
      zones: [],
      initialPanelId: 'shape',
    })
    actor.send({ type: 'PATCH.APPLY', patch: { style: { color: 'oklch(0.5 0 0)' } } })
    const items = actor.getSnapshot().context.items
    for (const item of items) {
      expect(item.patch.style?.color).toBe('oklch(0.5 0 0)')
    }
    actor.stop()
  })
})

describe('resolveAttachedDecor', () => {
  it('replie défauts ⊕ chaîne ⊕ écart courant', () => {
    const actor = boot()
    actor.send(attachEvent({ chain: [{ style: { 'font-size': '20cqw' } }], patch: { style: { 'font-weight': 'bold' } } }))
    const item = actor.getSnapshot().context.items[0]!
    expect(resolveAttachedDecor(item)).toEqual({ style: { 'font-size': '20cqw', 'font-weight': 'bold' } })
    actor.stop()
  })

  it('replie un écart sur des propriétés CSS quelconques (style = carte ouverte)', () => {
    const actor = boot()
    actor.send(attachEvent({
      chain: [{ style: { 'border-color': 'oklch(0.5 0.1 200)' } }],
      patch: { style: { 'border-width': '2cqw', 'border-radius': '8cqw' } },
    }))
    const item = actor.getSnapshot().context.items[0]!
    expect(resolveAttachedDecor(item).style).toEqual({
      'font-size': '10cqw', // hérité des défauts (DEFAULTS)
      'border-color': 'oklch(0.5 0.1 200)',
      'border-width': '2cqw',
      'border-radius': '8cqw',
    })
    actor.stop()
  })
})

describe('decorEditorMachine — modes et zones', () => {
  it('VISUAL_POSITION.TOGGLE active/désactive le mode position', () => {
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'VISUAL_POSITION.TOGGLE', on: true })
    expect(actor.getSnapshot().context.visualPosition).toBe(true)
    actor.send({ type: 'VISUAL_POSITION.TOGGLE', on: false })
    expect(actor.getSnapshot().context.visualPosition).toBe(false)
    actor.stop()
  })

  it('ZONE_MODE.TOGGLE active/désactive le mode zones', () => {
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'ZONE_MODE.TOGGLE', on: true })
    expect(actor.getSnapshot().context.zoneMode).toBe(true)
    actor.stop()
  })

  it('ZONES.SET met à jour la table de zones', () => {
    const actor = boot()
    actor.send(attachEvent())
    const zones = [{ name: 'header', coords: { x: 0, y: 0, width: 100, height: 20 } }]
    actor.send({ type: 'ZONES.SET', zones })
    expect(actor.getSnapshot().context.zones).toEqual(zones)
    actor.stop()
  })

  it('CONTEXT.SET change le contexte d\'orientation (item attaché requis)', () => {
    const actor = boot()
    actor.send(attachEvent())
    actor.send({ type: 'CONTEXT.SET', context: 'vertical' })
    expect(actor.getSnapshot().context.orientationContext).toBe('vertical')
    actor.stop()
  })

  it('événements d\'édition sans item attaché sont des no-op sûrs', () => {
    const actor = boot()
    actor.send({ type: 'PANEL.SELECT', panelId: 'transform' })
    // PANEL.SELECT n'est géré qu'en 'active' ; en 'inactive' il est ignoré silencieusement
    expect(actor.getSnapshot().value).toBe('inactive')
    expect(actor.getSnapshot().context.activePanelId).toBe('')
    actor.stop()
  })
})

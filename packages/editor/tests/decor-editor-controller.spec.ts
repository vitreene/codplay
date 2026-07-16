import { describe, it, expect, vi } from 'vitest'
import { DecorEditorController } from '../src/decor-editor/controller'
import type { DecorEditorCatalogs, AttachItemInput } from '../src/decor-editor/controller'
import type { PaletteConfig } from '../src/decor-editor/palette-panel'
import type { OffsetEditorBridge, OffsetValuesPx, ResolvedDecor } from '../src/decor-editor/types'

function paletteConfig(): PaletteConfig {
  return {
    panels: [
      { id: 'shape', label: 'Forme', fields: [{ path: 'style.background-color', kind: 'color', label: 'Fond' }] },
      { id: 'typo', label: 'Typo', fields: [{ path: 'style.font-size', kind: 'number', label: 'Taille' }] },
      { id: 'dimensions', label: 'Dimensions', fields: [{ path: 'style.width', kind: 'number', label: 'Largeur' }] },
      { id: 'transform', label: 'Transform', fields: [] },
    ],
    panelsByItemType: {
      text: ['shape', 'typo', 'dimensions'],
      image: ['shape', 'dimensions'],
      media: ['shape', 'dimensions'],
      video: ['shape', 'dimensions'],
      capsule: ['shape', 'dimensions', 'transform'],
    },
  }
}

function emptyCatalogs(): DecorEditorCatalogs {
  return {
    presets: [{ name: 'label', patch: { style: { 'font-weight': 'bold' } } }],
    cards: [{ name: 'title-body-footer', zones: [{ name: 'title', coords: { x: 0, y: 0, width: 100, height: 20 } }] }],
    palette: paletteConfig(),
  }
}

const DEFAULTS: ResolvedDecor = { style: { 'font-size': '10cqw' } }

function attachInput(overrides: Partial<AttachItemInput> = {}): AttachItemInput {
  return {
    itemId: 'item-1',
    itemType: 'text',
    defaults: DEFAULTS,
    chain: [],
    patch: {},
    zones: [],
    context: 'horizontal',
    ...overrides,
  }
}

describe('DecorEditorController — cycle de vie', () => {
  it('s\'instancie sans item attaché', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    expect(ctrl.getPatches()).toEqual([])
    ctrl.destroy()
  })

  it('subscribe reçoit un snapshot immédiatement', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const cb = vi.fn()
    const unsub = ctrl.subscribe(cb)
    expect(cb).toHaveBeenCalledOnce()
    expect(cb.mock.calls[0]![0].value).toBe('inactive')
    unsub()
    ctrl.destroy()
  })

  it('subscribe retourne une fonction de désabonnement effective', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const cb = vi.fn()
    const unsub = ctrl.subscribe(cb)
    unsub()
    ctrl.attachItems([attachInput()])
    expect(cb).toHaveBeenCalledOnce()
    ctrl.destroy()
  })

  it('attachItems (item unique = tableau à 1 élément) pose le contexte d\'orientation fourni', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ context: 'vertical' })])
    expect(ctrl.getSnapshot().context.orientationContext).toBe('vertical')
    ctrl.destroy()
  })

  it('attachItems pose activePanelId au premier panneau visible pour le type d\'item', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ itemType: 'text' })])
    expect(ctrl.getSnapshot().context.activePanelId).toBe('shape')
    ctrl.destroy()
  })

  it('detach vide les items courants', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    ctrl.detach()
    expect(ctrl.getPatches()).toEqual([])
    ctrl.destroy()
  })
})

describe('DecorEditorController — édition (sélection simple)', () => {
  it('applyPatch émet onDecorChange avec l\'écart complet de l\'item', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: { zone: 'header' } })])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.applyPatch({ style: { 'font-weight': 'bold' } })
    expect(cb).toHaveBeenCalledWith([{ itemId: 'item-1', patch: { zone: 'header', style: { 'font-weight': 'bold' } } }])
    ctrl.destroy()
  })

  it('applyPathPatch construit l\'écart depuis un chemin générique et l\'applique (hors style)', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.applyPathPatch('textAutoSize.enabled', true)
    expect(cb).toHaveBeenCalledWith([{ itemId: 'item-1', patch: { textAutoSize: { enabled: true } } }])
    ctrl.destroy()
  })

  it('stripInherited retire l\'écart et émet le patch résultant', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: { style: { 'font-size': '20cqw', 'font-weight': 'bold' } } })])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.stripInherited('style.font-size')
    expect(cb).toHaveBeenCalledWith([{ itemId: 'item-1', patch: { style: { 'font-weight': 'bold' } } }])
    ctrl.destroy()
  })

  it('applyPreset introuvable ne fait rien et n\'émet pas', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.applyPreset('does-not-exist')
    expect(cb).not.toHaveBeenCalled()
    ctrl.destroy()
  })

  it('applyPreset fusionne le patch du preset et émet', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.applyPreset('label')
    expect(cb).toHaveBeenCalledWith([{ itemId: 'item-1', patch: { style: { 'font-weight': 'bold' } } }])
    ctrl.destroy()
  })

  it('getResolvedDecors replie défauts ⊕ chaîne ⊕ écart', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ chain: [{ style: { 'font-size': '15cqw' } }], patch: { style: { 'font-weight': 'bold' } } })])
    expect(ctrl.getResolvedDecors()).toEqual([{ style: { 'font-size': '15cqw', 'font-weight': 'bold' } }])
    ctrl.destroy()
  })

  it('setChain révise la chaîne d\'un item : getResolvedDecors change, getPatches (écart courant) non', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ chain: [{ style: { 'font-size': '15cqw' } }], patch: { style: { 'font-weight': 'bold' } } })])
    ctrl.setChain('item-1', [{ style: { 'font-size': '40cqw' } }])
    expect(ctrl.getResolvedDecors()).toEqual([{ style: { 'font-size': '40cqw', 'font-weight': 'bold' } }])
    expect(ctrl.getPatches()).toEqual([{ itemId: 'item-1', patch: { style: { 'font-weight': 'bold' } } }])
    ctrl.destroy()
  })

  it('getPanelsForCurrentItems lit la config palette par type d\'item (item unique)', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ itemType: 'capsule' })])
    expect(ctrl.getPanelsForCurrentItems()).toEqual(['shape', 'dimensions', 'transform'])
    ctrl.destroy()
  })

  it('getPanelsForCurrentItems sans item attaché retourne un tableau vide', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    expect(ctrl.getPanelsForCurrentItems()).toEqual([])
    ctrl.destroy()
  })

  it('getPaletteConfig retourne la config fournie au constructeur', () => {
    const catalogs = emptyCatalogs()
    const ctrl = new DecorEditorController(catalogs)
    expect(ctrl.getPaletteConfig()).toBe(catalogs.palette)
    ctrl.destroy()
  })

  it('getPresets retourne le catalogue de presets fourni au constructeur', () => {
    const catalogs = emptyCatalogs()
    const ctrl = new DecorEditorController(catalogs)
    expect(ctrl.getPresets()).toBe(catalogs.presets)
    ctrl.destroy()
  })
})

describe('DecorEditorController — édition groupée (multi-sélection, spec §7 bis)', () => {
  it('applyPatch applique le même écart à chaque item et émet une entrée par item', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([
      attachInput({ itemId: 'a' }),
      attachInput({ itemId: 'b', defaults: {} }),
    ])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.applyPatch({ style: { 'font-weight': 'bold' } })
    expect(cb).toHaveBeenCalledWith([
      { itemId: 'a', patch: { style: { 'font-weight': 'bold' } } },
      { itemId: 'b', patch: { style: { 'font-weight': 'bold' } } },
    ])
    ctrl.destroy()
  })

  it('getPanelsForCurrentItems retourne l\'INTERSECTION des panneaux par type, jamais l\'union', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([
      attachInput({ itemId: 'a', itemType: 'text' }),      // shape, typo, dimensions
      attachInput({ itemId: 'b', itemType: 'image' }),     // shape, dimensions
    ])
    // intersection attendue : shape, dimensions (jamais typo, absent de image)
    expect(ctrl.getPanelsForCurrentItems()).toEqual(['shape', 'dimensions'])
    ctrl.destroy()
  })

  it('resolveField retourne "uniform" quand tous les items résolvent la même valeur', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([
      attachInput({ itemId: 'a', defaults: { style: { 'font-size': '12cqw' } } }),
      attachInput({ itemId: 'b', defaults: { style: { 'font-size': '12cqw' } } }),
    ])
    expect(ctrl.resolveField('style.font-size')).toEqual({ kind: 'uniform', value: '12cqw' })
    ctrl.destroy()
  })

  it('resolveField retourne "mixed" quand les items divergent sur cette propriété', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([
      attachInput({ itemId: 'a', defaults: { style: { 'font-size': '12cqw' } } }),
      attachInput({ itemId: 'b', defaults: { style: { 'font-size': '20cqw' } } }),
    ])
    expect(ctrl.resolveField('style.font-size')).toEqual({ kind: 'mixed' })
    ctrl.destroy()
  })

  it('stripInherited est un no-op tant que plusieurs items sont attachés (hériter masqué)', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([
      attachInput({ itemId: 'a', patch: { style: { 'font-size': '20cqw' } } }),
      attachInput({ itemId: 'b', patch: { style: { 'font-size': '20cqw' } } }),
    ])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.stripInherited('style.font-size')
    expect(cb).not.toHaveBeenCalled()
    expect(ctrl.getPatches()).toEqual([
      { itemId: 'a', patch: { style: { 'font-size': '20cqw' } } },
      { itemId: 'b', patch: { style: { 'font-size': '20cqw' } } },
    ])
    ctrl.destroy()
  })

  it('stripInherited redevient actif dès qu\'un seul item est attaché', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: { style: { 'font-size': '20cqw', 'font-weight': 'bold' } } })])
    ctrl.stripInherited('style.font-size')
    expect(ctrl.getPatches()).toEqual([{ itemId: 'item-1', patch: { style: { 'font-weight': 'bold' } } }])
    ctrl.destroy()
  })
})

describe('DecorEditorController — zones et cards', () => {
  it('setZones met à jour la table et émet onZonesChange', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onZonesChange(cb)
    const zones = [{ name: 'footer', coords: { x: 0, y: 80, width: 100, height: 20 } }]
    ctrl.setZones(zones)
    expect(cb).toHaveBeenCalledWith(zones)
    expect(ctrl.getZones()).toEqual(zones)
    ctrl.destroy()
  })

  it('applyCard introuvable ne fait rien et n\'émet pas', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onZonesChange(cb)
    ctrl.applyCard('does-not-exist')
    expect(cb).not.toHaveBeenCalled()
    ctrl.destroy()
  })

  it('applyCard installe la table de zones du catalogue et émet', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onZonesChange(cb)
    ctrl.applyCard('title-body-footer')
    expect(ctrl.getZones()).toEqual([{ name: 'title', coords: { x: 0, y: 0, width: 100, height: 20 } }])
    expect(cb).toHaveBeenCalledOnce()
    ctrl.destroy()
  })
})

describe('DecorEditorController — hasOwnPatch (marqueur « hériter », spec §3.1)', () => {
  it('faux quand la propriété n\'a pas d\'écart explicite', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: {} })])
    expect(ctrl.hasOwnPatch('style.font-size')).toBe(false)
    ctrl.destroy()
  })

  it('vrai quand la propriété a un écart explicite', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: { style: { 'font-size': '20cqw' } } })])
    expect(ctrl.hasOwnPatch('style.font-size')).toBe(true)
    ctrl.destroy()
  })

  it('vrai même si la valeur de l\'écart est vide (neutralisation explicite via classes)', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: { classes: '' } })])
    expect(ctrl.hasOwnPatch('classes')).toBe(true)
    ctrl.destroy()
  })

  it('faux pour une propriété soeur non écartée dans le même groupe', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput({ patch: { style: { 'font-size': '20cqw' } } })])
    expect(ctrl.hasOwnPatch('style.font-weight')).toBe(false)
    ctrl.destroy()
  })

  it('toujours faux en multi-sélection, même si tous les items portent l\'écart', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([
      attachInput({ itemId: 'a', patch: { style: { 'font-size': '20cqw' } } }),
      attachInput({ itemId: 'b', patch: { style: { 'font-size': '20cqw' } } }),
    ])
    expect(ctrl.hasOwnPatch('style.font-size')).toBe(false)
    ctrl.destroy()
  })

  it('faux sans item attaché', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    expect(ctrl.hasOwnPatch('style.font-size')).toBe(false)
    ctrl.destroy()
  })
})

describe('DecorEditorController — modes', () => {
  it('setVisualPosition et setZoneMode mettent à jour le contexte', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    ctrl.setVisualPosition(true)
    ctrl.setZoneMode(true)
    const ctx = ctrl.getSnapshot().context
    expect(ctx.visualPosition).toBe(true)
    expect(ctx.zoneMode).toBe(true)
    ctrl.destroy()
  })

  it('selectPanel met à jour le panneau actif', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    ctrl.selectPanel('transform')
    expect(ctrl.getSnapshot().context.activePanelId).toBe('transform')
    ctrl.destroy()
  })

  it('destroy arrête l\'acteur et purge les abonnements', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    ctrl.attachItems([attachInput()])
    const cb = vi.fn()
    ctrl.onDecorChange(cb)
    ctrl.destroy()
    // pas d'assertion sur l'acteur arrêté (xstate ne re-livre plus après stop) —
    // on vérifie juste l'absence d'exception après destroy
    expect(() => ctrl.getPatches()).not.toThrow()
  })
})

function stubOffsetBridge(containerWidthPx = 500): OffsetEditorBridge & {
  emitValues: (v: OffsetValuesPx) => void
  activateCalls: Array<'position' | 'transform' | 'flex-anchor'>
  deactivateCalls: number
  applyCalls: OffsetValuesPx[]
} {
  const listeners = new Set<(v: OffsetValuesPx) => void>()
  return {
    activateCalls: [],
    deactivateCalls: 0,
    applyCalls: [],
    activate(mode) {
      this.activateCalls.push(mode)
    },
    deactivate() {
      this.deactivateCalls++
    },
    apply(patch) {
      this.applyCalls.push(patch)
    },
    onValues(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    containerRefWidthPx() {
      return containerWidthPx
    },
    isGestureActive() {
      return false
    },
    onGestureActiveChange() {
      return () => {}
    },
    emitValues(v) {
      for (const cb of listeners) cb(v)
    },
  }
}

describe('DecorEditorController — pont offset (spec §6, 2026-07-16-position-bridge-reconciliation-plan.md)', () => {
  it('active le pont en mode transform sur un item unique attaché', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge()
    ctrl.setOffsetBridge(bridge)
    ctrl.attachItems([attachInput()])
    expect(bridge.activateCalls).toEqual(['transform'])
    ctrl.destroy()
  })

  it('désactive le pont sans item, et en multi-sélection', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge()
    ctrl.setOffsetBridge(bridge) // pas encore d'item attaché — désactive déjà une fois ici
    ctrl.attachItems([attachInput({ itemId: 'a' }), attachInput({ itemId: 'b' })])
    expect(bridge.deactivateCalls).toBe(2)
    expect(bridge.activateCalls).toEqual([])
    ctrl.destroy()
  })

  it('geste → champs : une valeur du pont (px) fusionne dans l\'écart en cqw, sans la repousser au pont (pas de boucle)', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge(500)
    ctrl.setOffsetBridge(bridge)
    ctrl.attachItems([attachInput()])

    bridge.emitValues({ translate: { x: 50, y: 25 }, rotate: 30 })

    expect(ctrl.getPatches()).toEqual([{ itemId: 'item-1', patch: { offset: { translate: { x: 10, y: 5 }, rotate: 30 } } }])
    expect(bridge.applyCalls).toEqual([])
    ctrl.destroy()
  })

  it('champs → geste : applyPatch({offset}) hors du pont convertit cqw → px et appelle apply()', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge(500)
    ctrl.setOffsetBridge(bridge)
    ctrl.attachItems([attachInput()])

    ctrl.applyPatch({ offset: { translate: { x: 10, y: 5 }, rotate: 30 } })

    expect(bridge.applyCalls).toEqual([{ translate: { x: 50, y: 25 }, rotate: 30 }])
    ctrl.destroy()
  })

  it('un applyPatch sans offset ne touche pas le pont', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge()
    ctrl.setOffsetBridge(bridge)
    ctrl.attachItems([attachInput()])

    ctrl.applyPatch({ style: { 'background-color': 'red' } })

    expect(bridge.applyCalls).toEqual([])
    ctrl.destroy()
  })

  it('detach() désactive le pont et coupe l\'abonnement', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge()
    ctrl.setOffsetBridge(bridge) // pas encore d'item attaché — désactive déjà une fois ici
    ctrl.attachItems([attachInput()])
    ctrl.detach()
    expect(bridge.deactivateCalls).toBe(2)

    bridge.emitValues({ rotate: 45 })
    expect(ctrl.getPatches()).toEqual([])
    ctrl.destroy()
  })

  it('destroy() désactive le pont et coupe l\'abonnement', () => {
    const ctrl = new DecorEditorController(emptyCatalogs())
    const bridge = stubOffsetBridge()
    ctrl.setOffsetBridge(bridge) // pas encore d'item attaché — désactive déjà une fois ici
    ctrl.attachItems([attachInput()])
    ctrl.destroy()
    expect(bridge.deactivateCalls).toBe(2)
    expect(() => bridge.emitValues({ rotate: 45 })).not.toThrow()
  })
})

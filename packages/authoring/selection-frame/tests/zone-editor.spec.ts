// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { AuthorApi } from '../src/author-api'
import { createZoneEditor } from '../src/zone-editor'
import type { ZoneEditorState } from '../src/zone-model'

/** Same stub pattern as `selection-frame.spec.ts` — controllable node lifecycle per persoId. */
function temp__createAuthorApiStub(): AuthorApi & { emitNode: (persoId: string, node: Element | null) => void } {
  const subscribers = new Map<string, Set<(node: Element | null) => void>>()
  const current = new Map<string, Element | null>()

  return {
    subscribeToNode: (persoId, cb) => {
      let set = subscribers.get(persoId)
      if (set === undefined) {
        set = new Set()
        subscribers.set(persoId, set)
      }
      set.add(cb)
      cb(current.get(persoId) ?? null)
      return () => set!.delete(cb)
    },
    subscribeToPlayerState: (cb) => {
      cb({ isPlaying: false })
      return () => {}
    },
    getPlayerState: () => ({ isPlaying: false }),
    emitNode(persoId, node) {
      current.set(persoId, node)
      for (const cb of subscribers.get(persoId) ?? []) cb(node)
    },
  }
}

function temp__editorRoot(): HTMLElement | null {
  return document.querySelector('[data-zone-editor="capsule-1"]')
}

function stateOf(rows: number, cols: number, zones: ZoneEditorState['zones'] = []): ZoneEditorState {
  return { grid: { rows, cols }, zones }
}

describe('createZoneEditor — accrochage + visibilité', () => {
  it('stays hidden while no container node is present, shows once one appears', () => {
    const authorApi = temp__createAuthorApiStub()
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const root = temp__editorRoot()
    expect(root).not.toBeNull()
    expect(root!.style.display).toBe('none')

    authorApi.emitNode('capsule-1', document.createElement('div'))
    expect(root!.style.display).not.toBe('none')

    handle.destroy()
  })

  it('destroy() removes the editor node and stops reacting to further node changes', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.destroy()
    expect(temp__editorRoot()).toBeNull()

    authorApi.emitNode('capsule-1', document.createElement('div'))
    expect(temp__editorRoot()).toBeNull()
  })
})

describe('createZoneEditor — fond de grille (repeating-linear-gradient, jamais un nœud par cellule)', () => {
  it('renders the grid as a single background element, regardless of track count', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(90, 160),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    // The whole point of the gradient rewrite: one background element, no per-cell/per-macro-cell
    // DOM node exists at any scale — this used to freeze the browser at this exact grid size.
    const background = temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]') as HTMLElement
    expect(background).not.toBeNull()
    expect(background.style.backgroundImage).toContain('repeating-linear-gradient')
    expect(temp__editorRoot()!.querySelectorAll('[data-zone-editor-cell]')).toHaveLength(0)
    expect(temp__editorRoot()!.querySelectorAll('[data-zone-editor-macro-cell]')).toHaveLength(0)

    handle.destroy()
  })

  it('re-renders the background gradient when the grid changes (setGrid)', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const background = temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]') as HTMLElement
    const before = background.style.backgroundImage

    handle.setGrid({ rows: 8, cols: 8 })
    expect(background.style.backgroundImage).not.toBe(before)

    handle.destroy()
  })
})

describe('createZoneEditor — rendu des zones (positionnement en pourcentage, jamais grid-template à pleine résolution)', () => {
  it('renders one node per ZoneDef, positioned via top/left/width/height in percent of the grid', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'titre', row: 1, col: 1, rowSpan: 1, colSpan: 4 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const zoneNode = temp__editorRoot()!.querySelector('[data-zone-editor-zone="titre"]') as HTMLElement
    expect(zoneNode).not.toBeNull()
    expect(zoneNode.style.top).toBe('0%')
    expect(zoneNode.style.left).toBe('0%')
    expect(zoneNode.style.width).toBe('100%')
    expect(zoneNode.style.height).toBe('25%')

    handle.destroy()
  })

  it('a non-origin zone resolves a non-zero top/left, still in percent', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4, [{ name: 'corps', row: 2, col: 2, rowSpan: 2, colSpan: 2 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const zoneNode = temp__editorRoot()!.querySelector('[data-zone-editor-zone="corps"]') as HTMLElement
    expect(zoneNode.style.top).toBe('25%')
    expect(zoneNode.style.left).toBe('25%')
    expect(zoneNode.style.width).toBe('50%')
    expect(zoneNode.style.height).toBe('50%')

    handle.destroy()
  })

  it('never sets grid-template-{rows,columns} on the zones layer at full resolution — the other half of the freeze fix', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(90, 160, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const zonesLayer = temp__editorRoot()!.querySelector('[data-zone-editor-zones]') as HTMLElement
    expect(zonesLayer.style.gridTemplateRows).toBe('')
    expect(zonesLayer.style.gridTemplateColumns).toBe('')

    handle.destroy()
  })

  it('setState replaces the grid + zones and re-renders, calling onZonesChange with the new state', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const changes: ZoneEditorState[] = []
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: (state) => changes.push(state),
      onSelectionChange: () => {},
    })

    const nextState = stateOf(2, 2, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }])
    handle.setState(nextState)

    expect(handle.getState()).toEqual(nextState)
    expect(temp__editorRoot()!.querySelector('[data-zone-editor-zone="a"]')).not.toBeNull()
    expect(changes).toEqual([nextState])

    handle.destroy()
  })
})

describe('createZoneEditor — setPartVisibility', () => {
  it('hides the grid part without hiding the zones part, and vice versa', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(2, 2, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.setPartVisibility('grid', false)
    expect(temp__editorRoot()!.querySelector('[data-zone-editor-grid-background]')).toHaveProperty('style.display', 'none')
    expect(temp__editorRoot()!.querySelector('[data-zone-editor-zones]')).not.toHaveProperty('style.display', 'none')

    handle.destroy()
  })

  it('hides labels independently of the zones themselves — the zone boxes stay visible', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(2, 2, [{ name: 'a', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    handle.setPartVisibility('labels', false)
    expect(temp__editorRoot()!.querySelector('[data-zone-editor-label]')).toHaveProperty('style.display', 'none')
    expect(temp__editorRoot()!.querySelector('[data-zone-editor-zone]')).not.toHaveProperty('style.display', 'none')

    handle.setPartVisibility('labels', true)
    expect(temp__editorRoot()!.querySelector('[data-zone-editor-label]')).not.toHaveProperty('style.display', 'none')

    handle.destroy()
  })
})

describe('createZoneEditor — labels de zone', () => {
  it('every zone gets a visible label showing its own name', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(2, 2, [{ name: 'titre', row: 1, col: 1, rowSpan: 1, colSpan: 1 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    const label = temp__editorRoot()!.querySelector('[data-zone-editor-zone="titre"] > [data-zone-editor-label]')
    expect(label?.textContent).toBe('titre')

    handle.destroy()
  })

  it('a container child gets its own computed-name label, matching what breakContainer would produce', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(1, 6, [{ name: 'z1', row: 1, col: 1, rowSpan: 1, colSpan: 6 }]),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })
    handle.divideZone('z1')

    const childLabels = [...temp__editorRoot()!.querySelectorAll('[data-zone-editor-container-child] > [data-zone-editor-label]')].map((n) => n.textContent)
    expect(childLabels.sort()).toEqual(['z1.1.1', 'z1.1.2'])

    handle.destroy()
  })
})

describe('createZoneEditor — isCellPlacementAvailable', () => {
  it('defaults to true when track geometry cannot be measured (jsdom has no real layout)', () => {
    const authorApi = temp__createAuthorApiStub()
    authorApi.emitNode('capsule-1', document.createElement('div'))
    const handle = createZoneEditor({
      authorApi,
      sceneRoot: document.body,
      containerId: 'capsule-1',
      initialState: stateOf(4, 4),
      onZonesChange: () => {},
      onSelectionChange: () => {},
    })

    expect(handle.isCellPlacementAvailable()).toBe(true)
    handle.destroy()
  })
})

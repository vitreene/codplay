import { describe, it, expect } from 'vitest'
import { orientationFromRatio, coordsForContext, updateZoneCoords } from '../src/decor-editor/zones'
import type { ZoneTable } from '../src/decor-editor/types'

describe('orientationFromRatio', () => {
  it('largeur > hauteur → horizontal', () => {
    expect(orientationFromRatio(1920, 1080)).toBe('horizontal')
  })

  it('largeur < hauteur → vertical', () => {
    expect(orientationFromRatio(1080, 1920)).toBe('vertical')
  })

  it('ratio exactement 1 → horizontal (seuil ≥ 1, spec §3.4)', () => {
    expect(orientationFromRatio(1000, 1000)).toBe('horizontal')
  })
})

describe('coordsForContext', () => {
  it('zone partagée : mêmes coords quel que soit le contexte', () => {
    const zone = { name: 'header', coords: { x: 0, y: 0, width: 100, height: 20 } }
    expect(coordsForContext(zone, 'horizontal')).toEqual(zone.coords)
    expect(coordsForContext(zone, 'vertical')).toEqual(zone.coords)
  })

  it('zone par contexte : renvoie les coords propres au contexte demandé', () => {
    const zone = {
      name: 'header',
      contexts: {
        horizontal: { x: 0, y: 0, width: 100, height: 20 },
        vertical: { x: 0, y: 0, width: 100, height: 40 },
      },
    }
    expect(coordsForContext(zone, 'vertical').height).toBe(40)
  })
})

describe('updateZoneCoords', () => {
  it('bascule une zone partagée en forme explicite quand modifiée dans un contexte', () => {
    const table: ZoneTable = [{ name: 'header', coords: { x: 0, y: 0, width: 100, height: 20 } }]
    const result = updateZoneCoords(table, 'header', 'vertical', { x: 0, y: 0, width: 100, height: 40 })
    const zone = result[0]
    expect(zone).toEqual({
      name: 'header',
      contexts: {
        vertical: { x: 0, y: 0, width: 100, height: 40 },
        horizontal: { x: 0, y: 0, width: 100, height: 20 },
      },
    })
  })

  it('modifie une zone déjà par contexte : ne touche que le contexte ciblé', () => {
    const table: ZoneTable = [{
      name: 'header',
      contexts: {
        horizontal: { x: 0, y: 0, width: 100, height: 20 },
        vertical: { x: 0, y: 0, width: 100, height: 40 },
      },
    }]
    const result = updateZoneCoords(table, 'header', 'horizontal', { x: 5, y: 5, width: 90, height: 25 })
    const zone = result[0] as { contexts: Record<string, unknown> }
    expect(zone.contexts.horizontal).toEqual({ x: 5, y: 5, width: 90, height: 25 })
    expect(zone.contexts.vertical).toEqual({ x: 0, y: 0, width: 100, height: 40 })
  })

  it('laisse les autres zones de la table intactes', () => {
    const table: ZoneTable = [
      { name: 'header', coords: { x: 0, y: 0, width: 100, height: 20 } },
      { name: 'footer', coords: { x: 0, y: 80, width: 100, height: 20 } },
    ]
    const result = updateZoneCoords(table, 'header', 'vertical', { x: 0, y: 0, width: 100, height: 40 })
    expect(result.find(z => z.name === 'footer')).toEqual(table[1])
  })

  it('ne mute pas la table originale', () => {
    const table: ZoneTable = [{ name: 'header', coords: { x: 0, y: 0, width: 100, height: 20 } }]
    updateZoneCoords(table, 'header', 'vertical', { x: 9, y: 9, width: 9, height: 9 })
    expect(table[0]).toEqual({ name: 'header', coords: { x: 0, y: 0, width: 100, height: 20 } })
  })
})

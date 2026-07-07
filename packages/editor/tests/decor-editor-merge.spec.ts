import { describe, it, expect } from 'vitest'
import { mergePatch, resolveDecor } from '../src/decor-editor/merge'
import type { DecorPatch } from '../src/decor-editor/types'

describe('mergePatch', () => {
  it('propriété absente de addition.style → base intacte', () => {
    const base: DecorPatch = { style: { 'font-size': '10cqw' } }
    const result = mergePatch(base, {})
    expect(result.style).toEqual({ 'font-size': '10cqw' })
  })

  it('propriété présente dans addition.style écrase, même si valeur égale à la base', () => {
    const base: DecorPatch = { style: { 'font-size': '10cqw' } }
    const result = mergePatch(base, { style: { 'font-size': '10cqw' } })
    expect(result.style).toEqual({ 'font-size': '10cqw' })
    expect(result).not.toBe(base) // nouvel objet malgré l'égalité de valeur
  })

  it('fusionne des propriétés CSS différentes sans écraser les autres', () => {
    const base: DecorPatch = { style: { 'font-size': '10cqw', 'font-weight': 'bold' } }
    const result = mergePatch(base, { style: { 'font-style': 'italic' } })
    expect(result.style).toEqual({ 'font-size': '10cqw', 'font-weight': 'bold', 'font-style': 'italic' })
  })

  it('style est une carte OUVERTE — aucune propriété CSS nommée en dur, n\'importe quelle clé passe', () => {
    const base: DecorPatch = {}
    const result = mergePatch(base, { style: { 'clip-path': 'circle(50%)', 'z-index': '3' } })
    expect(result.style).toEqual({ 'clip-path': 'circle(50%)', 'z-index': '3' })
  })

  it('position (module distinct, pas du style) fusionne indépendamment', () => {
    const base: DecorPatch = { position: { x: 1, y: 2 } }
    const result = mergePatch(base, { style: { color: 'red' } })
    expect(result.position).toEqual({ x: 1, y: 2 })
  })

  it('textAutoSize (module distinct, pas du style) fusionne indépendamment', () => {
    const base: DecorPatch = {}
    const result = mergePatch(base, { textAutoSize: { enabled: true } })
    expect(result.textAutoSize).toEqual({ enabled: true })
  })

  it('textAutoSize absent de addition → base intacte (hérité)', () => {
    const base: DecorPatch = { textAutoSize: { enabled: true } }
    const result = mergePatch(base, { style: { color: 'red' } })
    expect(result.textAutoSize).toEqual({ enabled: true })
  })

  it('zone: null abandonne toute zone', () => {
    const base: DecorPatch = { zone: 'header' }
    const result = mergePatch(base, { zone: null })
    expect(result.zone).toBeNull()
  })

  it('zone absente de addition reste héritée', () => {
    const base: DecorPatch = { zone: 'header' }
    const result = mergePatch(base, { style: { color: 'red' } })
    expect(result.zone).toBe('header')
  })

  it('custom écrase intégralement (pas de fusion de chaîne)', () => {
    const base: DecorPatch = { custom: 'color: red;' }
    const result = mergePatch(base, { custom: 'color: blue;' })
    expect(result.custom).toBe('color: blue;')
  })

  it('ne mute pas les objets passés en entrée', () => {
    const base: DecorPatch = { style: { 'font-size': '10cqw' } }
    const addition: DecorPatch = { style: { 'font-weight': 'bold' } }
    mergePatch(base, addition)
    expect(base.style).toEqual({ 'font-size': '10cqw' })
    expect(addition.style).toEqual({ 'font-weight': 'bold' })
  })

  describe('classes (modèle codplay ClassNameValue)', () => {
    it('remplacement total via une chaîne', () => {
      const base: DecorPatch = { classes: 'foo bar' }
      const result = mergePatch(base, { classes: 'baz' })
      expect(result.classes).toBe('baz')
    })

    it('add ajoute des tokens sans dupliquer', () => {
      const base: DecorPatch = { classes: 'foo bar' }
      const result = mergePatch(base, { classes: { add: 'bar baz' } })
      expect(result.classes).toBe('foo bar baz')
    })

    it('remove retire des tokens', () => {
      const base: DecorPatch = { classes: 'foo bar baz' }
      const result = mergePatch(base, { classes: { remove: 'bar' } })
      expect(result.classes).toBe('foo baz')
    })

    it('add + remove combinés dans le même patch', () => {
      const base: DecorPatch = { classes: 'foo bar' }
      const result = mergePatch(base, { classes: { add: 'baz', remove: 'foo' } })
      expect(result.classes).toBe('bar baz')
    })

    it('classes absent de la base, add seul → part d\'un ensemble vide', () => {
      const base: DecorPatch = {}
      const result = mergePatch(base, { classes: { add: 'foo' } })
      expect(result.classes).toBe('foo')
    })
  })
})

describe('resolveDecor', () => {
  it('sans écart, retourne les défauts', () => {
    const defaults: DecorPatch = { style: { 'font-size': '10cqw' } }
    expect(resolveDecor(defaults, [])).toEqual(defaults)
  })

  it('replie toute la chaîne dans l\'ordre, chaque écart primant sur les précédents', () => {
    const defaults: DecorPatch = { style: { 'font-size': '10cqw', 'font-weight': 'normal' }, zone: null }
    const patch1: DecorPatch = { style: { 'font-size': '20cqw' } }
    const patch2: DecorPatch = { style: { 'font-weight': 'bold' }, zone: 'header' }
    const result = resolveDecor(defaults, [patch1, patch2])
    expect(result).toEqual({ style: { 'font-size': '20cqw', 'font-weight': 'bold' }, zone: 'header' })
  })

  it('un écart plus récent peut neutraliser une propriété posée par un écart antérieur', () => {
    const defaults: DecorPatch = {}
    const patch1: DecorPatch = { zone: 'header' }
    const patch2: DecorPatch = { zone: null }
    expect(resolveDecor(defaults, [patch1, patch2]).zone).toBeNull()
  })

  it('révision de chaîne (déplacement de kf) = repli complet sur le nouveau flux, sans état résiduel', () => {
    const defaults: DecorPatch = { style: { 'font-size': '10cqw' } }
    const chainA = [{ style: { 'font-size': '20cqw' } }]
    const chainB = [{ style: { 'font-size': '30cqw' } }, { style: { 'font-weight': 'bold' } }]
    expect(resolveDecor(defaults, chainA)).toEqual({ style: { 'font-size': '20cqw' } })
    expect(resolveDecor(defaults, chainB)).toEqual({ style: { 'font-size': '30cqw', 'font-weight': 'bold' } })
  })

  it('classes se replient add/remove sur toute la chaîne', () => {
    const defaults: DecorPatch = { classes: 'base' }
    const patch1: DecorPatch = { classes: { add: 'a' } }
    const patch2: DecorPatch = { classes: { add: 'b', remove: 'a' } }
    expect(resolveDecor(defaults, [patch1, patch2]).classes).toBe('base b')
  })
})

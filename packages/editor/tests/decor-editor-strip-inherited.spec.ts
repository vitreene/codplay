import { describe, it, expect } from 'vitest'
import { stripInherited } from '../src/decor-editor/strip-inherited'
import type { DecorPatch } from '../src/decor-editor/types'

describe('stripInherited', () => {
  it('retire une propriété CSS de style, conserve les autres', () => {
    const patch: DecorPatch = { style: { 'font-size': '20cqw', 'font-weight': 'bold' } }
    const result = stripInherited(patch, 'style.font-size')
    expect(result.style).toEqual({ 'font-weight': 'bold' })
  })

  it('supprime le groupe style entier si sa dernière propriété est retirée', () => {
    const patch: DecorPatch = { style: { 'font-size': '20cqw' } }
    const result = stripInherited(patch, 'style.font-size')
    expect(result.style).toBeUndefined()
  })

  it('retire une propriété racine simple (zone)', () => {
    const patch: DecorPatch = { zone: 'header', style: { 'font-weight': 'bold' } }
    const result = stripInherited(patch, 'zone')
    expect(result.zone).toBeUndefined()
    expect(result.style).toEqual({ 'font-weight': 'bold' })
  })

  it('retire custom : effacer le mini-éditeur revient à l\'hérité (spec §3.1)', () => {
    const patch: DecorPatch = { custom: 'color: red;' }
    const result = stripInherited(patch, 'custom')
    expect(result.custom).toBeUndefined()
  })

  it('retire classes en tant que propriété racine', () => {
    const patch: DecorPatch = { classes: 'foo bar' }
    const result = stripInherited(patch, 'classes')
    expect(result.classes).toBeUndefined()
  })

  it('no-op si le chemin n\'existe pas dans le patch', () => {
    const patch: DecorPatch = { style: { 'font-size': '20cqw' } }
    const result = stripInherited(patch, 'style.font-weight')
    expect(result).toEqual(patch)
  })

  it('no-op si le groupe n\'existe pas du tout', () => {
    const patch: DecorPatch = {}
    const result = stripInherited(patch, 'style.font-size')
    expect(result).toEqual({})
  })

  it('ne mute pas le patch original', () => {
    const patch: DecorPatch = { style: { 'font-size': '20cqw', 'font-weight': 'bold' } }
    stripInherited(patch, 'style.font-size')
    expect(patch.style).toEqual({ 'font-size': '20cqw', 'font-weight': 'bold' })
  })

  it('retire une propriété d\'offset (module structuré)', () => {
    const patch: DecorPatch = { offset: { x: 1, y: 2 } }
    const result = stripInherited(patch, 'offset.x')
    expect(result.offset).toEqual({ y: 2 })
  })
})

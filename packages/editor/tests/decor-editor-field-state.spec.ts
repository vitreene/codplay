import { describe, it, expect } from 'vitest'
import { resolveFieldAcrossItems } from '../src/decor-editor/field-state'
import type { ResolvedDecor } from '../src/decor-editor/types'

describe('resolveFieldAcrossItems (spec §7 bis, multi-sélection)', () => {
  it('un seul décor → uniform avec sa valeur', () => {
    const decors: ResolvedDecor[] = [{ style: { 'font-size': '12cqw' } }]
    expect(resolveFieldAcrossItems(decors, 'style.font-size')).toEqual({ kind: 'uniform', value: '12cqw' })
  })

  it('plusieurs décors avec la même valeur → uniform', () => {
    const decors: ResolvedDecor[] = [{ style: { 'font-size': '12cqw' } }, { style: { 'font-size': '12cqw' } }]
    expect(resolveFieldAcrossItems(decors, 'style.font-size')).toEqual({ kind: 'uniform', value: '12cqw' })
  })

  it('valeurs divergentes → mixed', () => {
    const decors: ResolvedDecor[] = [{ style: { 'font-size': '12cqw' } }, { style: { 'font-size': '20cqw' } }]
    expect(resolveFieldAcrossItems(decors, 'style.font-size')).toEqual({ kind: 'mixed' })
  })

  it('propriété absente sur tous les décors → uniform avec undefined', () => {
    const decors: ResolvedDecor[] = [{}, {}]
    expect(resolveFieldAcrossItems(decors, 'style.font-size')).toEqual({ kind: 'uniform', value: undefined })
  })

  it('présente sur un décor, absente sur l\'autre → mixed', () => {
    const decors: ResolvedDecor[] = [{ style: { 'font-size': '12cqw' } }, {}]
    expect(resolveFieldAcrossItems(decors, 'style.font-size')).toEqual({ kind: 'mixed' })
  })

  it('propriété racine simple (zone)', () => {
    const decors: ResolvedDecor[] = [{ zone: 'header' }, { zone: 'header' }]
    expect(resolveFieldAcrossItems(decors, 'zone')).toEqual({ kind: 'uniform', value: 'header' })
  })

  it('style est une carte ouverte : n\'importe quelle propriété CSS fonctionne sans déclaration préalable', () => {
    const decors: ResolvedDecor[] = [
      { style: { 'clip-path': 'circle(50%)' } },
      { style: { 'clip-path': 'circle(50%)' } },
    ]
    expect(resolveFieldAcrossItems(decors, 'style.clip-path')).toEqual({ kind: 'uniform', value: 'circle(50%)' })
  })

  it('tableau de décors vide → mixed (aucune valeur commune à affirmer)', () => {
    expect(resolveFieldAcrossItems([], 'style.font-size')).toEqual({ kind: 'mixed' })
  })
})

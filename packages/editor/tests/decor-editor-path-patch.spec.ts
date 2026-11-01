import { describe, it, expect } from 'vitest'
import { buildPatchFromPath } from '../src/decor-editor/path-patch'

describe('buildPatchFromPath (symétrique de readPath, contrat de patch par chemin)', () => {
  it('chemin imbriqué sous style', () => {
    expect(buildPatchFromPath('style.font-size', '16cqw')).toEqual({ style: { 'font-size': '16cqw' } })
  })

  it('chemin racine simple', () => {
    expect(buildPatchFromPath('zoneId', 'header-id')).toEqual({ zoneId: 'header-id' })
  })

  it('module hors style (offset)', () => {
    expect(buildPatchFromPath('offset.x', 10)).toEqual({ offset: { x: 10 } })
  })

  it('module hors style avec valeur booléenne réelle (textAutoSize)', () => {
    expect(buildPatchFromPath('textAutoSize.enabled', true)).toEqual({ textAutoSize: { enabled: true } })
  })

  it('ne transforme jamais la valeur (aucune connaissance du sens métier du chemin)', () => {
    expect(buildPatchFromPath('capsule.staggerMs', 250)).toEqual({ capsule: { staggerMs: 250 } })
  })
})

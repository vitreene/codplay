import { describe, expect, it } from 'vitest'
import { CapsuleDistribution, CapsulePreset } from '@codplay/scene-factory'

describe('CapsulePreset — resolves CapsuleKind + author setting into a concrete distribution', () => {
  it('carousel resolves to sequential even with no explicit distribution — its single-cell grid forces it', () => {
    expect(CapsulePreset.resolve({ capsuleType: 'carousel' })).toEqual({ mode: 'sequential' })
  })

  it('carousel with an explicit distribution setting still respects the author override', () => {
    expect(
      CapsulePreset.resolve({ capsuleType: 'carousel', distribution: { mode: 'stagger', staggerInMs: 500, staggerOutMs: 500 } }),
    ).toEqual({ mode: 'stagger', staggerInMs: 500, staggerOutMs: 500 })
  })

  it('throws for any non-carousel type with no explicit distribution — never guessed', () => {
    for (const capsuleType of ['grille', 'rangee', 'card', 'liste'] as const) {
      expect(() => CapsulePreset.resolve({ capsuleType })).toThrow()
    }
  })

  it('grille with an explicit "ligne" preset (stagger 0/0) resolves exactly as authored', () => {
    const resolution = CapsulePreset.resolve({
      capsuleType: 'grille',
      distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
    })
    expect(resolution).toEqual({ mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 })
  })

  it('grille with an explicit sequential override resolves to sequential, not stagger', () => {
    expect(CapsulePreset.resolve({ capsuleType: 'grille', distribution: { mode: 'sequential' } })).toEqual({ mode: 'sequential' })
  })
})

describe('CapsulePreset -> CapsuleDistribution.compute() — the real integration, the exact demo bug fixed end to end', () => {
  it('two fully-locked children in a grille with an explicit "ligne 1x2, stagger:0" setting both coexist', () => {
    const resolution = CapsulePreset.resolve({
      capsuleType: 'grille',
      distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
    })
    const { children } = CapsuleDistribution.compute({
      clipDurationMs: 3000,
      ...resolution,
      children: [
        { trackId: 'capsule-b', lockedIntroMs: 0, lockedOutroMs: 3000 },
        { trackId: 'item-flat', lockedIntroMs: 0, lockedOutroMs: 3000 },
      ],
    })
    expect(children[0]).toMatchObject({ introMs: 0, outroMs: 3000, visible: true })
    expect(children[1]).toMatchObject({ introMs: 0, outroMs: 3000, visible: true })
  })
})

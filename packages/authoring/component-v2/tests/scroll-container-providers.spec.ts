import { describe, expect, it, vi } from 'vitest'
import { AbstractLiveSourceProvider } from '../src/scroll-container/abstract-live-source-provider'
import { IntersectionObservationProvider } from '../src/scroll-container/intersection-observation-provider'
import { calculateScrollProgress, ScrollProgressProvider } from '../src/scroll-container/scroll-progress-provider'
import type { ScrollObservationRule } from '../src/scroll-container/scroll-source-types'

/** Records attachment hooks so lifecycle generation behavior can be asserted. */
class ProbeSourceProvider extends AbstractLiveSourceProvider {
  readonly events: string[] = []
  readonly generations: number[] = []

  /** Reports whether one captured attachment generation remains live. */
  isCurrentForTest(generation: number): boolean {
    return this.isCurrentAttachment(generation)
  }

  /** Records one provider attachment and its current generation. */
  protected override onAttach(generation: number): void {
    this.generations.push(generation)
    this.events.push(`attach:${generation}`)
  }

  /** Records a detach after the previous generation has been invalidated. */
  protected override onDetach(): void {
    this.events.push('detach')
  }

  /** Records final destruction. */
  protected override onDestroy(): void {
    this.events.push('destroy')
  }
}

/** Creates one serialized event declaration for a test observation rule. */
function rule(id: string, name: string): ScrollObservationRule {
  return {
    id,
    persoId: `target-${id}`,
    storyId: 'story',
    declaration: {
      zone: { threshold: 0.5 },
      enter: [{ name: `${name}:enter` }],
      leave: [{ name: `${name}:leave` }],
    },
  }
}

describe('scroll source providers', () => {
  it('keeps attachment and destruction idempotent while invalidating old generations', () => {
    const provider = new ProbeSourceProvider()

    provider.attach()
    provider.attach()
    const firstGeneration = provider.generations[0]
    expect(provider.isCurrentForTest(firstGeneration)).toBe(true)
    provider.detach()
    expect(provider.isCurrentForTest(firstGeneration)).toBe(false)
    provider.detach()
    provider.attach()
    const secondGeneration = provider.generations[1]
    expect(provider.isCurrentForTest(secondGeneration)).toBe(true)
    provider.destroy()
    provider.destroy()
    provider.attach()

    expect(provider.events).toEqual(['attach:1', 'detach', 'attach:3', 'detach', 'destroy'])
  })

  it('normalizes block and inline samples, clamps bounds, and coalesces to the latest value', () => {
    const published: number[] = []
    const provider = new ScrollProgressProvider({ onProgress: (progress) => published.push(progress) })

    expect(provider.axis).toBe('block')
    expect(calculateScrollProgress({ offset: 40, extent: 300, viewportExtent: 100 })).toBe(0.2)
    expect(calculateScrollProgress({ offset: -20, extent: 300, viewportExtent: 100 })).toBe(0)
    expect(calculateScrollProgress({ offset: 400, extent: 300, viewportExtent: 100 })).toBe(1)
    expect(calculateScrollProgress({ offset: 10, extent: 100, viewportExtent: 100 })).toBe(0)
    expect(calculateScrollProgress({ offset: Number.NaN, extent: 100, viewportExtent: 20 })).toBe(0)

    provider.sample({ offset: 10, extent: 300, viewportExtent: 100 })
    provider.sample({ offset: 60, extent: 300, viewportExtent: 100 })
    expect(provider.present()).toBeUndefined()
    provider.attach()
    provider.sample({ offset: 10, extent: 300, viewportExtent: 100 })
    provider.sample({ offset: 60, extent: 300, viewportExtent: 100 })
    expect(provider.present()).toBe(0.3)
    expect(provider.present()).toBeUndefined()
    expect(published).toEqual([0.3])

    const inline = new ScrollProgressProvider({ axis: 'inline', onProgress: vi.fn() })
    expect(inline.axis).toBe('inline')
  })

  it('silences initial observation phases and orders subsequent events by declaration', () => {
    const provider = new IntersectionObservationProvider([
      rule('first-rule', 'first'),
      rule('second-rule', 'second'),
    ])

    provider.attach()
    expect(provider.updatePhases([
      { ruleId: 'second-rule', phase: 'outside' },
      { ruleId: 'first-rule', phase: 'outside' },
    ])).toEqual([])
    expect(provider.updatePhases([
      { ruleId: 'second-rule', phase: 'inside' },
      { ruleId: 'first-rule', phase: 'inside' },
    ])).toEqual([
      expect.objectContaining({ ruleId: 'first-rule', event: { name: 'first:enter' } }),
      expect.objectContaining({ ruleId: 'second-rule', event: { name: 'second:enter' } }),
    ])
    expect(provider.updatePhases([
      { ruleId: 'second-rule', phase: 'outside' },
      { ruleId: 'first-rule', phase: 'outside' },
    ])).toEqual([
      expect.objectContaining({ ruleId: 'first-rule', event: { name: 'first:leave' } }),
      expect.objectContaining({ ruleId: 'second-rule', event: { name: 'second:leave' } }),
    ])

    expect(provider.updatePhases([{ ruleId: 'first-rule', phase: 'inside' }])).toEqual([
      expect.objectContaining({ ruleId: 'first-rule', event: { name: 'first:enter' } }),
    ])
    provider.detach()
    provider.attach()
    expect(provider.updatePhases([{ ruleId: 'second-rule', phase: 'inside' }])).toEqual([])
  })
})

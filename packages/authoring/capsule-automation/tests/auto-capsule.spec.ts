import { describe, expect, it } from 'vitest'
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from '../src'

describe('AutoCapsule — end-to-end resolve() + renderStyleSheet()', () => {
  it('resolves several children with mixed placement and transitions into one non-trivial stylesheet', () => {
    const capsule = new AutoCapsule({
      capsule: {
        id: 'gallery',
        type: CAPSULE_TYPE.grille,
        grid: { rows: 2, cols: 2, gap: '8px' },
        defaults: { introTransitionRef: 'swipe-right', outroTransitionRef: 'swipe-left' },
      },
      children: [
        { id: 'a', order: 1, timeRange: { startMs: 0, endMs: 2000 } },
        {
          id: 'b',
          order: 2,
          timeRange: { startMs: 2000, endMs: 4000 },
          events: { [EVENT_ACTION.intro]: { action: EVENT_ACTION.intro, ref: 'zoom' } },
        },
        {
          id: 'c',
          order: 3,
          timeRange: { startMs: 4000, endMs: 6000 },
          placement: { row: 2, col: 1, rowSpan: 1, colSpan: 2 },
        },
      ],
    })

    const result = capsule.resolve()

    // One grid container rule, plus one placement rule per child (auto or explicit).
    expect(result.grid.cssRules.length).toBe(1)
    expect(result.children.every((child) => child.cssRules.length === 1)).toBe(true)

    // a and c inherit the capsule-level defaults; b overrides its own intro explicitly.
    expect(result.children[0]!.events.intro!.ref).toBe('swipe-right')
    expect(result.children[1]!.events.intro!.ref).toBe('zoom')
    expect(result.children[2]!.events.outro!.ref).toBe('swipe-left')

    // The aggregated stylesheet dedupes and joins every rule (1 grid + 3 children = 4).
    const styleSheet = capsule.renderStyleSheet()
    expect(styleSheet).toBe(result.styleSheet)
    expect(styleSheet.split('\n').filter(Boolean).length).toBe(4)
    expect(styleSheet).toContain('display:grid')
  })

  it('renderStyleSheet() computes a fresh resolve() when none has run yet', () => {
    const capsule = new AutoCapsule(
      {
        capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: { rows: 1, cols: 1 } },
        children: [{ id: 'a', order: 1, timeRange: { startMs: 0, endMs: 1000 } }],
      },
      { autoResolveOnWrite: false },
    )
    expect(capsule.renderStyleSheet().length).toBeGreaterThan(0)
  })
})

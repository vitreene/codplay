import { describe, expect, it } from 'vitest'
import { AutoCapsule, CAPSULE_TYPE, EVENT_ACTION } from '../src'

describe('resolveAutoCapsuleEvents — resolved from a caller-provided timeRange', () => {
  it('synthesizes intro/outro at the child timeRange bounds when none are given', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: {} },
      children: [{ id: 'a', order: 1, timeRange: { startMs: 2000, endMs: 5000 } }],
    })
    const events = capsule.resolve().children[0]!.events
    expect(events.intro!.triggerMs).toBe(2000)
    expect(events.intro!.isSynthetic).toBe(true)
    expect(events.intro!.ref).toBe('fade')
    expect(events.outro!.triggerMs).toBe(5000)
  })

  it('does not synthesize an outro when the type disables it by default (rangee)', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.rangee, grid: {} },
      children: [{ id: 'a', order: 1, timeRange: { startMs: 0, endMs: 3000 } }],
    })
    expect(capsule.resolve().children[0]!.events.outro).toBeUndefined()
  })

  it('resolves an explicit event ref against the named event definition registry', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: {} },
      children: [
        {
          id: 'a',
          order: 1,
          timeRange: { startMs: 0, endMs: 1000 },
          // `name` is explicit here — `isSynthetic` tracks whether the event *name* had to be
          // auto-generated, not whether the event itself was caller-provided (an explicit event
          // without a `name` is still `isSynthetic: true`, see the next test).
          events: { [EVENT_ACTION.intro]: { action: EVENT_ACTION.intro, name: 'my-intro', ref: 'zoom' } },
        },
      ],
    })
    const intro = capsule.resolve().children[0]!.events.intro!
    expect(intro.definition?.label).toBe('zoom')
    expect(intro.durationMs).toBe(300)
    expect(intro.name).toBe('my-intro')
    expect(intro.isSynthetic).toBe(false)
  })

  it('an explicit event without its own `name` still gets isSynthetic: true (name-only synthesis)', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: {} },
      children: [
        {
          id: 'a',
          order: 1,
          timeRange: { startMs: 0, endMs: 1000 },
          events: { [EVENT_ACTION.intro]: { action: EVENT_ACTION.intro, ref: 'zoom' } },
        },
      ],
    })
    const intro = capsule.resolve().children[0]!.events.intro!
    expect(intro.ref).toBe('zoom')
    expect(intro.isSynthetic).toBe(true)
  })

  it('resolves a named event trigger from a registered eventTime instead of the child bounds', () => {
    const capsule = new AutoCapsule({
      capsule: { id: 'c', type: CAPSULE_TYPE.grille, grid: {} },
      eventTimes: [{ name: 'chapter-a', startMs: 2500, endMs: 2500 }],
      children: [
        {
          id: 'a',
          order: 1,
          timeRange: { startMs: 0, endMs: 5000 },
          events: { [EVENT_ACTION.intro]: { action: EVENT_ACTION.intro, name: 'chapter-a', ref: 'fade' } },
        },
      ],
    })
    expect(capsule.resolve().children[0]!.events.intro!.triggerMs).toBe(2500)
  })

  it('capsule-level defaults override the type default intro/outro ref', () => {
    const capsule = new AutoCapsule({
      capsule: {
        id: 'c',
        type: CAPSULE_TYPE.grille, // type default is 'fade'/'fade'
        grid: {},
        defaults: { introTransitionRef: 'swipe-right', outroTransitionRef: 'swipe-left' },
      },
      children: [{ id: 'a', order: 1, timeRange: { startMs: 0, endMs: 1000 } }],
    })
    const events = capsule.resolve().children[0]!.events
    expect(events.intro!.ref).toBe('swipe-right')
    expect(events.outro!.ref).toBe('swipe-left')
  })
})

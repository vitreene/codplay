import { describe, expect, it } from 'vitest'

import { createAnimationAdapter, type AnimeImplementation } from '../../src/animation/adapter'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { StrapCollection } from '../../src/player/strap-types'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one anime implementation that applies values immediately.
 */
function temp__createApplyingAnimeImplementation() {
  return ((targets: unknown, params: Record<string, unknown>) => {
    if (typeof params.complete === 'function') {
      (params.complete as () => void)()
    }
    return { pause: () => {} }
  }) as AnimeImplementation
}

const fanoutStraps: StrapCollection = {
  fanout: ({ context }) => {
    return context.planned.sequence([
      { step: { event: { name: 'label-a', data: { content: 'first' } } }, durationMs: 200 },
      { step: { event: { name: 'label-b', data: { content: 'second' } } } }
    ])
  }
}

/**
 * Creates one scene where a single strap trigger fans out, via the
 * `sequence` chaining primitive, into two events targeting two distinct
 * persos at two distinct absolute ms.
 */
function temp__createFanoutScene(): SceneDoc {
  return {
    id: 'fanout-scene',
    rootStories: ['fanout-story'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'fanout-story': {
        id: 'fanout-story',
        entries: ['label-a', 'label-b'],
        initial: undefined,
        persos: [
          { id: 'label-a', type: 'tag', initial: { content: 'idle-a' }, actions: { 'label-a': true } },
          { id: 'label-b', type: 'tag', initial: { content: 'idle-b' }, actions: { 'label-b': true } }
        ],
        straps: fanoutStraps,
        listen: [
          {
            on: 'go',
            straps: ['fanout']
          }
        ],
        eventimes: [
          {
            name: 'go',
            startAt: 0
          }
        ]
      }
    }
  }
}

/**
 * Same fanout shape, plus an independent eventime ('mark') scheduled at the
 * exact ms the fanout's second step is due (200) — both events are due
 * together on a cold direct seek to ms200, reproducing the scenario from
 * 2026-06-29-track-event-insertion-cursor-defect.md at the strap level
 * (materialization via context.planned.sequence, not perso-level
 * ActionSequence).
 */
function temp__createFanoutWithCollidingEventimeScene(): SceneDoc {
  return {
    id: 'fanout-collision-scene',
    rootStories: ['fanout-story'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'fanout-story': {
        id: 'fanout-story',
        entries: ['label-a', 'label-b', 'label-c'],
        initial: undefined,
        persos: [
          { id: 'label-a', type: 'tag', initial: { content: 'idle-a' }, actions: { 'label-a': true } },
          { id: 'label-b', type: 'tag', initial: { content: 'idle-b' }, actions: { 'label-b': true } },
          { id: 'label-c', type: 'tag', initial: { content: 'idle-c' }, actions: { mark: { content: 'marked' } } }
        ],
        straps: fanoutStraps,
        listen: [
          {
            on: 'go',
            straps: ['fanout']
          }
        ],
        eventimes: [
          { name: 'go', startAt: 0 },
          { name: 'mark', startAt: 200 }
        ]
      }
    }
  }
}

describe('V1 - ActionSequence (strap-level chaining primitive, context.planned.sequence)', () => {
  it('AS-STRAP-T1 fans out one trigger into two events targeting two distinct persos at their own chained ms', async () => {
    const nodesByPersoId: Record<string, Record<string, unknown>> = {
      'label-a': { tagName: 'DIV', style: {}, attributes: {}, textContent: '' },
      'label-b': { tagName: 'DIV', style: {}, attributes: {}, textContent: '' }
    }

    const player = new Player({
      animationAdapter: createAnimationAdapter(temp__createApplyingAnimeImplementation()),
      createElementOptions: {
        nodeFactory: (item: { id: string }) => nodesByPersoId[item.id] as never
      }
    })

    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: temp__createFanoutScene() })
    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      throw new Error('fanout scene compile failed')
    }

    expect(
      await player.init({
        mountTarget: {},
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: fanoutStraps
      })
    ).toEqual({ ok: true, data: undefined })

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.pause()).toEqual({ ok: true, data: undefined })

    // Step 0 (label-a) fires at offset 0 — already applied live by the strap trigger at ms 0.
    expect(await player.seek({ timelineMs: 0 })).toEqual({ ok: true, data: undefined })
    expect(nodesByPersoId['label-a']?.textContent).toBe('first')
    expect(nodesByPersoId['label-b']?.textContent).toBe('idle-b')

    // Step 1 (label-b) is due at offset 200 (end of step 0's explicit duration).
    expect(await player.seek({ timelineMs: 200 })).toEqual({ ok: true, data: undefined })
    expect(nodesByPersoId['label-a']?.textContent).toBe('first')
    expect(nodesByPersoId['label-b']?.textContent).toBe('second')
  })

  it('AS-STRAP-T2 a cold direct seek to the exact ms of both the materialized step and an independent eventime applies both', async () => {
    const nodesByPersoId: Record<string, Record<string, unknown>> = {
      'label-a': { tagName: 'DIV', style: {}, attributes: {}, textContent: '' },
      'label-b': { tagName: 'DIV', style: {}, attributes: {}, textContent: '' },
      'label-c': { tagName: 'DIV', style: {}, attributes: {}, textContent: '' }
    }

    const player = new Player({
      animationAdapter: createAnimationAdapter(temp__createApplyingAnimeImplementation()),
      createElementOptions: {
        nodeFactory: (item: { id: string }) => nodesByPersoId[item.id] as never
      }
    })

    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: temp__createFanoutWithCollidingEventimeScene() })
    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      throw new Error('fanout collision scene compile failed')
    }

    expect(
      await player.init({
        mountTarget: {},
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: fanoutStraps
      })
    ).toEqual({ ok: true, data: undefined })

    expect(await player.play()).toEqual({ ok: true, data: undefined })
    expect(await player.pause()).toEqual({ ok: true, data: undefined })

    // Cold, single seek straight to ms200: `go` (ms0) and `mark` (ms200) are
    // both due in the same instant — `go`'s own handler materializes
    // label-b's step at ms200, chronologically alongside `mark`. Both must
    // apply; neither must be skipped or replayed twice.
    expect(await player.seek({ timelineMs: 200 })).toEqual({ ok: true, data: undefined })
    expect(nodesByPersoId['label-a']?.textContent).toBe('first')
    expect(nodesByPersoId['label-b']?.textContent).toBe('second')
    expect(nodesByPersoId['label-c']?.textContent).toBe('marked')
  })
})

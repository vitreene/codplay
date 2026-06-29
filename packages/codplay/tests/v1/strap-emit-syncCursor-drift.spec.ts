import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { StrapCollection } from '../../src/player/strap-types'
import type { SceneDoc } from '../../src/player/types'

/**
 * One strap trigger returns two immediate events in the same `events:[...]`
 * batch: the first cascades into a genuinely async sub-strap (a real
 * `setTimeout` delay) before resolving; the second targets a perso whose
 * action is an `ActionSequence` with a short (5ms) continuation step.
 * Reproduces 2026-06-29-strap-emit-syncCursor-drift-defect.md: by the time
 * the second event's own `emit()` call runs, real wall-clock time has
 * already passed the continuation's due offset, so a `currentMs` re-read
 * from the live clock (the pre-fix behavior) makes `syncCursor` skip past
 * the continuation before it is ever collected.
 */
const driftStraps: StrapCollection = {
  trigger: () => {
    return {
      events: [
        { name: 'slow-cascade' },
        { name: 'sink:show' }
      ]
    }
  },
  'absorb-delay': async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
    return {}
  }
}

function temp__createDriftScene(): SceneDoc {
  return {
    id: 'drift-scene',
    rootStories: ['drift-story'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'drift-story': {
        id: 'drift-story',
        entries: ['sink'],
        initial: undefined,
        persos: [
          {
            id: 'sink',
            type: 'tag',
            initial: { content: 'idle' },
            actions: {
              'sink:show': [
                { action: { content: 'shown' }, durationMs: 5 },
                { action: { content: 'revealed' } }
              ]
            } as unknown as Record<string, unknown>
          }
        ],
        straps: driftStraps,
        listen: [
          { on: 'trigger', straps: ['trigger'] },
          { on: 'slow-cascade', straps: ['absorb-delay'] }
        ],
        eventimes: []
      }
    }
  }
}

describe('V1 - strap emit syncCursor drift (2026-06-29-strap-emit-syncCursor-drift-defect.md)', () => {
  it('SED-T1 a short ActionSequence continuation survives a slower sibling event in the same strap batch', async () => {
    const nodesByPersoId: Record<string, Record<string, unknown>> = {
      sink: { tagName: 'DIV', style: {}, attributes: {}, textContent: '' }
    }

    const player = new Player({
      createElementOptions: {
        nodeFactory: (item: { id: string }) => nodesByPersoId[item.id] as never
      }
    })

    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: temp__createDriftScene() })
    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      throw new Error('drift scene compile failed')
    }

    expect(
      await player.init({
        mountTarget: {},
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: driftStraps
      })
    ).toEqual({ ok: true, data: undefined })

    expect(await player.play()).toEqual({ ok: true, data: undefined })

    // A direct `player.emit()` call, not an `eventimes`-scheduled one — the
    // user-click path from the cadrage doc, routed straight through
    // `routeSceneEvent`/`executeStrap`, never through
    // `PlayerFacade.runDueTimelineEvents`'s due-events draining (which would
    // freeze `currentMs` for an unrelated reason and mask this defect).
    expect(await player.emit({ name: 'trigger', scopeStoryId: 'drift-story' })).toEqual({ ok: true, data: undefined })

    // Real wait: long enough for the 40ms cascade delay, the 5ms
    // continuation, and the live ticker to drain both — short enough to
    // keep the test fast. See the cadrage doc for why fake timers cannot
    // stand in for this (they don't reproduce the real-clock drift).
    await new Promise((resolve) => setTimeout(resolve, 300))

    expect(nodesByPersoId.sink?.textContent).toBe('revealed')
  }, 2000)
})

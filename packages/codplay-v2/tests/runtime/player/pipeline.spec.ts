import { describe, expect, it } from 'vitest'

import {
  buildTrackRegistry,
  createStrapTrackId,
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_ROOT,
  MOUNT_PLACEMENT_OFF,
  MOUNT_PLACEMENT_PARENT,
  MOUNT_PLACEMENT_ROOT,
  MOVE_ORDER_MODE_FIRST,
  MOVE_ISSUE_CONFLICT_SAME_TICK,
  MOVE_ISSUE_LAST_INVALID_SAME_TICK,
  materializeScene,
  resolveScene,
  RuntimeTrackJournal,
  STRAP_SCOPE_STORY,
  solveScene,
  TRACK_EVENT_ACTIVATE,
  TRACK_EVENT_DEACTIVATE,
} from '../../../src/runtime/player'
import { prepareSvgPath } from '../../../src/ace'
import type { CompiledScene } from '../../../src/scene/compiled'

const scene: CompiledScene = {
  schemaVersion: 'codplay.v2.scene.v1',
  createdAt: '2026-08-01T00:00:00.000Z',
  scene: {
    id: 'pipeline-scene',
    listen: [],
    tracks: { main: { active: true }, disabled: { active: false } },
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'root',
          type: 'tag',
          initial: { className: 'is-idle', style: { opacity: 0, backgroundColor: '#000000' } },
          actions: {
            'demo:show': {
              className: { add: 'is-active', remove: 'is-idle' },
              style: {
                opacity: { from: 0, to: 1, duration: 100, ease: 'linear' },
                backgroundColor: { from: '#000000', to: '#ffffff', duration: 100, ease: 'linear' },
              },
            },
            'data:show': null,
          },
        }],
        listen: [],
        eventimes: [
          { name: 'demo:show', startAt: 200 },
          { name: 'demo:show', startAt: 100 },
          { name: 'sequence:anchor', startAt: 300, events: [{ name: 'demo:show', startAt: 25 }] },
          { name: 'data:show', startAt: 400, data: { className: { add: 'data-active' } } },
        ],
      },
    },
  },
  resources: { entries: [] },
  rootNodeIds: ['main:root'],
  requirements: { components: [], services: [], modules: [], resources: [] },
}

describe('materialize -> resolve -> solve', () => {
  it('materializes only active occurrences in chronological order', () => {
    const materialized = materializeScene(scene, 250)
    const actions = materialized.persos['main:root']?.actions

    expect(actions).toHaveLength(2)
    expect(actions?.map((action) => [action.startAt, action.elapsedMs])).toEqual([[100, 150], [200, 50]])
    expect(actions?.[0]).toMatchObject({ trackId: 'main', trackOrder: 1 })

    const nestedActions = materializeScene(scene, 325).persos['main:root']?.actions
    expect(nestedActions?.map((action) => action.startAt)).toEqual([100, 200, 325])
    expect(nestedActions?.[2]?.declarationPath).toEqual([2, 0])
  })

  it('consolidates the static track registry in declaration order', () => {
    const registry = buildTrackRegistry(scene)

    expect(registry.order).toEqual(['global', 'main', 'disabled'])
    expect(registry.tracks.main).toMatchObject({ id: 'main', order: 1, active: true })
    expect(registry.tracks.disabled).toMatchObject({ id: 'disabled', order: 2, active: false })
  })

  it('does not materialize events from an inactive track', () => {
    const inactiveScene: CompiledScene = {
      ...scene,
      scene: { ...scene.scene, tracks: { main: { active: false } } },
    }

    expect(materializeScene(inactiveScene, 150).persos['main:root']?.actions).toHaveLength(0)
  })

  it('appends live events only to declared tracks and preserves event sequence', () => {
    const journal = new RuntimeTrackJournal(scene)
    const first = journal.appendLiveEvent({
      eventId: 'live-a',
      trackId: 'main',
      storyId: 'main',
      name: 'data:show',
      applyAtMs: 250,
      data: { className: { add: 'live-a' } },
    })
    const second = journal.appendLiveEvent({
      eventId: 'live-b',
      trackId: 'main',
      storyId: 'main',
      name: 'data:show',
      applyAtMs: 250,
      data: { className: { add: 'live-b' } },
    })

    expect(first).toMatchObject({ ok: true, data: { eventSeq: 0 } })
    expect(second).toMatchObject({ ok: true, data: { eventSeq: 1 } })
    expect(journal.appendLiveEvent({
      eventId: 'unknown', trackId: 'missing', name: 'data:show', applyAtMs: 250,
    })).toMatchObject({ ok: false, code: 'RUNTIME_TRACK_UNKNOWN' })

    const liveActions = materializeScene(scene, 260, journal).persos['main:root']?.actions
    expect(liveActions?.filter((action) => action.eventId !== undefined).map((action) => action.eventSeq)).toEqual([0, 1])
  })

  it('controls declared track activity without creating tracks', () => {
    const journal = new RuntimeTrackJournal(scene)

    expect(journal.applyControlEvent(TRACK_EVENT_DEACTIVATE, { trackIds: ['main'] })).toMatchObject({
      ok: true,
      data: { deactivated: ['main'] },
    })
    expect(journal.applyControlEvent(TRACK_EVENT_ACTIVATE, { trackIds: ['main', 'missing'] })).toMatchObject({
      ok: true,
      data: { activated: ['main'], ignored: ['missing'] },
    })
    expect(journal.registry.tracks.missing).toBeUndefined()
  })

  it('anchors relative live eventimes without changing the track registry', () => {
    const journal = new RuntimeTrackJournal(scene)
    const result = journal.appendAnchoredEventimes({
      trackId: 'main',
      storyId: 'main',
      anchorMs: 100,
      eventimes: [{
        name: 'data:show',
        startAt: 10,
        events: [{ name: 'data:show', startAt: 20, data: { className: { add: 'anchored' } } }],
      }],
    })

    expect(result).toMatchObject({ ok: true, data: { appendedCount: 2 } })
    if (result.ok) expect(result.data.events.map((event) => event.applyAtMs)).toEqual([110, 130])
    expect(journal.registry.order).toEqual(['global', 'main', 'disabled'])
    expect(resolveScene(materializeScene(scene, 131, journal)).persos['main:root']?.state.className)
      .toContain('anchored')
  })

  it('materializes strap outputs on their declared dedicated track', () => {
    const strapScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          ...scene.scene.stories,
          main: { ...scene.scene.stories.main!, straps: ['counter'] },
        },
      },
    }
    const journal = new RuntimeTrackJournal(strapScene)
    const result = journal.appendStrapOutput({
      scope: STRAP_SCOPE_STORY,
      storyId: 'main',
      strapName: 'counter',
      anchorMs: 200,
      output: {
        events: [{ name: 'data:show', data: { className: { add: 'immediate' } } }],
        updates: [{ count: 1 }],
        planned: [{ offsetMs: 25, step: { event: { name: 'data:show', data: { className: { add: 'planned' } } } } }],
        warnings: [],
        issues: [],
      },
    })

    expect(result).toMatchObject({
      ok: true,
      data: { trackId: createStrapTrackId('main', 'counter'), materializedUpdateCount: 1 },
    })
    expect(resolveScene(materializeScene(strapScene, 226, journal)).persos['main:root']?.state.className)
      .toMatch(/immediate.*planned|planned.*immediate/)
    expect(materializeScene(strapScene, 226, journal).storyStates.main).toMatchObject({ count: 1 })
  })

  it('resolves discrete patches and ACE values without mutating compiled data', () => {
    const materialized = materializeScene(scene, 150)
    const resolved = resolveScene(materialized)

    expect(resolved.persos['main:root']?.state).toMatchObject({
      className: 'is-active',
      style: {
        opacity: 0.5,
        backgroundColor: { kind: 'color', space: 'srgb', coords: [0.5, 0.5, 0.5], alpha: 1 },
      },
    })
    expect(scene.scene.stories.main.persos[0]?.initial).toEqual({
      className: 'is-idle',
      style: { opacity: 0, backgroundColor: '#000000' },
    })

    const dataResolved = resolveScene(materializeScene(scene, 450))
    expect(dataResolved.persos['main:root']?.state.className).toContain('data-active')
  })

  it('resolves x and y style channels through ACE without changing placement', () => {
    const transformScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { move: '@root', style: { x: '0px', y: '10px' } },
              actions: {
                translate: {
                  style: {
                    x: { from: '0px', to: '100px', duration: 100, ease: 'linear' },
                    y: { from: '10px', to: '50px', duration: 100, ease: 'linear' },
                  },
                },
              },
            }],
            eventimes: [{ name: 'translate', startAt: 100 }],
          },
        },
      },
    }

    const resolved = resolveScene(materializeScene(transformScene, 150))

    expect(resolved.persos['main:root']?.placement.kind).toBe('root')
    expect(resolved.persos['main:root']?.state.style).toMatchObject({ x: '50px', y: '30px' })
  })

  it('preserves the authored move start time for FLIP seek reconstruction', () => {
    const transitionScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [{
              id: 'root',
              type: 'tag',
              initial: { move: '@root' },
              actions: {
                transfer: { move: { target: 'target', transition: { duration: 100, ease: 'linear' } } },
              },
            }],
            eventimes: [{ name: 'transfer', startAt: 100 }],
          },
        },
      },
    }

    const solved = solveScene(resolveScene(materializeScene(transitionScene, 150)), {
      mountTargets: [
        { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
        { id: 'target', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
      ],
    })

    expect(solved.persos['main:root']?.placement).toMatchObject({
      targetId: 'target',
      transitionStartAt: 100,
    })
  })

  it('exposes a stable solve output without claiming hierarchy support', () => {
    const solved = solveScene(resolveScene(materializeScene(scene, 150)))

    expect(solved.timeMs).toBe(150)
    expect(solved.persos['main:root']?.key).toBe('main:root')
    expect(solved.persos['main:root']?.state.className).toBe('is-active')
  })

  it('resolves opaque root, detached, and internal parent placements', () => {
    const moveScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [{
              ...scene.scene.stories.main!.persos[0]!,
              initial: { move: '@root' },
              actions: {
                detach: { move: '@off' },
                attach: { move: { target: 'toto' } },
              },
            }],
            eventimes: [
              { name: 'detach', startAt: 100 },
              { name: 'attach', startAt: 200 },
            ],
          },
        },
      },
    }
    const mountTargets = [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
      { id: 'toto', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
    ] as const

    const beforeDetach = solveScene(resolveScene(materializeScene(moveScene, 50)), { mountTargets })
    const detached = solveScene(resolveScene(materializeScene(moveScene, 150)), { mountTargets })
    const attached = solveScene(resolveScene(materializeScene(moveScene, 250)), { mountTargets })

    expect(beforeDetach.persos['main:root']?.placement).toMatchObject({ kind: MOUNT_PLACEMENT_ROOT, mounted: true })
    expect(detached.persos['main:root']?.placement).toMatchObject({ kind: MOUNT_PLACEMENT_OFF, mounted: false })
    expect(attached.persos['main:root']?.placement).toMatchObject({
      kind: MOUNT_PLACEMENT_PARENT,
      mounted: true,
      targetId: 'toto',
      target: { kind: MOUNT_TARGET_KIND_OUTLET },
    })
  })

  it('normalizes target and preserves move transition data for projection', () => {
    const compiledPath = prepareSvgPath('M 0 0 L 0.5 0.5 L 1 0')
    const transitionScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [{
              ...scene.scene.stories.main!.persos[0]!,
              initial: { move: '@root' },
              actions: {
                attach: {
                  move: {
                    target: 'outlet-a',
                    mode: 'append',
                    flipMode: 'overlay-world',
                    reorder: true,
                    transition: {
                      duration: 320,
                      ease: 'easeOutCubic',
                       path: compiledPath,
                    },
                  },
                },
              },
            }],
            eventimes: [{ name: 'attach', startAt: 100 }],
          },
        },
      },
    }
    const solved = solveScene(resolveScene(materializeScene(transitionScene, 100)), {
      mountTargets: [
        { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
        { id: 'outlet-a', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
      ],
    })

    expect(solved.persos['main:root']?.placement).toMatchObject({
      targetId: 'outlet-a',
      mode: 'append',
      flipMode: 'overlay-world',
      reorder: true,
      transition: {
        duration: 320,
        ease: 'easeOutCubic',
         path: expect.objectContaining({ kind: 'segments', traversal: 'arc-length' }),
      },
    })
  })

  it('builds parent-child links, stable child order, and inherited detached state', () => {
    const hierarchyScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [
              { id: 'parent', type: 'tag', initial: { move: '@root' }, actions: { detach: { move: '@off' } } },
              { id: 'child-a', type: 'tag', initial: { move: { target: 'parent' } }, actions: {} },
              { id: 'child-b', type: 'tag', initial: { move: { target: 'parent' } }, actions: {} },
            ],
            eventimes: [{ name: 'detach', startAt: 100 }],
          },
        },
      },
    }
    const options = {
      mountTargets: [{ id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' }] as const,
    }

    const mounted = solveScene(resolveScene(materializeScene(hierarchyScene, 50)), options)
    expect(mounted.rootPersoKeys).toEqual(['main:parent'])
    expect(mounted.persos['main:child-a']?.placement.parentKey).toBe('main:parent')
    expect(mounted.childrenByTarget.parent).toEqual(['main:child-a', 'main:child-b'])

    const detached = solveScene(resolveScene(materializeScene(hierarchyScene, 150)), options)
    expect(detached.persos['main:parent']?.placement.mounted).toBe(false)
    expect(detached.persos['main:child-a']?.placement.mounted).toBe(false)
    expect(detached.childrenByTarget.parent).toBeUndefined()
  })

  it('rejects cycles in the mounted perso graph', () => {
    const cycleScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [
              { id: 'first', type: 'tag', initial: { move: { target: 'second' } }, actions: {} },
              { id: 'second', type: 'tag', initial: { move: { target: 'first' } }, actions: {} },
            ],
          },
        },
      },
    }

    expect(() => solveScene(resolveScene(materializeScene(cycleScene, 0)))).toThrow('Mount hierarchy cycle detected')
  })

  it('applies same-tick last-write-wins and ignores an invalid last move', () => {
    const conflictScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [{ id: 'item', type: 'tag', initial: { move: '@root' }, actions: {
              toA: { move: { target: 'outlet-a' } },
              toB: { move: { target: 'outlet-b' } },
              invalid: { move: { target: 42 } },
            } }],
            eventimes: [
              { name: 'toA', startAt: 100 },
              { name: 'toB', startAt: 100 },
            ],
          },
        },
      },
    }
    const targets = [
      { id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' },
      { id: 'outlet-a', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
      { id: 'outlet-b', kind: MOUNT_TARGET_KIND_OUTLET, storyId: 'main' },
    ] as const

    const lastValid = solveScene(resolveScene(materializeScene(conflictScene, 100)), { mountTargets: targets })
    expect(lastValid.persos['main:item']?.placement.targetId).toBe('outlet-b')
    expect(lastValid.moveIssues.map((issue) => issue.code)).toContain(MOVE_ISSUE_CONFLICT_SAME_TICK)

    const invalidLastScene: CompiledScene = {
      ...conflictScene,
      scene: {
        ...conflictScene.scene,
        stories: {
          main: {
            ...conflictScene.scene.stories.main!,
            eventimes: [
              { name: 'toA', startAt: 100 },
              { name: 'invalid', startAt: 100 },
            ],
          },
        },
      },
    }
    const invalidLast = solveScene(resolveScene(materializeScene(invalidLastScene, 100)), { mountTargets: targets })
    expect(invalidLast.persos['main:item']?.placement.kind).toBe(MOUNT_PLACEMENT_ROOT)
    expect(invalidLast.moveIssues.map((issue) => issue.code)).toContain(MOVE_ISSUE_LAST_INVALID_SAME_TICK)
  })

  it('preserves compile order while carrying list ordering metadata', () => {
    const orderedScene: CompiledScene = {
      ...scene,
      scene: {
        ...scene.scene,
        stories: {
          main: {
            ...scene.scene.stories.main!,
            persos: [
              { id: 'parent', type: 'tag', initial: { move: '@root' }, actions: {} },
              { id: 'item-a', type: 'tag', initial: { move: { target: 'parent' } }, actions: {
                last: { move: { target: 'parent', mode: 999 } },
              } },
              { id: 'item-b', type: 'tag', initial: { move: { target: 'parent' } }, actions: {} },
              { id: 'item-c', type: 'tag', initial: { move: { target: 'parent' } }, actions: {
                first: { move: { target: 'parent', mode: MOVE_ORDER_MODE_FIRST } },
              } },
            ],
            eventimes: [
              { name: 'first', startAt: 10 },
              { name: 'last', startAt: 20 },
            ],
          },
        },
      },
    }
    const solved = solveScene(resolveScene(materializeScene(orderedScene, 30)), {
      mountTargets: [{ id: 'root-host', kind: MOUNT_TARGET_KIND_ROOT, storyId: 'main' }],
    })

    expect(solved.childrenByTarget.parent).toEqual(['main:item-a', 'main:item-b', 'main:item-c'])
    expect(solved.persos['main:item-c']?.placement.mode).toBe('first')
    expect(solved.persos['main:item-a']?.placement.mode).toBe(999)
  })

  it('rejects invalid materialization times before evaluation', () => {
    expect(() => materializeScene(scene, -1)).toThrow(/non-negative/)
    expect(() => materializeScene(scene, Number.NaN)).toThrow(/finite/)
  })
})

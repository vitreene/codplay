import { describe, expect, it } from 'vitest'

import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import { RuntimePlayer } from '../../../src/runtime/player'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { CompiledEmitRule } from '../../../src/scene/compiled'
import { createDragCaptureScene, s6Straps } from '../../../demos/validation/player/drag-scene'

describe('V2 drag capture demo scene', () => {
  it('compiles capture functions and routes the end state through the normal event path', async () => {
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-08-21T00:00:00.000Z',
    }).build(createDragCaptureScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const player = new RuntimePlayer(
      'drag-capture-test',
      new RuntimeEngine(catalog, { resources: build.compiledScene.requirements.resources }),
      build.compiledScene,
      undefined,
      { scene: {}, stories: { main: s6Straps } },
      undefined,
      [{ id: 'root-host', kind: 'root', storyId: 'main' }],
      undefined,
      undefined,
      build.functions,
    )
    expect(player.init().ok).toBe(true)

    const item = build.compiledScene.scene.stories.main.persos.find((perso) => perso.id === 'item-1')
    expect(item?.emit?.pointerdown).toBeDefined()
    if (item?.emit?.pointerdown === undefined) return
    const pointerRule = item.emit.pointerdown
    const pointerRules: readonly CompiledEmitRule[] = Array.isArray(pointerRule)
      ? pointerRule as readonly CompiledEmitRule[]
      : [pointerRule as CompiledEmitRule]
    const capture = pointerRules[0]?.capture
    expect(capture).toBeDefined()
    if (capture === undefined) return
    const opened = player.beginCompiledCapture({
      captureId: 'drag-1',
      storyId: 'main',
      declaration: capture,
    })
    expect(opened.ok).toBe(true)
    expect(player.trackCapture('drag-1', {
      movementX: 24,
      movementY: -12,
      clientX: 104,
      clientY: 60,
    })).toMatchObject({ ok: true, captureState: { dropIn: ['list-a', 'list-b'] } })

    const ended = await player.endCapture('drag-1', {}, {
      dropIn: ['list-a', 'list-b'],
      persoId: 'item-1',
      move: {
        target: 'list-b',
        mode: 0,
        flipMode: 'overlay-world',
        transition: { duration: 420, ease: 'out(2)' },
      },
    })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.endCaptureEvents).toHaveLength(1)
    expect(ended.endCaptureEvents[0]).toMatchObject({
      name: 'item:persisted:item-1',
      source: 'endCapture',
      mode: 'persist-only',
      data: {
        persoId: 'item-1',
        move: {
          target: 'list-b',
          mode: 0,
          flipMode: 'overlay-world',
        },
      },
    })
    expect(ended.endEmitEvent).toMatchObject({
      name: 'item:dropped:item-1',
      source: 'endEmit',
      mode: 'apply-now',
      data: {
        persoId: 'item-1',
        move: {
          target: 'list-b',
          mode: 0,
          flipMode: 'overlay-world',
        },
        captureState: {
          persoId: 'item-1',
          move: { target: 'list-b' },
        },
      },
    })
    expect(ended.endCaptureEvents[0]?.applyAtMs).toBeLessThan(ended.endEmitEvent!.applyAtMs)
    expect(player.trackJournal.getEventsForStory('main').filter((event) => event.mode === 'persist-only')).toHaveLength(1)
    expect(player.resolveSceneAt(0).storyStates.main.itemListById).toEqual({
      'item-1': 'list-b',
      'item-2': 'list-a',
      'item-3': 'list-a',
    })
    expect(player.resolveSceneAt(0).persos['main:item-1']?.placement.targetId).toBe('list-b')
    expect(player.trackJournal.getStateUpdates('story', 'main', 0)).toContainEqual(expect.objectContaining({
      update: {
        itemListById: {
          'item-1': 'list-b',
          'item-2': 'list-a',
          'item-3': 'list-a',
        },
      },
    }))
    player.destroy()
  })
})

import { describe, expect, it } from 'vitest'

import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import { RuntimePlayer } from '../../../src/runtime/player'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { CompiledEmitRule } from '../../../src/scene/compiled'
import { createDragCaptureScene, dragStraps } from '../../../demos/validation/player/drag-scene'

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
      { scene: {}, stories: { main: dragStraps } },
      undefined,
      [{ id: 'root-host', kind: 'root', storyId: 'main' }],
      undefined,
      undefined,
      build.functions,
    )
    expect(player.init().ok).toBe(true)

    const pointerRule = build.compiledScene.scene.stories.main.persos[0]!.emit!.pointerdown!
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
    })).toMatchObject({ ok: true, captureState: { x: 104, y: 60 } })

    const ended = await player.endCapture('drag-1')
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.events[0]?.data).toMatchObject({
      captureState: { x: 104, y: 60 },
      style: {
        x: { from: 80, to: 104 },
        y: { from: 72, to: 60 },
      },
    })
    expect(player.resolveSceneAt(0).storyStates.main).toEqual({ draggableX: 104, draggableY: 60 })
    expect(player.resolveSceneAt(0).persos['main:draggable']?.state.style).toMatchObject({ x: 104, y: 60 })
    expect(player.trackJournal.getStateUpdates('story', 'main', 0)).toContainEqual(expect.objectContaining({
      update: { draggableX: 104, draggableY: 60 },
    }))
    player.destroy()
  })
})

import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../../../src/app/controller/controller-machine'
import { TempEditorScenePersistence } from '../../../src/app/persistence/temp-editor-scene-store'
import type { EditorScene } from '../../../src/app/commands/types'

const storageKey = 'codplay.editor.temp-scenes.v1'

/** Creates isolated browser storage for one persistence boundary test. */
function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      values.set(key, value)
    },
  }
}

/** Creates the minimal JSON document used by the controller-to-storage path. */
function sceneFixture(): EditorScene {
  return {
    id: 'persist-keyframe',
    meta: {
      title: 'Persist keyframe',
      durationMs: 5000,
      durationSource: 'arbitrary',
      timeUnit: 's',
      capsuleOrder: 'forward',
    },
    items: [{
      id: 'item',
      type: 'text',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: 'decor-initial',
      keyframes: [{ id: 'kf-0', timeMs: 0, decorId: 'decor-initial' }],
    }],
    contents: {},
    decors: { 'decor-initial': { id: 'decor-initial' } },
    zones: {},
    markerTracks: {},
  }
}

describe('temporary EditorScene persistence', () => {
  it('persists a keyframe created without a name through the controller command', () => {
    const actor = createActor(controllerMachine)
    const storage = memoryStorage()
    const persistence = new TempEditorScenePersistence(() => storage)
    actor.start()
    persistence.attach(actor)

    try {
      const scene = sceneFixture()
      actor.send({ type: 'SCENE_LOADED', scene })
      actor.send({
        type: 'RUN_COMMAND',
        command: {
          name: 'createNamedKeyframe',
          args: { itemId: 'item', keyframeId: 'kf-1', timeMs: 1000 },
        },
      })

      expect(persistence.getStatus().kind).toBe('ready')
      const stored = JSON.parse(storage.getItem(storageKey)!) as { scenes: Record<string, EditorScene> }
      const createdKeyframe = stored.scenes[scene.id]!.items[0]!.keyframes[1]!
      expect(createdKeyframe).not.toHaveProperty('name')
    } finally {
      persistence.destroy()
      actor.stop()
    }
  })
})

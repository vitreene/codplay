import { afterEach, describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { controllerMachine } from '../../../src/app/controller/controller-machine'
import { EditorScenePersistence } from '../../../src/app/persistence/editor-scene-persistence'
import type { EditorScene } from '../../../src/app/commands/types'
import { createEditorSceneApiRouter } from '../../../src/server/projects/editor-scene-api-router'
import { openEditorDatabase } from '../../../src/server/projects/sqlite/editor-database'
import { SqliteEditorScenePersistence } from '../../../src/server/projects/sqlite/sqlite-editor-scene-persistence'
import type { SqliteDatabase } from 'remix/data-table/sqlite'

describe('EditorScenePersistence', () => {
  let database: SqliteDatabase | undefined
  let actor: ReturnType<typeof createActor<typeof controllerMachine>> | undefined
  let persistence: EditorScenePersistence | undefined

  afterEach(async () => {
    persistence?.destroy()
    actor?.stop()
    vi.restoreAllMocks()
    await database?.close()
    database = undefined
    persistence = undefined
    actor = undefined
  })

  it('coalesces pending snapshots per scene and flushes the latest revision', async () => {
    database = await openEditorDatabase(':memory:')
    const router = createEditorSceneApiRouter(new SqliteEditorScenePersistence(database))
    let signalFirstRequest!: () => void
    const firstRequestStarted = new Promise<void>((resolve) => { signalFirstRequest = resolve })
    let releaseFirstRequest!: () => void
    const firstRequestGate = new Promise<void>((resolve) => { releaseFirstRequest = resolve })
    const writes: Array<{ scene: EditorScene; expectedRevision: number | null }> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = input instanceof Request
        ? new Request(input, init)
        : new Request(new URL(String(input), 'http://editor.test'), init)
      if (request.method === 'PUT' && new URL(request.url).pathname.startsWith('/api/scenes/')) {
        writes.push(await request.clone().json() as { scene: EditorScene; expectedRevision: number | null })
        if (writes.length === 1) {
          signalFirstRequest()
          await firstRequestGate
        }
      }
      return router.fetch(request)
    })

    actor = createActor(controllerMachine)
    actor.start()
    persistence = new EditorScenePersistence()
    persistence.attach(actor)
    actor.send({ type: 'SCENE_LOADED', scene: sceneFixture() })
    await firstRequestStarted

    for (const color of ['red', 'blue', 'gold']) {
      actor.send({
        type: 'RUN_TRANSACTION',
        commands: [{ name: 'setDecor', args: { decorId: 'root-decor', patch: { style: { color } } } }],
      })
    }
    expect(writes).toHaveLength(1)

    releaseFirstRequest()
    await persistence.flush()

    expect(writes.map((write) => write.expectedRevision)).toEqual([null, 0])
    expect(writes[1]?.scene.decors['root-decor']?.style).toEqual({ color: 'gold' })
    const stored = await router.fetch(new Request('http://editor.test/api/scenes/coalesced-scene'))
    const result = await stored.json() as { scene: EditorScene; revision: number }
    expect(result.scene.decors['root-decor']?.style).toEqual({ color: 'gold' })
    expect(result.revision).toBe(1)
  })
})

/** Creates the smallest valid document needed to exercise serialized scene writes. */
function sceneFixture(): EditorScene {
  return {
    id: 'coalesced-scene',
    meta: {
      title: 'Coalesced scene',
      durationMs: 1000,
      durationSource: 'arbitrary',
      timeUnit: 'ms',
      capsuleOrder: 'forward',
    },
    items: [],
    contents: {},
    decors: { 'root-decor': { id: 'root-decor', style: { color: 'black' } } },
    zones: {},
    markerTracks: {},
    rootDecorId: 'root-decor',
  }
}

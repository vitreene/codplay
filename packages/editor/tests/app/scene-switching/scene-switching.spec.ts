/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'remix/component/test'
import { jsx } from 'remix/component/jsx-runtime'
import { createActor } from 'xstate'
import { resolve } from 'node:path'
import { createSqliteDatabase } from 'remix/data-table/sqlite'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { controllerMachine } from '../../../src/app/controller/controller-machine'
import { EditorActionsFacade } from '../../../src/app/facades/editor-actions-facade'
import { EditorMenuRegion } from '../../../src/app/layout/editor-menu-region'
import { EditorScenePersistence } from '../../../src/app/persistence/editor-scene-persistence'
import type { EditorScene } from '../../../src/app/commands/types'
import { createEditorSceneApiRouter } from '../../../src/server/projects/editor-scene-api-router'
import { SqliteEditorScenePersistence } from '../../../src/server/projects/sqlite/sqlite-editor-scene-persistence'

/** Creates independent catalogue documents for the real menu and SQLite path. */
function sceneFixture(id: string, title: string): EditorScene {
  return {
    id,
    meta: { title, durationMs: 2_000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    items: [],
    contents: {},
    decors: { root: { id: 'root', style: { color: 'black' } } },
    rootDecorId: 'root',
    zones: {},
    markerTracks: {},
  }
}

describe('scene catalogue switching', () => {
  let database: ReturnType<typeof createSqliteDatabase>
  let repository: SqliteEditorScenePersistence
  let persistence: EditorScenePersistence
  let actor: ReturnType<typeof createActor<typeof controllerMachine>>
  let actions: EditorActionsFacade
  let view: ReturnType<typeof render>
  let stopController: () => void
  let stopPersistence: () => void
  let interceptRequest: ((request: Request) => Promise<void>) | undefined
  const requests: string[] = []

  beforeEach(async () => {
    database = createSqliteDatabase({ filename: ':memory:', foreignKeys: true })
    await database.migrate(await loadMigrations(resolve('src/server/projects/sqlite/migrations')))
    repository = new SqliteEditorScenePersistence(database)
    await repository.saveScene(sceneFixture('alpha', 'Alpha'), null)
    await repository.saveScene(sceneFixture('beta', 'Beta'), null)
    const router = createEditorSceneApiRouter(repository)
    requests.length = 0
    interceptRequest = undefined
    // Browser-relative requests need a transport boundary in jsdom; every response uses the real API and SQLite.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const request = new Request(new URL(String(input), 'http://editor.test'), init)
      requests.push(`${request.method} ${new URL(request.url).pathname}`)
      await interceptRequest?.(request)
      return router.fetch(request)
    })

    actor = createActor(controllerMachine).start()
    actions = new EditorActionsFacade(actor)
    persistence = new EditorScenePersistence()
    const initialScene = await persistence.open()
    persistence.attach(actor)
    actions.loadScene(initialScene!)
    view = render(menu())
    const subscription = actor.subscribe(() => view.root.render(menu()))
    stopController = () => subscription.unsubscribe()
    stopPersistence = persistence.subscribe(() => view.root.render(menu()))
  })

  afterEach(async () => {
    await persistence.flush()
    stopController()
    stopPersistence()
    view.cleanup()
    persistence.destroy()
    actions.destroy()
    actor.stop()
    vi.restoreAllMocks()
    await database.close()
  })

  /** Renders the menu from the same controller and persistence snapshots as AppLayout. */
  function menu() {
    return jsx(EditorMenuRegion, {
      controller: actor,
      actions,
      persistence,
      scene: actor.getSnapshot().context.scene,
      history: actions.getHistoryState(),
    })
  }

  /** Sends the selector's actual change event through its mounted Remix handler. */
  function chooseScene(sceneId: string): void {
    const picker = view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')!
    picker.value = sceneId
    picker.dispatchEvent(new Event('change', { bubbles: true }))
    view.root.flush()
  }

  it('keeps the native selector aligned with the loaded scene across renders and return visits', async () => {
    expect(view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.value).toBe('beta')
    chooseScene('alpha')
    await expect.poll(() => actor.getSnapshot().context.currentSceneId).toBe('alpha')
    await persistence.flush()
    view.root.flush()

    expect(view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.value).toBe('alpha')
    expect(await repository.findActiveSceneId()).toBe('alpha')

    chooseScene('beta')
    await expect.poll(() => actor.getSnapshot().context.currentSceneId).toBe('beta')
    await persistence.flush()
    view.root.flush()
    expect(view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.value).toBe('beta')
    expect(await repository.findActiveSceneId()).toBe('beta')
  })

  it('commits pending edits and drains delayed writes before loading or activating the next scene', async () => {
    let releaseWrite!: () => void
    const writeGate = new Promise<void>((resolve) => { releaseWrite = resolve })
    let signalWrite!: () => void
    const writeStarted = new Promise<void>((resolve) => { signalWrite = resolve })
    interceptRequest = async (request) => {
      if (request.method !== 'PUT' || !request.url.endsWith('/api/scenes/beta')) return
      signalWrite()
      await writeGate
    }
    actions.runCommand({ name: 'setDecor', args: { decorId: 'root', patch: { style: { color: 'blue' } } } })
    await writeStarted
    const pendingEdit = actor.on('flushPending', () => {
      actions.runCommand({ name: 'setDecor', args: { decorId: 'root', patch: { style: { color: 'gold' } } } })
    })

    try {
      chooseScene('alpha')
      await Promise.resolve()
      expect(actor.getSnapshot().context.currentSceneId).toBe('beta')
      expect(requests).not.toContain('GET /api/scenes/alpha')
      expect(view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.disabled).toBe(true)
    } finally {
      pendingEdit.unsubscribe()
      releaseWrite()
    }

    await expect.poll(() => actor.getSnapshot().context.currentSceneId).toBe('alpha')
    await persistence.flush()
    view.root.flush()
    expect((await repository.findScene('beta'))?.scene.decors.root?.style?.color).toBe('gold')
    expect(await repository.findActiveSceneId()).toBe('alpha')
    expect(actions.getHistoryState()).toEqual({ canUndo: false, canRedo: false })

    chooseScene('beta')
    await expect.poll(() => actor.getSnapshot().context.currentSceneId).toBe('beta')
    await persistence.flush()
    expect(actor.getSnapshot().context.scene?.decors.root?.style?.color).toBe('gold')
    expect(await repository.findActiveSceneId()).toBe('beta')
  })

  it('keeps the current scene and reports a revision conflict before any target load', async () => {
    await repository.saveScene(sceneFixture('beta', 'Beta elsewhere'), 0)
    actions.runCommand({ name: 'setDecor', args: { decorId: 'root', patch: { style: { color: 'gold' } } } })
    chooseScene('alpha')
    await persistence.flush()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    view.root.flush()

    expect(persistence.getStatus().kind).toBe('error')
    expect(actor.getSnapshot().context.currentSceneId).toBe('beta')
    expect(actor.getSnapshot().context.scene?.decors.root?.style?.color).toBe('gold')
    expect(requests).not.toContain('GET /api/scenes/alpha')
    expect(view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.value).toBe('beta')
  })

  it('waits for activation before allowing another catalogue change', async () => {
    let releaseActivation!: () => void
    const activationGate = new Promise<void>((resolve) => { releaseActivation = resolve })
    let signalActivation!: () => void
    const activationStarted = new Promise<void>((resolve) => { signalActivation = resolve })
    interceptRequest = async (request) => {
      if (request.method !== 'PUT' || !request.url.endsWith('/api/active-scene')) return
      signalActivation()
      await activationGate
    }

    try {
      chooseScene('alpha')
      await activationStarted
      view.root.flush()
      expect(view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.disabled).toBe(true)
      chooseScene('beta')
      expect(actor.getSnapshot().context.currentSceneId).toBe('alpha')
    } finally {
      releaseActivation()
    }

    await expect.poll(async () => {
      view.root.flush()
      return view.container.querySelector<HTMLSelectElement>('#editor-scene-picker')?.disabled
    }).toBe(false)
    expect(await repository.findActiveSceneId()).toBe('alpha')
  })
})

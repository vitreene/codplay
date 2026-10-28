import { run } from 'remix/spa'
import { createActor } from 'xstate'
import { createEmptyEditorScene } from './scenes/editor-scene'
import { controllerMachine } from './controller/controller-machine'
import { EditorActionsFacade } from './facades/editor-actions-facade'
import { EditorScenePersistence } from './persistence/editor-scene-persistence'
import { createEditorSpaRouter } from './remix/editor-spa-router'

/** Creates and disposes the single editor actor, persistence adapter, and Remix SPA runtime. */
async function startEditor(): Promise<void> {
  const persistence = new EditorScenePersistence()
  const persistedScene = await persistence.open()
  const controller = createActor(controllerMachine)
  controller.start()

  const actions = new EditorActionsFacade(controller)
  persistence.attach(controller)
  actions.loadScene(persistedScene ?? createEmptyEditorScene('Scène de travail'))

  const runtime = run(createEditorSpaRouter(controller, actions, persistence), {
    fallback: <p id="editor-remix-loading" role="status">Chargement de l’éditeur…</p>,
  })
  await runtime.ready()

  const dispose = async (): Promise<void> => {
    await persistence.flush()
    runtime.dispose()
    persistence.destroy()
    actions.destroy()
    controller.stop()
  }
  window.addEventListener('pagehide', () => void dispose(), { once: true })
}

void startEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur a échoué.', error)
})

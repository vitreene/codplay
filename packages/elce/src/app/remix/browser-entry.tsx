import { run } from 'remix/spa'

import { createActor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import { POPUP_PREVIEW_PROJECT_PARAM, POPUP_PREVIEW_SESSION_PARAM } from '../player/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'
import { ProjectSessionCoordinator } from '../projects/project-session-coordinator'

/** Composes one authoring actor, store, persistence attachment, and Remix router. */
async function startRemixEditor(): Promise<void> {
  const searchParams = new URLSearchParams(window.location.search)
  const isPreviewReader = searchParams.has(POPUP_PREVIEW_SESSION_PARAM)
    || searchParams.has(POPUP_PREVIEW_PROJECT_PARAM)
  const documentStore = isPreviewReader ? null : new IndexedDbDocumentStore()
  if (documentStore !== null) {
    try {
      await documentStore.deleteOrphanedMedia()
    } catch (error) {
      console.error('Le nettoyage des médias locaux Elcé a échoué.', error)
    }
  }
  const projectApi = isPreviewReader ? null : new ElceProjectApiClient()
  const projectSession = documentStore === null || projectApi === null
    ? null
    : new ProjectSessionCoordinator(documentStore, projectApi)
  const controller = documentStore === null
    ? null
    : createActor(controllerMachine, { input: { documentStore, projectSession: projectSession ?? undefined } })
  const editorActions = controller === null ? null : new EditorActionsFacade(controller)
  controller?.start()

  if (controller !== null && projectSession !== null && editorActions !== null) {
    await projectSession.attach(controller)
    editorActions.bootstrapProjects(projectSession.rememberedProjectId())
  }

  const runtime = run(createElceSpaRouter(controller, editorActions), {
    fallback: <p
      id="elce-remix-loading"
      role="status"
    >
      Chargement de l’éditeur…
    </p>,
  })
  await runtime.ready()

  const dispose = (): void => {
    void (projectSession?.dispose() ?? Promise.resolve()).finally(() => {
      controller?.stop()
      runtime.dispose()
    })
  }
  window.addEventListener('pagehide', dispose, { once: true })
}

void startRemixEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur Elcé a échoué.', error)
})

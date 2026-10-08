import { run } from 'remix/spa'
import { jsx } from 'remix/ui/jsx-runtime'
import { createActor } from 'xstate'
import { mountElceEditor } from '../main'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import { POPUP_PREVIEW_SESSION_PARAM } from '../player/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'
import { ProjectSessionCoordinator } from '../projects/project-session-coordinator'

/** Composes one authoring actor, store, persistence attachment, and Remix router. */
async function startRemixEditor(): Promise<void> {
  const isPopupPlayer = new URLSearchParams(window.location.search).has(POPUP_PREVIEW_SESSION_PARAM)
  const documentStore = isPopupPlayer ? null : new IndexedDbDocumentStore()
  const projectApi = isPopupPlayer ? null : new ElceProjectApiClient()
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
    fallback: jsx('p', {
      id: 'elce-remix-loading',
      role: 'status',
      children: 'Chargement de l’éditeur…',
    }),
  })
  await runtime.ready()

  const host = document.getElementById('elce-react-temp-host')
  if (controller !== null && editorActions !== null && host === null) {
    throw new Error('Remix did not render the temporary Elcé editor host.')
  }

  const disposeEditor = host === null
    ? () => {}
    : mountElceEditor(host, controller, editorActions, { hideHeader: true, surface: 'remix-page-work-area' })
  window.addEventListener('pagehide', () => {
    void projectSession?.dispose().finally(() => {
      disposeEditor()
      controller?.stop()
      runtime.dispose()
    })
  }, { once: true })
}

void startRemixEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur Elcé a échoué.', error)
})

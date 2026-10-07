import { run } from 'remix/spa'
import { jsx } from 'remix/ui/jsx-runtime'
import { createActor } from 'xstate'
import type { Actor } from 'xstate'
import { mountElceEditor } from '../main'
import { attachDocumentPersistence } from '../controller/document-persistence'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { ElceProjectApiClient } from '../../infrastructure/project-api/project-api-client'
import type { AttachedDocumentPersistence } from '../controller/document-persistence'
import { POPUP_PREVIEW_SESSION_PARAM } from '../player/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'
import { ProjectSyncCoordinator } from '../sync/project-sync-coordinator'
import { ProjectEditorLock } from '../sync/project-editor-lock'

/** Composes one authoring actor, store, persistence attachment, and Remix router. */
async function startRemixEditor(): Promise<void> {
  const isPopupPlayer = new URLSearchParams(window.location.search).has(POPUP_PREVIEW_SESSION_PARAM)
  const documentStore = isPopupPlayer ? null : new IndexedDbDocumentStore()
  const controller = documentStore === null
    ? null
    : createActor(controllerMachine, { input: { documentStore } })
  const editorActions = controller === null ? null : new EditorActionsFacade(controller)
  controller?.start()

  let disposed = false
  let persistence: AttachedDocumentPersistence | undefined
  let projectSync: ProjectSyncCoordinator | undefined
  let editorLock: ProjectEditorLock | undefined
  if (controller !== null && documentStore !== null) {
    const projectApi = new ElceProjectApiClient()
    projectSync = new ProjectSyncCoordinator(controller, documentStore, projectApi)
    await projectSync.suspend()
    editorLock = new ProjectEditorLock(controller.getSnapshot().context.document.id, {
      onAccessWaiting: () => controller.send({ type: 'editor.access.suspend' }),
      onAccessGranted: async () => {
        if (persistence === undefined) {
          persistence = await attachDocumentPersistence(controller, documentStore, {
            mediaSourceUrl: (documentId, mediaId) => projectApi.mediaUrl(documentId, mediaId),
            onLocalSave: (document) => projectSync?.schedule(document),
          })
        } else {
          await persistence.restoreCurrentDocument()
        }
        if (disposed) throw new Error('La fenêtre Elcé se ferme avant la reprise de l’édition.')
        controller.send({ type: 'editor.access.activate' })
        projectSync?.resume(controller.getSnapshot().context.document)
      },
      onAccessSuspending: async () => {
        controller.send({ type: 'editor.access.suspend' })
        await projectSync?.suspend()
        await waitForControllerQuiescence(controller)
        await persistence?.flushLocalChanges()
      },
      onAccessError: (error) => console.error('Le verrou d’édition Elcé n’a pas pu être transféré.', error),
    })
    editorLock.start()
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
  if (!host) throw new Error('Remix did not render the temporary Elcé editor host.')

  const disposeEditor = mountElceEditor(host, controller, editorActions)
  window.addEventListener('pagehide', () => {
    disposed = true
    void editorLock?.stop().finally(() => {
      disposeEditor()
      persistence?.detach()
      projectSync?.destroy()
      controller?.stop()
      runtime.dispose()
    })
  }, { once: true })
}

/** Waits until any accepted XState document changes have reached local persistence. */
function waitForControllerQuiescence(controller: Actor<typeof controllerMachine>): Promise<void> {
  const isQuiescent = () => controller.getSnapshot().matches('suspended')
    && controller.getSnapshot().context.documentChanges.length === 0
  if (isQuiescent()) return Promise.resolve()

  return new Promise((resolve) => {
    let unsubscribe = () => {}
    const subscription = controller.subscribe(() => {
      if (!isQuiescent()) return
      unsubscribe()
      resolve()
    })
    unsubscribe = () => subscription.unsubscribe()
    if (isQuiescent()) {
      unsubscribe()
      resolve()
    }
  })
}

void startRemixEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur Elcé a échoué.', error)
})

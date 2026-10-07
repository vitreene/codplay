import { run } from 'remix/spa'
import { jsx } from 'remix/ui/jsx-runtime'
import { createActor } from 'xstate'
import { mountElceEditor } from '../main'
import { attachDocumentPersistence } from '../controller/document-persistence'
import { controllerMachine } from '../controller/controller-machine'
import { IndexedDbDocumentStore } from '../../infrastructure/indexed-db/document-store'
import { POPUP_PREVIEW_SESSION_PARAM } from '../player/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'

/** Composes one authoring actor, store, persistence attachment, and Remix router. */
async function startRemixEditor(): Promise<void> {
  const isPopupPlayer = new URLSearchParams(window.location.search).has(POPUP_PREVIEW_SESSION_PARAM)
  const documentStore = isPopupPlayer ? null : new IndexedDbDocumentStore()
  const controller = documentStore === null
    ? null
    : createActor(controllerMachine, { input: { documentStore } })
  controller?.start()

  let disposed = false
  let detachPersistence: (() => void) | undefined
  if (controller !== null && documentStore !== null && 'indexedDB' in globalThis) {
    void attachDocumentPersistence(controller, documentStore)
      .then((detach) => {
        if (disposed) detach()
        else detachPersistence = detach
      })
      .catch((error: unknown) => {
        console.error('La sauvegarde IndexedDB Elcé a échoué.', error)
      })
  }

  const runtime = run(createElceSpaRouter(controller), {
    fallback: jsx('p', {
      id: 'elce-remix-loading',
      role: 'status',
      children: 'Chargement de l’éditeur…',
    }),
  })
  await runtime.ready()

  const host = document.getElementById('elce-react-temp-host')
  if (!host) throw new Error('Remix did not render the temporary Elcé editor host.')

  const disposeEditor = mountElceEditor(host, controller)
  window.addEventListener('pagehide', () => {
    disposed = true
    disposeEditor()
    detachPersistence?.()
    controller?.stop()
    runtime.dispose()
  }, { once: true })
}

void startRemixEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur Elcé a échoué.', error)
})

import { createRoot } from 'react-dom/client'
import { createActor } from 'xstate'
import { attachDocumentPersistence } from './controller/document-persistence'
import { controllerMachine } from './controller/controller-machine'
import { AppLayout } from './layout/AppLayout'
import { PopupPlayer } from './player/popup-player'
import { POPUP_PREVIEW_PAGE_PARAM, POPUP_PREVIEW_SESSION_PARAM } from './player/popup-preview-messages'
import { IndexedDbDocumentStore } from '../infrastructure/indexed-db/document-store'

const container = document.getElementById('elce-app')
if (!container) {
  throw new Error('Elcé mount point #elce-app is missing.')
}

const params = new URLSearchParams(window.location.search)
const sessionId = params.get(POPUP_PREVIEW_SESSION_PARAM)
const root = createRoot(container)

if (sessionId !== null) {
  document.title = 'Elcé — lecture'
  root.render(<PopupPlayer sessionId={sessionId} startPageId={params.get(POPUP_PREVIEW_PAGE_PARAM)} />)
} else {
  const documentStore = new IndexedDbDocumentStore()
  const controller = createActor(controllerMachine, { input: { documentStore } })
  controller.start()
  root.render(<AppLayout controller={controller} />)

  if ('indexedDB' in globalThis) {
    void attachDocumentPersistence(controller, documentStore).catch((error: unknown) => {
      console.error('La sauvegarde IndexedDB Elcé a échoué.', error)
    })
  }
}

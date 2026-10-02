import { createRoot } from 'react-dom/client'
import { createActor } from 'xstate'
import { attachDocumentPersistence } from './controller/document-persistence'
import { controllerMachine } from './controller/controller-machine'
import { AppLayout } from './layout/AppLayout'
import { IndexedDbDocumentStore } from '../infrastructure/indexed-db/document-store'

const documentStore = new IndexedDbDocumentStore()
const controller = createActor(controllerMachine, { input: { documentStore } })
controller.start()

const container = document.getElementById('elce-app')
if (!container) {
  throw new Error('Elcé mount point #elce-app is missing.')
}

createRoot(container).render(<AppLayout controller={controller} />)

if ('indexedDB' in globalThis) {
  void attachDocumentPersistence(controller, documentStore).catch((error: unknown) => {
    console.error('La sauvegarde IndexedDB Elcé a échoué.', error)
  })
}

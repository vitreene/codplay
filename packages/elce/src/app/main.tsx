import { createRoot } from 'react-dom/client'
import { createActor } from 'xstate'
import { controllerMachine } from './controller/controller-machine'
import { AppLayout } from './layout/AppLayout'

const controller = createActor(controllerMachine)
controller.start()

const container = document.getElementById('elce-app')
if (!container) {
  throw new Error('Elcé mount point #elce-app is missing.')
}

createRoot(container).render(<AppLayout controller={controller} />)

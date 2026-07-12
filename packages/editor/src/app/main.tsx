import { createActor } from 'xstate'
import { createRoot } from 'react-dom/client'
import { controllerMachine } from './controller/controller-machine'
import { AppLayout } from './layout/AppLayout'

const controller = createActor(controllerMachine)
controller.start()

const container = document.getElementById('app')!
createRoot(container).render(<AppLayout controller={controller} />)

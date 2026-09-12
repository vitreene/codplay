import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { createDemo1Controls } from './page-controls'
import { createDemo1Composition } from './sighty-composition'

import '../../v2/layout/layout.css'
import '../scenes.css'
import './style.css'

/** Registers demo 1 as a scenario module consumed by the shared Sighty page. */
export const demo1: SightyDemoDefinition = {
  id: 'demo1',
  title: 'Démo 1 · A / B',
  create: ({ stage, onLog }) => {
    const sighty = createDemo1Composition({ stage, onLog })
    const { runtime } = sighty

    return {
      transport: createSightyTransport(runtime),
      initialize: async () => {
        await runtime.initialize()
        await runtime.playAll()
      },
      createOptionalControls: (container) => createDemo1Controls({ container, runtime, onLog }),
      destroy: () => runtime.destroy(),
    }
  },
}

export { createDemo1Composition }

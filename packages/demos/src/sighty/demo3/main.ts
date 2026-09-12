import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { createDemo3Controls } from './page-controls'
import { SightyComposition } from './sighty-composition'

import '../scenes.css'
import './style.css'

/** Registers demo 3 as the Sighty data-injection scenario. */
export const demo3: SightyDemoDefinition = {
  id: 'demo3',
  title: 'Démo 3 · injection',
  create: ({ stage, onLog }) => {
    const composition = new SightyComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime),
      initialize: () => composition.initialize(),
      createOptionalControls: (container) => createDemo3Controls({
        container,
        injectTextColor: (colorName) => composition.injectTextColor(colorName),
        onLog,
      }),
      destroy: () => composition.destroy(),
    }
  },
}

export { SightyComposition }

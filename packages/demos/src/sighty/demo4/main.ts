import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { SightyComposition } from './sighty-composition'

import '../scenes.css'
import './style.css'

/** Registers demo 4 as the Sighty menu and scene-navigation scenario. */
export const demo4: SightyDemoDefinition = {
  id: 'demo4',
  title: 'Démo 4 · navigation',
  create: ({ stage, onLog }) => {
    const composition = new SightyComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime, {
        commandSceneKeys: () => composition.getGeneralControlSceneKeys(),
      }),
      initialize: () => composition.initialize(),
      destroy: () => composition.destroy(),
    }
  },
}

export { SightyComposition }

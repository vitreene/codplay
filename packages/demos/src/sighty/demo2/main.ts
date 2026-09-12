import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { SightyComposition } from './sighty-composition'

import '../scenes.css'
import './style.css'

/** Registers demo 2 as a message scenario consumed by the shared Sighty page. */
export const demo2: SightyDemoDefinition = {
  id: 'demo2',
  title: 'Démo 2 · scène B',
  create: ({ stage, onLog }) => {
    const composition = new SightyComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime),
      initialize: () => composition.initialize(),
      destroy: () => composition.destroy(),
    }
  },
}

export { SightyComposition }

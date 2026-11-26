import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { ViewTransitionComposition } from './composition'

import '../demo4/style.css'
import './style.css'

/** Registers the isolated browser View Transitions proof of concept. */
export const viewTransitionsDemo: SightyDemoDefinition = {
  id: 'view-transitions',
  title: 'View Transitions · POC',
  create: ({ stage, onLog }) => {
    const composition = new ViewTransitionComposition(stage, onLog)
    return {
      transport: createSightyTransport(composition.runtime),
      initialize: () => composition.initialize(),
      destroy: () => composition.destroy(),
    }
  },
}

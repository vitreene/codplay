import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { createReplaceSlotComposition } from './composition'

import '../scenes.css'
import './style.css'

/** Registers the linear replace review with Demo 4's controls and shared remote. */
export const replaceSlotDemo: SightyDemoDefinition = {
  id: 'replace-slot',
  title: 'Replace · scènes et slots Sighty',
  create: ({ stage, onLog }) => {
    const composition = createReplaceSlotComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime),
      initialize: composition.initialize,
      destroy: composition.destroy,
    }
  },
}

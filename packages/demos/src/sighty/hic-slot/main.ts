import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { createHicSlotComposition } from './composition'

import '../scenes.css'
import '../replace-slot/style.css'

/** Registers the slot review of every HTML-in-Canvas effect with Demo 4's controls. */
export const hicSlotDemo: SightyDemoDefinition = {
  id: 'hic-slot',
  title: 'Replace · effets HTML-in-Canvas · slot',
  create: ({ stage, onLog }) => {
    const composition = createHicSlotComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime),
      initialize: composition.initialize,
      destroy: composition.destroy,
    }
  },
}

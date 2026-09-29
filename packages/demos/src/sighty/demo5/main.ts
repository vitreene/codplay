import { createSightyTransport } from '../layout/transport'
import type { SightyDemoDefinition } from '../layout/types'
import { CourseComposition } from './course-composition'

import '../scenes.css'
import './style.css'

/** Registers the independent scroll-course scenario in the shared Sighty page. */
export const demo5: SightyDemoDefinition = {
  id: 'demo5',
  title: 'Démo 5 · cours scrollable',
  create: ({ stage, onLog }) => {
    const composition = new CourseComposition({ stage, onLog })
    return {
      transport: createSightyTransport(composition.runtime, {
        commandSceneKeys: () => composition.getGeneralControlSceneKeys(),
      }),
      initialize: () => composition.initialize(),
      destroy: () => composition.destroy(),
    }
  },
}

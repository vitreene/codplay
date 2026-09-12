import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'

/** Declares the main scene and the command scene slots for demo 3. */
export const layoutScene: SceneDoc<string> = {
  id: 'sighty-demo3-layout-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'layout-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo3-layout`,
            markup: `
              <main id="demo3-layout-root" class="demo3-layout">
                <section id="demo3-layout-scene-a" class="demo3-layout__scene" data-part="demo3:layout-scene-a" aria-label="Scène A"></section>
                <section id="demo3-layout-telco" class="demo3-layout__telco" data-part="demo3:layout-telco" aria-label="Commandes"></section>
              </main>
            `,
          },
          actions: {},
        },
        {
          id: 'layout-scene-a-slot',
          name: 'sceneA',
          type: 'slot',
          initial: {
            move: { target: 'demo3:layout-scene-a' },
            className: 'demo3-slot',
          },
          actions: {},
        },
        {
          id: 'layout-telco-slot',
          name: 'telco',
          type: 'slot',
          initial: {
            move: { target: 'demo3:layout-telco' },
            className: 'demo3-slot',
          },
          actions: {},
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'

/** Declares the layout slots that place scene B above the command scene. */
export const layoutScene: SceneDoc<string> = {
  id: 'sighty-demo2-layout-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'layout-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo2-layout`,
            markup: `
              <main class="demo2-layout">
                <section class="demo2-layout__scene" data-part="demo2:layout-scene-b" aria-label="Scene B"></section>
                <section class="demo2-layout__telco" data-part="demo2:layout-telco" aria-label="Commandes"></section>
              </main>
            `,
          },
          actions: {},
        },
        {
          id: 'layout-scene-b-slot',
          name: 'sceneB',
          type: 'slot',
          initial: {
            move: { target: 'demo2:layout-scene-b' },
            className: 'demo2-slot',
          },
          actions: {},
        },
        {
          id: 'layout-telco-slot',
          name: 'telco',
          type: 'slot',
          initial: {
            move: { target: 'demo2:layout-telco' },
            className: 'demo2-slot',
          },
          actions: {},
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

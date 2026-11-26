import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'

/** Declares a plain menu/page/telco layout with no CodPlay slot replacement. */
export const viewTransitionLayoutScene: SceneDoc<string> = {
  id: 'sighty-view-transition-layout-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'sighty-vt-layout-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-vt-layout`,
            markup: `
              <main id="sighty-vt-layout-root" class="sighty-vt-layout" aria-label="POC View Transitions">
                <section id="sighty-vt-menu-host" class="sighty-vt-layout__menu" data-part="sighty-vt:menu"></section>
                <section id="sighty-vt-page-host" class="sighty-vt-layout__page" data-part="sighty-vt:page"></section>
                <footer id="sighty-vt-telco-host" class="sighty-vt-layout__telco" data-part="sighty-vt:telco"></footer>
              </main>
            `,
          },
          actions: {},
        },
        {
          id: 'sighty-vt-menu-slot',
          name: 'slot-menu',
          type: 'slot',
          initial: { move: { target: 'sighty-vt:menu' }, className: 'sighty-vt-layout__menu-slot' },
          actions: {},
        },
        {
          id: 'sighty-vt-page-slot',
          name: 'slot-scene',
          type: 'slot',
          initial: { move: { target: 'sighty-vt:page' }, className: 'sighty-vt-layout__page-slot' },
          actions: {},
        },
        {
          id: 'sighty-vt-telco-slot',
          name: 'slot-telco',
          type: 'slot',
          initial: { move: { target: 'sighty-vt:telco' }, className: 'sighty-vt-layout__telco-slot' },
          actions: {},
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

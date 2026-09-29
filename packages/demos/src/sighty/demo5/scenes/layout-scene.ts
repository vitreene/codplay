import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'

/** Declares the four authored hosts for menu, title, lesson, and navigation. */
export const layoutScene: SceneDoc<string> = {
  id: 'sighty-demo5-layout-scene',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'demo5-course-layout',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo5-layout`,
            markup: `
              <main id="demo5-course-layout-root" class="demo5-layout">
                <aside id="demo5-course-menu-region" class="demo5-layout__menu" data-part="demo5:layout:menu" aria-label="Menu du cours"></aside>
                <header id="demo5-course-title-region" class="demo5-layout__title" data-part="demo5:layout:title" aria-label="Page courante"></header>
                <section id="demo5-course-content-region" class="demo5-layout__content" data-part="demo5:layout:content" aria-label="Contenu du cours"></section>
                <nav id="demo5-course-navigation-region" class="demo5-layout__navigation" aria-label="Navigation des pages">
                  <div id="demo5-course-navigation-host" class="demo5-layout__navigation-slot" data-part="demo5:layout:navigation"></div>
                </nav>
              </main>
            `,
          },
          actions: {},
        },
        createLayoutSlot('slot-menu', 'demo5:layout:menu', 'demo5-layout__menu-slot'),
        createLayoutSlot('slot-title', 'demo5:layout:title', 'demo5-layout__title-slot'),
        createLayoutSlot('slot-content', 'demo5:layout:content', 'demo5-layout__content-slot'),
        createLayoutSlot('slot-navigation', 'demo5:layout:navigation', 'demo5-layout__navigation-slot'),
      ],
    },
  },
}

/** Creates one named CodPlay slot in the matching layout region. */
function createLayoutSlot(name: string, target: string, className: string) {
  return {
    id: `demo5-${name}`,
    name,
    type: 'slot' as const,
    initial: { move: { target }, className },
    actions: {},
  }
}

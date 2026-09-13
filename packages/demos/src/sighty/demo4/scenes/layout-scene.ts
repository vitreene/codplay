import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import {
  createLayoutCarouselItem,
  DEMO4_LAYOUT_CAROUSEL,
  DEMO4_LAYOUT_CAROUSEL_EVENTS,
  DEMO4_LAYOUT_CAROUSEL_VIEWPORT_TARGET,
  DEMO4_LAYOUT_ITEM_IDS,
} from '../carousel'

/** Declares one layout occurrence with two carousel items and two slot persos. */
export const layoutScene: SceneDoc<string> = {
  id: 'sighty-demo4-layout-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'demo4-layout-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo4-layout`,
            markup: `
              <main id="demo4-layout-root" class="demo4-layout">
                <div id="demo4-layout-carousel" class="${DEMO4_LAYOUT_CAROUSEL.capsule.className}" data-part="${DEMO4_LAYOUT_CAROUSEL_VIEWPORT_TARGET}" aria-label="Présentation"></div>
              </main>
            `,
          },
          actions: {},
        },
        createLayoutCarouselItem(
          DEMO4_LAYOUT_ITEM_IDS.menu,
          `
            <section id="demo4-layout-menu-item" class="demo4-layout__carousel-item" aria-label="Sommaire">
              <!-- data-part="demo4:layout-menu-scene" -->
            </section>
          `,
        ),
        createLayoutCarouselItem(
          DEMO4_LAYOUT_ITEM_IDS.chapter,
          `
            <section id="demo4-layout-chapter-item" class="demo4-layout__carousel-item demo2-layout" aria-label="Scènes du chapitre">
              <!-- data-part="demo4:layout-chapter-scene" -->
              <!-- data-part="demo4:layout-chapter-telco" -->
            </section>
          `,
        ),
        {
          id: 'demo4-layout-scene-slot',
          name: 'slot-scene',
          type: 'slot',
          initial: {
            move: { target: 'demo4:layout-menu-scene' },
            className: 'demo2-slot demo2-layout__scene',
            replace: { transition: 'fade', duration: 1000 },
          },
          actions: {
            [DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS.menu].enter]: {
              move: { target: 'demo4:layout-menu-scene' },
            },
            [DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS.chapter].enter]: {
              move: { target: 'demo4:layout-chapter-scene' },
            },
          },
        },
        {
          id: 'demo4-layout-telco-slot',
          name: 'slot-telco',
          type: 'slot',
          initial: {
            move: { target: 'demo4:layout-chapter-telco' },
            className: 'demo2-slot demo4-layout__chapter-telco-slot',
          },
          actions: {},
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

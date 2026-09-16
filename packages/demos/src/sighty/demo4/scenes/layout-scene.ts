import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import {
  createLayoutCarouselItem,
  createMenuCarouselSlot,
  DEMO4_LAYOUT_CAROUSEL,
  DEMO4_LAYOUT_CAROUSEL_VIEWPORT_TARGET,
  DEMO4_LAYOUT_ITEM_IDS,
} from '../carousel'

/** Declares one layout occurrence with two carousel items and separate menu/chapter hosts. */
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
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo4-layout ${DEMO4_LAYOUT_CAROUSEL.capsule.className}`,
            markup: `
              <main id="demo4-layout-root" class="demo4-layout" data-part="${DEMO4_LAYOUT_CAROUSEL_VIEWPORT_TARGET}" aria-label="Présentation"></main>
            `,
          },
          actions: {},
        },
        createMenuCarouselSlot(),
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
          id: 'demo4-layout-chapter-scene-slot',
          name: 'slot-scene',
          type: 'slot',
          initial: {
            move: { target: 'demo4:layout-chapter-scene' },
            className: 'demo2-slot demo2-layout__scene',
            replace: { transition: 'fade', duration: 1000 },
          },
          actions: {},
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

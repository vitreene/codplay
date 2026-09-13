import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import { DEMO4_MENU_INTENTS } from '../messages'

/** Declares direct access buttons for the three content scenes. */
export const menuScene: SceneDoc<string> = {
  id: 'sighty-demo4-menu-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'demo4-menu-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo4-menu`,
            markup: `
              <section id="demo4-menu-root" class="demo4-menu">
                <h2 id="demo4-menu-heading" class="demo4-menu__heading">MENU</h2>
                <div id="demo4-menu-buttons" class="demo4-menu__buttons" data-part="demo4:menu-buttons"></div>
              </section>
            `,
          },
          actions: {},
        },
        {
          id: 'demo4-menu-scene-a',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Scène A',
            className: 'demo4-menu__button demo4-menu__button--a',
            attr: { type: 'button' },
            move: { target: 'demo4:menu-buttons' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_MENU_INTENTS.sceneA,
                visibility: 'public',
              },
            },
          },
          actions: {},
        },
        {
          id: 'demo4-menu-scene-b',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Scène B',
            className: 'demo4-menu__button demo4-menu__button--b',
            attr: { type: 'button' },
            move: { target: 'demo4:menu-buttons' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_MENU_INTENTS.sceneB,
                visibility: 'public',
              },
            },
          },
          actions: {},
        },
        {
          id: 'demo4-menu-scene-c',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Scène C',
            className: 'demo4-menu__button demo4-menu__button--c',
            attr: { type: 'button' },
            move: { target: 'demo4:menu-buttons' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_MENU_INTENTS.sceneC,
                visibility: 'public',
              },
            },
          },
          actions: {},
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

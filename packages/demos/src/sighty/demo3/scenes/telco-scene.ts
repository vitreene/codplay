import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import {
  DEMO3_CONTENT_INTENTS,
  DEMO3_CONTENT_VALUES,
} from '../messages'

/** Declares the scene-owned buttons that emit text payloads publicly. */
export const telcoScene: SceneDoc<string> = {
  id: 'sighty-demo3-telco-scene',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'telco-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo3-telco`,
            markup: `
              <section id="demo3-telco-root" class="demo3-telco">
                <div id="demo3-telco-buttons" class="demo3-telco__buttons" data-part="demo3:telco-buttons"></div>
                <p id="demo3-telco-status" class="demo3-telco__status" data-part="demo3:telco-status"></p>
              </section>
            `,
          },
          actions: {},
        },
        {
          id: 'telco-content-first',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Texte 1',
            className: 'demo3-telco__button demo3-telco__button--first',
            attr: { type: 'button' },
            move: { target: 'demo3:telco-buttons' },
          },
          emit: {
            click: {
              event: {
                name: DEMO3_CONTENT_INTENTS.first,
                visibility: 'public',
                data: { content: DEMO3_CONTENT_VALUES.first },
              },
            },
          },
          actions: {},
        },
        {
          id: 'telco-content-second',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Texte 2',
            className: 'demo3-telco__button demo3-telco__button--second',
            attr: { type: 'button' },
            move: { target: 'demo3:telco-buttons' },
          },
          emit: {
            click: {
              event: {
                name: DEMO3_CONTENT_INTENTS.second,
                visibility: 'public',
                data: { content: DEMO3_CONTENT_VALUES.second },
              },
            },
          },
          actions: {},
        },
        {
          id: 'telco-status',
          type: 'tag',
          initial: {
            tag: 'span',
            content: 'Aucun texte envoyé',
            className: 'demo3-telco__status-text',
            move: { target: 'demo3:telco-status' },
          },
          actions: {
            [DEMO3_CONTENT_INTENTS.first]: { content: 'Texte 1 envoyé' },
            [DEMO3_CONTENT_INTENTS.second]: { content: 'Texte 2 envoyé' },
          },
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

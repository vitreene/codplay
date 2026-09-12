import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import { TELCO_INTENTS } from '../messages'

/** Creates the CodPlay scene that emits one public intention per command button. */
export const telcoScene: SceneDoc<string> = {
  id: 'sighty-demo2-telco-scene',
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
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo2-telco`,
            markup: `
              <section class="demo2-telco">
                <div class="demo2-telco__buttons" data-part="demo2:telco-buttons"></div>
                <div class="demo2-telco__status" data-part="demo2:telco-status"></div>
              </section>
            `,
          },
          actions: {},
        },
        {
          id: 'telco-play',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Lire',
            className: 'demo2-telco__button demo2-telco__button--play',
            attr: { type: 'button' },
            move: { target: 'demo2:telco-buttons' },
          },
          emit: {
            click: {
              event: {
                name: TELCO_INTENTS.play,
                visibility: 'public',
                data: { command: 'play' },
              },
            },
          },
          actions: {},
        },
        {
          id: 'telco-pause',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Pause',
            className: 'demo2-telco__button demo2-telco__button--pause',
            attr: { type: 'button' },
            move: { target: 'demo2:telco-buttons' },
          },
          emit: {
            click: {
              event: {
                name: TELCO_INTENTS.pause,
                visibility: 'public',
                data: { command: 'pause' },
              },
            },
          },
          actions: {},
        },
        {
          id: 'telco-replay',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Rejouer',
            className: 'demo2-telco__button demo2-telco__button--replay',
            attr: { type: 'button' },
            move: { target: 'demo2:telco-buttons' },
          },
          emit: {
            click: {
              event: {
                name: TELCO_INTENTS.replay,
                visibility: 'public',
                data: { command: 'replay' },
              },
            },
          },
          actions: {},
        },
        {
          id: 'telco-status',
          type: 'tag',
          initial: {
            tag: 'p',
            content: 'Aucune intention envoyée',
            className: 'demo2-telco__status-text',
            move: { target: 'demo2:telco-status' },
          },
          actions: {
            [TELCO_INTENTS.play]: { content: 'Intention « Lire » envoyée' },
            [TELCO_INTENTS.pause]: { content: 'Intention « Pause » envoyée' },
            [TELCO_INTENTS.replay]: { content: 'Intention « Rejouer » envoyée' },
          },
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

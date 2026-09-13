import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import {
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_PLAYBACK_INTENTS,
  DEMO4_PLAYBACK_STATE_EVENTS,
  DEMO4_PROGRESS_INTENTS,
  DEMO4_PROGRESS_STATE_EVENTS,
  DEMO4_TELCO_STATE_EVENTS,
} from '../messages'

/** Declares navigation and playback commands for the currently selected scene. */
export const telcoScene: SceneDoc<string> = {
  id: 'sighty-demo4-telco-scene',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'demo4-telco-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo4-telco`,
            markup: `
              <section id="demo4-telco-root" class="demo4-telco">
                <div id="demo4-telco-controls" class="demo4-telco__controls" data-part="demo4:telco-controls"></div>
              </section>
            `,
          },
          actions: {},
        },
        {
          id: 'demo4-telco-previous',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Précédente',
            className: 'demo4-telco__button demo4-telco__button--previous',
            attr: { type: 'button', disabled: true },
            move: { target: 'demo4:telco-controls' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_NAVIGATION_INTENTS.previous,
                visibility: 'public',
              },
            },
          },
          actions: {
            [DEMO4_TELCO_STATE_EVENTS.enable]: { attr: { disabled: false } },
            [DEMO4_TELCO_STATE_EVENTS.disable]: { attr: { disabled: true } },
          },
        },
        {
          id: 'demo4-telco-next',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Suivante',
            className: 'demo4-telco__button demo4-telco__button--next',
            attr: { type: 'button', disabled: true },
            move: { target: 'demo4:telco-controls' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_NAVIGATION_INTENTS.next,
                visibility: 'public',
              },
            },
          },
          actions: {
            [DEMO4_TELCO_STATE_EVENTS.enable]: { attr: { disabled: false } },
            [DEMO4_TELCO_STATE_EVENTS.disable]: { attr: { disabled: true } },
          },
        },
        {
          id: 'demo4-telco-toggle',
          type: 'tag',
          initial: {
            tag: 'button',
            content: '▶',
            className: 'demo4-telco__button demo4-telco__button--toggle',
            attr: {
              type: 'button',
              disabled: true,
              'aria-label': 'Lire la scène',
              title: 'Lire',
            },
            move: { target: 'demo4:telco-controls' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_PLAYBACK_INTENTS.toggle,
                visibility: 'public',
              },
            },
          },
          actions: {
            [DEMO4_TELCO_STATE_EVENTS.enable]: { attr: { disabled: false } },
            [DEMO4_TELCO_STATE_EVENTS.disable]: {
              content: '▶',
              attr: {
                disabled: true,
                'aria-label': 'Lire la scène',
                title: 'Lire',
              },
            },
            [DEMO4_PLAYBACK_STATE_EVENTS.playing]: {
              content: '⏸',
              attr: {
                disabled: false,
                'aria-label': 'Mettre la scène en pause',
                title: 'Pause',
              },
            },
            [DEMO4_PLAYBACK_STATE_EVENTS.paused]: {
              content: '▶',
              attr: {
                disabled: false,
                'aria-label': 'Lire la scène',
                title: 'Lire',
              },
            },
          },
        },
        {
          id: 'demo4-telco-rewind',
          type: 'tag',
          initial: {
            tag: 'button',
            content: '↺',
            className: 'demo4-telco__button demo4-telco__button--rewind',
            attr: {
              type: 'button',
              disabled: true,
              'aria-label': 'Revenir au début de la scène',
              title: 'Revenir au début',
            },
            move: { target: 'demo4:telco-controls' },
          },
          emit: {
            click: {
              event: {
                name: DEMO4_PLAYBACK_INTENTS.rewind,
                visibility: 'public',
              },
            },
          },
          actions: {
            [DEMO4_TELCO_STATE_EVENTS.enable]: { attr: { disabled: false } },
            [DEMO4_TELCO_STATE_EVENTS.disable]: { attr: { disabled: true } },
          },
        },
        {
          id: 'demo4-telco-status',
          type: 'tag',
          initial: {
            tag: 'span',
            content: 'Menu',
            className: 'demo4-telco__status-text',
            move: { target: 'demo4:telco-controls' },
          },
          actions: {
            [DEMO4_TELCO_STATE_EVENTS.enable]: { content: 'Navigation active' },
            [DEMO4_TELCO_STATE_EVENTS.disable]: { content: 'Menu' },
            [DEMO4_NAVIGATION_INTENTS.previous]: { content: 'Scène précédente' },
            [DEMO4_NAVIGATION_INTENTS.next]: { content: 'Scène suivante' },
            [DEMO4_PLAYBACK_INTENTS.toggle]: { content: 'Lecture / pause' },
            [DEMO4_PLAYBACK_INTENTS.rewind]: { content: 'Retour au début' },
          },
        },
        {
          id: 'demo4-telco-progress',
          type: 'input',
          initial: {
            inputType: 'range',
            id: 'demo4-telco-progress-control',
            value: 0,
            min: 0,
            max: 10_000,
            step: 10,
            label: 'Progression',
            hint: '',
            className: 'demo4-telco__progress',
            move: { target: 'demo4:telco-controls' },
          },
          emit: {
            input: {
              event: {
                name: DEMO4_PROGRESS_INTENTS.seek,
                visibility: 'public',
              },
            },
          },
          actions: {
            [DEMO4_PROGRESS_STATE_EVENTS.update]: null,
            [DEMO4_TELCO_STATE_EVENTS.enable]: { disabled: false, value: 0 },
            [DEMO4_TELCO_STATE_EVENTS.disable]: { disabled: true, value: 0 },
          },
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

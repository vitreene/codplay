import type { SceneDoc } from 'codplay/scene/types'
import { COURSE_EVENTS, COURSE_PRESENTATION_EVENTS } from '../messages'

/** Shows both direction buttons and the current page count in one scene. */
export const navigationScene: SceneDoc<string> = {
  id: 'sighty-demo5-navigation-scene',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'demo5-navigation-controls',
          type: 'layout',
          initial: {
            move: '@root',
            className: 'demo5-navigation',
            markup: `<div id="demo5-navigation-controls-root" class="demo5-navigation">
              <div id="demo5-navigation-previous-host" data-part="demo5:navigation:previous"></div>
              <div id="demo5-navigation-status-host" data-part="demo5:navigation:status"></div>
              <div id="demo5-navigation-next-host" data-part="demo5:navigation:next"></div>
            </div>`,
          },
          actions: {},
        },
        {
          id: 'demo5-navigation-previous',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Précédent',
            attr: { type: 'button', disabled: true },
            className: 'demo5-navigation__button',
            move: { target: 'demo5:navigation:previous' },
          },
          emit: { click: { event: { name: COURSE_EVENTS.previous, visibility: 'public' } } },
          actions: {
            [COURSE_PRESENTATION_EVENTS.navigationPrevious]: {
              attr: { type: 'button', disabled: true },
            },
          },
        },
        {
          id: 'demo5-navigation-status',
          type: 'tag',
          initial: {
            tag: 'p',
            content: '',
            className: 'demo5-navigation__status-text',
            move: { target: 'demo5:navigation:status' },
          },
          actions: {
            [COURSE_PRESENTATION_EVENTS.navigationStatus]: null,
          },
        },
        {
          id: 'demo5-navigation-next',
          type: 'tag',
          initial: {
            tag: 'button',
            content: 'Suivant',
            attr: { type: 'button', disabled: true },
            className: 'demo5-navigation__button demo5-navigation__button--next',
            move: { target: 'demo5:navigation:next' },
          },
          emit: { click: { event: { name: COURSE_EVENTS.next, visibility: 'public' } } },
          actions: {
            [COURSE_PRESENTATION_EVENTS.navigationNext]: {
              attr: { type: 'button', disabled: true },
            },
          },
        },
      ],
    },
  },
}

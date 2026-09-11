import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../scene-root-capsule'

/** Declarative scene A with a title fade-in and a ten-second image zoom. */
export const sceneA: SceneDoc<string> = {
  id: 'sighty-scene-a',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'scene-a-shell',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-scene-a`,
            markup: `
              <article class="sighty-scene-a">
                <div class="sighty-scene-a__image-outlet" data-part="scene-a:image"></div>
                <div class="sighty-scene-a__title-outlet" data-part="scene-a:title"></div>
              </article>
            `,
          },
          actions: {},
        },
        {
          id: 'scene-a-image',
          type: 'img',
          initial: {
            src: '/assets/35c8ec5a07fc.jpg',
            alt: 'Paysage utilisé par la scène A',
            className: 'sighty-scene-a__image',
            style: { opacity: 0, scale: 1 },
            img: {
              className: 'sighty-scene-a__image-native',
              style: { objectFit: 'cover' },
              attr: { draggable: 'false' },
            },
            move: { target: 'scene-a:image' },
          },
          actions: {
            'scene-a:show-image': {
              style: {
                opacity: { from: 0, to: 1, duration: 700, ease: 'outCubic' },
                scale: { from: 1, to: 1.2, duration: 10_000, ease: 'linear' },
              },
            },
          },
        },
        {
          id: 'scene-a-title',
          type: 'tag',
          initial: {
            tag: 'h2',
            content: 'Scène A',
            className: 'sighty-scene-a__title',
            style: { opacity: 0 },
            move: { target: 'scene-a:title' },
          },
          actions: {
            'scene-a:show-title': {
              style: {
                opacity: { from: 0, to: 1, duration: 650, ease: 'outCubic' },
              },
            },
          },
        },
      ],
      eventimes: [
        { name: 'scene-a:show-image', startAt: 0 },
        { name: 'scene-a:show-title', startAt: 850 },
      ],
    },
  },
  eventimes: [{ name: 'sequence:end', startAt: 10_000 }],
  listen: [],
  tracks: {},
}

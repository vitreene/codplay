import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'

/** Declarative scene B that changes its displayed number once per second. */
export const sceneB: SceneDoc<string> = {
  id: 'sighty-scene-b',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'scene-b-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-scene-b`,
            markup: `
              <section class="sighty-scene-b">
                <p class="sighty-scene-b__eyebrow">SCÈNE B · TIMELINE INDÉPENDANTE</p>
                <div class="sighty-scene-b__number-outlet" data-part="scene-b:number"></div>
                <p class="sighty-scene-b__caption">Un changement à chaque seconde</p>
              </section>
            `,
          },
          actions: {},
        },
        {
          id: 'scene-b-number',
          type: 'tag',
          initial: {
            tag: 'strong',
            content: '1',
            className: 'sighty-scene-b__number',
            move: { target: 'scene-b:number' },
          },
          actions: {
            'scene-b:number-2': { content: '2' },
            'scene-b:number-3': { content: '3' },
            'scene-b:number-4': { content: '4' },
            'scene-b:number-5': { content: '5' },
            'scene-b:number-6': { content: '6' },
            'scene-b:number-7': { content: '7' },
            'scene-b:number-8': { content: '8' },
            'scene-b:number-9': { content: '9' },
            'scene-b:number-10': { content: '10' },
          },
        },
      ],
      eventimes: [
        { name: 'scene-b:number-2', startAt: 1_000 },
        { name: 'scene-b:number-3', startAt: 2_000 },
        { name: 'scene-b:number-4', startAt: 3_000 },
        { name: 'scene-b:number-5', startAt: 4_000 },
        { name: 'scene-b:number-6', startAt: 5_000 },
        { name: 'scene-b:number-7', startAt: 6_000 },
        { name: 'scene-b:number-8', startAt: 7_000 },
        { name: 'scene-b:number-9', startAt: 8_000 },
        { name: 'scene-b:number-10', startAt: 9_000 },
      ],
    },
  },
  eventimes: [{ name: 'sequence:end', startAt: 10_000 }],
  listen: [],
  tracks: {},
}

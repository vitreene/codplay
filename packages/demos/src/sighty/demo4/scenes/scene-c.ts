import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'
import { DEMO4_SCENARIO_EVENTS } from '../messages'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const

/** Declares scene C with the same timed progression as scene B, using letters. */
export const sceneC: SceneDoc<string> = {
  id: 'sighty-demo4-scene-c',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'demo4-scene-c-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} demo4-scene-c`,
            markup: `
              <section id="demo4-scene-c-root" class="demo4-scene-c">
                <p id="demo4-scene-c-eyebrow" class="demo4-scene-c__eyebrow">SCÈNE C · LETTRES</p>
                <div id="demo4-scene-c-letter-outlet" class="demo4-scene-c__letter-outlet" data-part="demo4:scene-c-letter"></div>
                <p id="demo4-scene-c-caption" class="demo4-scene-c__caption">Une lettre à chaque seconde</p>
              </section>
            `,
          },
          actions: {},
        },
        {
          id: 'demo4-scene-c-letter',
          type: 'tag',
          initial: {
            tag: 'strong',
            content: LETTERS[0],
            className: 'demo4-scene-c__letter',
            move: { target: 'demo4:scene-c-letter' },
          },
          actions: Object.fromEntries(
            LETTERS.slice(1).map((letter) => [`demo4:scene-c:letter-${letter.toLowerCase()}`, { content: letter }]),
          ),
        },
      ],
      eventimes: LETTERS.slice(1).map((letter, index) => ({
        name: `demo4:scene-c:letter-${letter.toLowerCase()}`,
        startAt: (index + 1) * 1_000,
      })),
    },
  },
  eventimes: [{ name: DEMO4_SCENARIO_EVENTS.sequenceEnd, startAt: 10_000, visibility: 'public' }],
  listen: [],
  tracks: {},
}

import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule'

/** Declares the initial page displayed before one of the three examples is selected. */
export const viewTransitionIntroScene: SceneDoc<string> = {
  id: 'sighty-view-transition-intro-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'sighty-vt-intro-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-vt-intro`,
            markup: `
              <section id="sighty-vt-intro-root" class="sighty-vt-intro">
                <p id="sighty-vt-intro-eyebrow" class="sighty-vt-intro__eyebrow">VIEW TRANSITIONS API</p>
                <h2 id="sighty-vt-intro-title" class="sighty-vt-intro__title">Choisissez une page</h2>
                <p id="sighty-vt-intro-caption" class="sighty-vt-intro__caption">Chaque sélection essaie un effet différent.</p>
              </section>
            `,
          },
          actions: {},
        },
      ],
    },
  },
  listen: [],
  tracks: {},
}

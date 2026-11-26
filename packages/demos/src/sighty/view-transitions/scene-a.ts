import type { SceneDoc } from 'codplay/scene/types'
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../scene-root-capsule'

/** Declares an image-led page that gives the browser transition a clear visual subject. */
export const viewTransitionSceneA: SceneDoc<string> = {
  id: 'sighty-view-transition-scene-a',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'view-transition-scene-a-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-vt-scene-a`,
            markup: `
              <article id="sighty-vt-scene-a-root" class="sighty-vt-scene-a">
                <img id="sighty-vt-scene-a-image" class="sighty-vt-scene-a__image" src="/assets/28970388742_2f75d527d6_z.jpg" alt="Étiquette illustrée japonaise ancienne" />
                <div id="sighty-vt-scene-a-copy" class="sighty-vt-scene-a__copy">
                  <p id="sighty-vt-scene-a-eyebrow" class="sighty-vt-scene-a__eyebrow">PAGE A · PAYSAGE</p>
                  <h2 id="sighty-vt-scene-a-title" class="sighty-vt-scene-a__title">Changer de point de vue</h2>
                  <p id="sighty-vt-scene-a-caption" class="sighty-vt-scene-a__caption">Une image du dossier public partagé pour éprouver la transition sur un visuel détaillé.</p>
                </div>
              </article>
            `,
          },
          actions: {},
        },
      ],
    },
  },
  eventimes: [{ name: 'sequence:end', startAt: 4_000, visibility: 'public' }],
  listen: [],
  tracks: {},
}

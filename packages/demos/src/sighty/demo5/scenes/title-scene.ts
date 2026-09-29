import type { SceneDoc } from 'codplay/scene/types'
import { COURSE_PRESENTATION_EVENTS } from '../messages'

/** Displays the title delivered from the current Sighty page selection. */
export const titleScene: SceneDoc<string> = {
  id: 'sighty-demo5-title-scene',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'demo5-current-title',
          type: 'tag',
          initial: {
            tag: 'h1',
            content: 'Titre en attente',
            className: 'demo5-title',
            move: '@root',
          },
          actions: { [COURSE_PRESENTATION_EVENTS.title]: { content: 'Titre en attente' } },
        },
      ],
    },
  },
}

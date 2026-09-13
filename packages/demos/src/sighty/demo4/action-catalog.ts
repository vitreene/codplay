import type { SightyActionCatalog, SightyActionContext } from '@codplay/sighty'
import {
  DEMO4_LAYOUT_CAROUSEL_EVENTS,
  DEMO4_LAYOUT_ITEM_IDS,
} from './carousel'
import type { SightyDemo4SceneKey } from './sighty-file'

const LAYOUT_SCENE_KEY = 'scene-layout' as const
const LAYOUT_STORY_ID = 'main' as const

/** Creates one action that moves the layout carousel between its two layout persos. */
function createLayoutCarouselAction(
  leavingItemId: keyof typeof DEMO4_LAYOUT_ITEM_IDS,
  enteringItemId: keyof typeof DEMO4_LAYOUT_ITEM_IDS,
) {
  return async ({ send }: SightyActionContext<SightyDemo4SceneKey>) => {
    await send(
      LAYOUT_SCENE_KEY,
      { name: DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS[leavingItemId]].leave },
      { scope: 'story', storyId: LAYOUT_STORY_ID },
    )
    await send(
      LAYOUT_SCENE_KEY,
      { name: DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS[enteringItemId]].enter },
      { scope: 'story', storyId: LAYOUT_STORY_ID },
    )
  }
}

/** Maps Demo 4 scenario references to actions sent to the layout scene. */
export const actionCatalog: SightyActionCatalog<SightyDemo4SceneKey> = {
  'demo4:enter-chapter': createLayoutCarouselAction('menu', 'chapter'),
  'demo4:return-menu': createLayoutCarouselAction('chapter', 'menu'),
}

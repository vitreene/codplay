import { ELCE_SCENARIO } from '../../config/document-config'

export type ElceSceneKey =
  | typeof ELCE_SCENARIO.LAYOUT_SCENE
  | typeof ELCE_SCENARIO.MENU_SCENE
  | typeof ELCE_SCENARIO.TITLE_SCENE
  | typeof ELCE_SCENARIO.NAVIGATION_SCENE
  | `scene-${string}`

export type ElceSlotName =
  | typeof ELCE_SCENARIO.MENU_SLOT
  | typeof ELCE_SCENARIO.TITLE_SLOT
  | typeof ELCE_SCENARIO.CONTENT_SLOT
  | typeof ELCE_SCENARIO.NAVIGATION_SLOT

/** Namespace used by every event authored by the position demonstration. */
export const POSITION_NAMESPACE = 'position:demo'

/** Stable scene and story identities consumed by the V2 demo layout. */
export const POSITION_SCENE_ID = 'position-v2-scene'
export const POSITION_STORY_ID = 'main'

/** Shared carousel targets mounted by the story shell. */
export const POSITION_CAROUSEL_ID = 'position-carousel'
export const POSITION_VIEWPORT_TARGET = 'position:carousel:viewport'
export const POSITION_STATUS_TARGET = 'position:carousel:status'
export const POSITION_NOTICE_TARGET = 'position:carousel:notice'
export const POSITION_KEYBOARD_TARGET = 'position:carousel:keyboard'

/** Keyboard and story-state events kept local to the position scene. */
export const POSITION_KEYBOARD_NAVIGATION_EVENT = `${POSITION_NAMESPACE}:keyboard:navigate`
export const POSITION_KEYBOARD_TOGGLE_EVENT = `${POSITION_NAMESPACE}:keyboard:toggle`
export const POSITION_STORY_PAUSED_EVENT = `${POSITION_NAMESPACE}:story:paused`
export const POSITION_STORY_RESUMED_EVENT = `${POSITION_NAMESPACE}:story:resumed`
export const POSITION_TWEEN_STOP_EVENT = 'tween:stop'

/** Story-three capture and move events. */
export const POSITION_PATH_CAPTURE_EVENT = `${POSITION_NAMESPACE}:path:captured`
export const POSITION_PATH_CONTROL_LIVE_EVENT = `${POSITION_NAMESPACE}:path:control:live`
export const POSITION_PATH_CONTROL_SETTLED_EVENT = `${POSITION_NAMESPACE}:path:control:settled`
export const POSITION_PATH_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:path:item:move`

/** Story-four capture and live move events. */
export const POSITION_LIVE_SOURCE_RELEASED_EVENT = `${POSITION_NAMESPACE}:live:source:released`
export const POSITION_LIVE_TARGET_RELEASED_EVENT = `${POSITION_NAMESPACE}:live:target:released`
export const POSITION_LIVE_SOURCE_DRAG_EVENT = `${POSITION_NAMESPACE}:live:source:drag`
export const POSITION_LIVE_TARGET_DRAG_EVENT = `${POSITION_NAMESPACE}:live:target:drag`
export const POSITION_LIVE_SOURCE_SETTLED_EVENT = `${POSITION_NAMESPACE}:live:source:settled`
export const POSITION_LIVE_TARGET_SETTLED_EVENT = `${POSITION_NAMESPACE}:live:target:settled`
export const POSITION_LIVE_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:live:item:move`

/** Fixed story-two events for its moving anchors and item. */
export const POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:2:source:shift`
export const POSITION_VIEW_TWO_TARGET_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:2:target:shift`
export const POSITION_VIEW_TWO_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:view:2:move`

/** Fixed story-one, story-five and story-six move events. */
export const POSITION_VIEW_ONE_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:view:1:move`
export const POSITION_VIEW_FIVE_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:view:5:move`

/** Number and timing of the authored carousel views. */
export const VIEW_IDS = [
  'position-view-one',
  'position-view-two',
  'position-view-three',
  'position-view-four',
  'position-view-five',
  'position-view-six',
] as const
export const VIEW_COUNT = VIEW_IDS.length
export const VIEW_DURATION_MS = 5_000
export const CAROUSEL_AUTHORING_HORIZON_MS = VIEW_COUNT * VIEW_DURATION_MS
export const CAROUSEL_SLIDE_DURATION_MS = 300
export const CAROUSEL_SLIDE_OFFSET_PX = 320

/** The single transition convention used by every item reparenting. */
export const POSITION_MOVE_DURATION_MS = 2_000
export const FIRST_VIEW_MOVE_OFFSET_MS = 1_000

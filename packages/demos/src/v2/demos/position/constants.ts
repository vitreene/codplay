/** Namespace used by every event authored by the position demonstration. */
export const POSITION_NAMESPACE = 'position:demo'

/** Stable scene and story identities consumed by the V2 demo layout. */
export const POSITION_SCENE_ID = 'position-v2-scene'
export const POSITION_MAIN_STORY_ID = 'main'
export const POSITION_STORY_ONE_ID = 'position-story-one'
export const POSITION_STORY_TWO_ID = 'position-story-two'
export const POSITION_STORY_THREE_ID = 'position-story-three'
export const POSITION_STORY_FOUR_ID = 'position-story-four'
export const POSITION_STORY_FIVE_ID = 'position-story-five'
export const POSITION_STORY_SIX_ID = 'position-story-six'

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
export const POSITION_STORY_END_EVENT = `${POSITION_NAMESPACE}:story:end`
export const POSITION_TWEEN_STOP_EVENT = 'tween:stop'

/** Story-three initialization, selection, and move events. */
export const POSITION_PATH_INITIALIZE_EVENT = `${POSITION_NAMESPACE}:path:initialize`
export const POSITION_PATH_STRAIGHT_SELECT_EVENT = `${POSITION_NAMESPACE}:path:select:straight`
export const POSITION_PATH_QUADRATIC_SELECT_EVENT = `${POSITION_NAMESPACE}:path:select:quadratic`
export const POSITION_PATH_BROKEN_SELECT_EVENT = `${POSITION_NAMESPACE}:path:select:broken`
export const POSITION_PATH_LOOP_SELECT_EVENT = `${POSITION_NAMESPACE}:path:select:loop`
export const POSITION_PATH_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:path:item:move`

/** Story-four capture and live move events, keyed by physical container. */
export const POSITION_LIVE_A_RELEASED_EVENT = `${POSITION_NAMESPACE}:live:a:released`
export const POSITION_LIVE_B_RELEASED_EVENT = `${POSITION_NAMESPACE}:live:b:released`
export const POSITION_LIVE_A_DRAG_EVENT = `${POSITION_NAMESPACE}:live:a:drag`
export const POSITION_LIVE_B_DRAG_EVENT = `${POSITION_NAMESPACE}:live:b:drag`
export const POSITION_LIVE_A_SETTLED_EVENT = `${POSITION_NAMESPACE}:live:a:settled`
export const POSITION_LIVE_B_SETTLED_EVENT = `${POSITION_NAMESPACE}:live:b:settled`
export const POSITION_LIVE_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:live:item:move`
export const POSITION_LIVE_INITIALIZE_EVENT = `${POSITION_NAMESPACE}:live:initialize`

/** Fixed story-two events for its moving anchors and item. */
export const POSITION_VIEW_TWO_SOURCE_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:2:source:shift`
export const POSITION_VIEW_TWO_TARGET_SHIFT_EVENT = `${POSITION_NAMESPACE}:view:2:target:shift`
export const POSITION_VIEW_TWO_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:view:2:move`

/** Fixed story-one, story-five and story-six move events. */
export const POSITION_VIEW_ONE_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:view:1:move`
export const POSITION_VIEW_FIVE_ITEM_MOVE_EVENT = `${POSITION_NAMESPACE}:view:5:move`
export const POSITION_VIEW_FIVE_INITIALIZE_EVENT = `${POSITION_NAMESPACE}:view:5:initialize`
export const POSITION_VIEW_SIX_INITIALIZE_EVENT = `${POSITION_NAMESPACE}:view:6:initialize`

/** Straps owned by the position scene or by its individual stories. */
export const POSITION_KEYBOARD_NAVIGATION_STRAP = `${POSITION_NAMESPACE}:keyboard:navigate`
export const POSITION_KEYBOARD_TOGGLE_STRAP = `${POSITION_NAMESPACE}:keyboard:toggle`
export const POSITION_PATH_SELECT_STRAP = `${POSITION_NAMESPACE}:path:select`
export const POSITION_LIVE_BOUNCE_START_STRAP = `${POSITION_NAMESPACE}:live:start`
export const POSITION_LIVE_A_COMMIT_STRAP = `${POSITION_NAMESPACE}:live:a:commit`
export const POSITION_LIVE_B_COMMIT_STRAP = `${POSITION_NAMESPACE}:live:b:commit`
export const POSITION_LIVE_ITEM_MOVE_STATE_STRAP = `${POSITION_NAMESPACE}:live:item:move:state`

/** Number and timing of the authored carousel views. */
export const VIEW_IDS = [
  'position-view-one',
  'position-view-two',
  'position-view-three',
  'position-view-four',
  'position-view-five',
  'position-view-six',
] as const

/** Presentation order of the position stories in the validation carousel. */
export const POSITION_VIEW_STORY_IDS = [
  POSITION_STORY_SIX_ID,
  POSITION_STORY_FOUR_ID,
  POSITION_STORY_TWO_ID,
  POSITION_STORY_ONE_ID,
  POSITION_STORY_THREE_ID,
  POSITION_STORY_FIVE_ID,
] as const

/** Stable root identity belonging to each story, independent of carousel order. */
export const POSITION_STORY_VIEW_IDS = {
  [POSITION_STORY_ONE_ID]: VIEW_IDS[0],
  [POSITION_STORY_TWO_ID]: VIEW_IDS[1],
  [POSITION_STORY_THREE_ID]: VIEW_IDS[2],
  [POSITION_STORY_FOUR_ID]: VIEW_IDS[3],
  [POSITION_STORY_FIVE_ID]: VIEW_IDS[4],
  [POSITION_STORY_SIX_ID]: VIEW_IDS[5],
} as const

/** Stable story identity used when resolving plans and carousel events. */
export type PositionStoryId = typeof POSITION_VIEW_STORY_IDS[number]

export const VIEW_COUNT = VIEW_IDS.length
export const VIEW_DURATION_MS = 5_000
export const CAROUSEL_AUTHORING_HORIZON_MS = VIEW_COUNT * VIEW_DURATION_MS
export const CAROUSEL_SLIDE_DURATION_MS = 300
export const CAROUSEL_SLIDE_OFFSET_PX = 320

/** The single transition convention used by every item reparenting. */
export const POSITION_MOVE_DURATION_MS = 2_000
export const FIRST_VIEW_MOVE_OFFSET_MS = 1_000

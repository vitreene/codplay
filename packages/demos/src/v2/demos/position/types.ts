import type { AuthorListenTransform, CompiledRecord } from 'codplay'

/** Index of one view in the manually navigated carousel. */
export type ViewIndex = 0 | 1 | 2 | 3 | 4 | 5

/** The two semantic roles used by the source/target lesson views. */
export type AnchorRole = 'source' | 'target'

/** Point expressed in the local coordinate system of a position story. */
export type PositionPoint = Readonly<{ x: number; y: number }>

/** State owned by the single position story. */
export type PositionState = Readonly<{
  currentView: number
  storyPaused: boolean
  pathControlX: number
  pathControlY: number
  liveSourceX: number
  liveSourceY: number
  liveTargetX: number
  liveTargetY: number
}>

/** Small listen shape used while assembling the story-local event circuit. */
export type PositionListenRule = Readonly<{
  on: string
  transform?: readonly AuthorListenTransform[]
  straps?: readonly string[]
}>

/** Generated intro/outro event names for one carousel child. */
export type CarouselEventNames = Readonly<{
  intro: string
  outro: string
}>

/** One move event appended when a story view becomes active. */
export type StoryAnimationOccurrence = Readonly<{
  offsetMs: number
  name: string
  data?: CompiledRecord
}>

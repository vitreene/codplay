import type { CompiledRecord } from 'codplay'

/** Index of one view in the manually navigated carousel. */
export type ViewIndex = 0 | 1 | 2 | 3 | 4 | 5

/** The two semantic roles used by the source/target lesson views. */
export type AnchorRole = 'source' | 'target'

/** Point expressed in the local coordinate system of a position story. */
export type PositionPoint = Readonly<{ x: number; y: number }>

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

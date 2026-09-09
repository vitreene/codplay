import type { CompiledRecord } from 'codplay'

/** The two stable physical containers used by the live trajectory story. */
export type AnchorId = 'a' | 'b'

/** Point expressed in the local coordinate system of a position story. */
export type PositionPoint = Readonly<{ x: number; y: number }>

/** Generated intro/outro event names for one carousel child. */
export type CarouselEventNames = Readonly<{
  intro: string
  outro: string
  enter: string
  leave: string
  reset: string
}>

/** One move event appended when a story view becomes active. */
export type StoryAnimationOccurrence = Readonly<{
  offsetMs: number
  name: string
  data?: CompiledRecord
}>

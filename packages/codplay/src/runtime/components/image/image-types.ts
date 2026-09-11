import type { BaseComponentVisualData } from '../base-component'

/** Properties targeted at the persistent native image node. */
export type ImagePartState = BaseComponentVisualData

/** Initial author data accepted by the V2 `img` component. */
export type ImageInitial = BaseComponentVisualData & Readonly<{
  src?: string
  alt?: string
  img?: ImagePartState
  /** Optional shared simple replacement transition applied to the image wrapper. */
  replace?: ImageReplace
}>

/** Resolved state applied by one image update. */
export type ImageState = ImageInitial

/** Action patch accepted by one image perso. */
export type ImageAction = Partial<ImageInitial>

/** Simple replacement declaration supported by the shared image transition path. */
export type ImageReplace = 'fade' | Readonly<{
  transition: 'fade'
  duration?: number
}>

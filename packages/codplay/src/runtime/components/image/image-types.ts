import type { BaseComponentVisualData } from '../base-component'

/** Properties targeted at the persistent native image node. */
export type ImagePartState = BaseComponentVisualData

/** Initial author data accepted by the V2 `img` component. */
export type ImageInitial = BaseComponentVisualData & Readonly<{
  src?: string
  alt?: string
  img?: ImagePartState
}>

/** Resolved state applied by one image update. */
export type ImageState = ImageInitial

/** Action patch accepted by one image perso. */
export type ImageAction = Partial<ImageInitial>

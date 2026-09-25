import type { TagInitial } from 'codplay/runtime/components'
import type { AuthorScrollObservationDeclaration } from 'codplay/scene/capture'

/** Logical axis used by one scroll-progress provider. */
export type ScrollProgressAxis = 'block' | 'inline'

/** Initial profile for one optional HTML scrollport component. */
export type ScrollContainerInitial = Omit<TagInitial, 'content'> & Readonly<{
  values?: Readonly<{
    progress?: Readonly<{
      axis?: ScrollProgressAxis
      range?: 'scrollport'
    }>
  }>
}>

/** Public author type for one observed perso's geometric event declaration. */
export type ScrollObservationDeclaration = AuthorScrollObservationDeclaration

/** Optional runtime requirement that gates scenes using this component. */
export const SCROLL_CONTAINER_MODULE_SERVICE_ID = 'scroll-container' as const

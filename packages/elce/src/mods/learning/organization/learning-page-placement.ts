import type { ChapterId } from '../../../core/document/content-document-types'

export const PAGE_LOCATION = {
  CHAPTER: 'chapter',
  SCENARIO: 'scenario',
  CATALOG: 'catalog',
} as const

export type PageLocationKind = typeof PAGE_LOCATION[keyof typeof PAGE_LOCATION]

export type PagePlacement =
  | Readonly<{ kind: typeof PAGE_LOCATION.CHAPTER; chapterId: ChapterId; index?: number }>
  | Readonly<{ kind: typeof PAGE_LOCATION.SCENARIO; index?: number }>
  | Readonly<{ kind: typeof PAGE_LOCATION.CATALOG }>

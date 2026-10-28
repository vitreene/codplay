export type ChapterId = string
export type PageId = string
export type BdcId = string
export type MediaId = string

export interface ContentChapter {
  readonly id: ChapterId
  readonly name: string
  readonly type: string
  readonly pageIds: readonly PageId[]
}

export interface ContentPage {
  readonly id: PageId
  readonly name: string
  readonly type: string
  readonly chapterId: ChapterId | null
  readonly bdcIds: readonly BdcId[]
  readonly appearance?: AppearanceSettings
}

export interface ContentBdc {
  readonly id: BdcId
  readonly type: string
  readonly presetId: string
  readonly pageId: PageId | null
  readonly parentBdcId: BdcId | null
  readonly appearance?: AppearanceSettings
}

export interface MediaMetadata {
  readonly id: MediaId
  readonly name: string
  readonly mimeType: string
  readonly size: number
  readonly caption: string
}
import type { AppearanceSettings } from '../../config/appearance/appearance-types'


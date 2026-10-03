import { BDC_LOCATION, PAGE_LOCATION } from '../../config/document-config'
import type { BdcType, PageType } from '../../config/document-config-types'
import type { BdcId, Chapter, ChapterId, MediaId, MediaMetadata, PageId, RichTextDocument } from '../../domain/document-types'

export type PagePlacement =
  | Readonly<{ kind: typeof PAGE_LOCATION.CHAPTER; chapterId: ChapterId; index?: number }>
  | Readonly<{ kind: typeof PAGE_LOCATION.SCENARIO; index?: number }>
  | Readonly<{ kind: typeof PAGE_LOCATION.CATALOG }>

export type BdcPlacement =
  | Readonly<{ kind: typeof BDC_LOCATION.PAGE; pageId: PageId; index?: number }>
  | Readonly<{ kind: typeof BDC_LOCATION.CATALOG }>

export type CreatePageCommandInput = Readonly<{
  pageId: PageId
  bdcId: BdcId
  pageType?: PageType
  name?: string
  placement: PagePlacement
}>

export type DocumentCommand =
  | Readonly<{
      type: 'chapter.create'
      chapterId: ChapterId
      name: string
      chapterType?: Chapter['type']
    }>
  | Readonly<{ type: 'chapter.rename'; chapterId: ChapterId; name: string }>
  | Readonly<{ type: 'chapter.delete'; chapterId: ChapterId }>
  | (Readonly<{ type: 'page.create' }> & CreatePageCommandInput)
  | Readonly<{ type: 'page.rename'; pageId: PageId; name: string }>
  | Readonly<{ type: 'page.move'; pageId: PageId; placement: PagePlacement }>
  | Readonly<{ type: 'page.remove'; pageId: PageId }>
  | Readonly<{ type: 'page.delete'; pageId: PageId }>
  | Readonly<{
      type: 'bdc.create'
      bdcId: BdcId
      bdcType: BdcType
      presetId: string
      placement: BdcPlacement
      mediaId?: MediaId
    }>
  | Readonly<{ type: 'bdc.move'; bdcId: BdcId; placement: BdcPlacement }>
  | Readonly<{ type: 'bdc.remove'; bdcId: BdcId }>
  | Readonly<{ type: 'bdc.delete'; bdcId: BdcId }>
  | Readonly<{
      type: 'bdc.section.update'
      bdcId: BdcId
      title: string
      markup: string
      content: RichTextDocument
    }>
  | Readonly<{
      type: 'bdc.anchor.create'
      sectionBdcId: BdcId
      pageId: PageId
      bdcId: BdcId
      bdcType: Extract<BdcType, 'image' | 'video'>
      presetId: string
      media: MediaMetadata
      partId: string
      markup: string
      content: RichTextDocument
    }>
  | Readonly<{
      type: 'bdc.anchor.attach'
      sectionBdcId: BdcId
      pageId: PageId
      bdcId: BdcId
      markup: string
      content: RichTextDocument
    }>
  | Readonly<{
      type: 'bdc.anchor.move'
      sectionBdcId: BdcId
      anchorBdcId: BdcId
      markup: string
      content: RichTextDocument
    }>
  | Readonly<{
      type: 'bdc.anchor.remove'
      sectionBdcId: BdcId
      anchorBdcId: BdcId
      markup: string
      content: RichTextDocument
    }>
  | Readonly<{
      type: 'bdc.anchor.return'
      sectionBdcId: BdcId
      anchorBdcId: BdcId
      markup: string
      content: RichTextDocument
    }>
  | Readonly<{ type: 'media.add'; media: MediaMetadata }>
  | Readonly<{ type: 'media.merge'; canonicalMediaId: MediaId; duplicateMediaIds: readonly MediaId[] }>
  | Readonly<{ type: 'document.rename'; name: string }>

import type { BdcId, MediaMetadata, PageId } from '../../../core/document/content-document-types'
import type { RichTextDocument } from '../../bdcs/section/domain/section-types'
import type { SectionCommand } from '../../bdcs/section/authoring/section-command-types'

/** Commands that update an authored Section anchor and its resource placement. */
export type AnchorCommand =
  | Extract<SectionCommand, Readonly<{ type: 'bdc.section.update' }>>
  | Readonly<{
      type: 'bdc.anchor.create'
      sectionBdcId: BdcId
      pageId: PageId
      bdcId: BdcId
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

import type { BdcId } from '../../../core/document/content-document-types'
import type { RichTextDocument } from '../../../core/document/rich-text-types'
import type { ListContent } from '../domain/list-types'

/** Commands that insert or edit a standalone List BDC. */
export type ListCommand =
  | Readonly<{
      type: 'bdc.list.insert'
      bdcId: BdcId
      ownerBdcId: BdcId
      content: RichTextDocument
      markup?: string
      list: ListContent
    }>
  | Readonly<{ type: 'bdc.list.update'; bdcId: BdcId; list: ListContent }>

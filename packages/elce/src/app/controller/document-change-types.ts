import type { BdcId, MediaMetadata } from '../../domain/document/document-types'
import type { ElceSectionChange } from '../../domain/anchor/anchor-types'

export interface ElceAnchorChange {
  readonly sectionBdcId: string
  readonly change: ElceSectionChange
}

export type ElceDocumentChange =
  | Readonly<{ kind: 'anchor'; operation: ElceAnchorChange }>
  | Readonly<{ kind: 'question-media-import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'card-media-import'; bdcId: BdcId; file: File; media: MediaMetadata }>

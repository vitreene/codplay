import type { BdcId, MediaMetadata } from '../../domain/document/document-types'
import type { ElceSectionChange } from '../../domain/anchor/anchor-types'
import type { DocumentCommand, PagePlacement } from '../../domain/commands/document-command-types'
import type { PageType } from '../../config/document-config-types'
import type { SectionSelection } from '../history/document-history'

export interface ElceAnchorChange {
  readonly sectionBdcId: string
  readonly change: ElceSectionChange
}

export type ElceDocumentChange =
  | Readonly<{ kind: 'anchor'; operation: ElceAnchorChange; historyGroupKey?: string; recordedAt: number; selectionBefore?: SectionSelection; selectionAfter?: SectionSelection }>
  | Readonly<{ kind: 'question-media-import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'card-media-import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'command'; command: DocumentCommand; historyGroupKey?: string; recordHistory?: boolean; recordedAt: number }>
  | Readonly<{ kind: 'page-create'; placement: PagePlacement; pageType?: PageType; name?: string }>
  | Readonly<{ kind: 'history-undo' }>
  | Readonly<{ kind: 'history-redo' }>

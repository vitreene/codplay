import type { BdcId, MediaMetadata } from '../../../core/document/content-document-types'
import type { ElceSectionChange } from '../../../resources/anchoring/domain/anchor-types'
import type { LearningDocumentCommand } from './learning-document-command-types'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { PageType } from '../learning-definition'
import type { SectionSelection } from '../authoring/learning-selection-service'
import type { ControllerHistoryMetadata, PreparedDocumentChange } from '../../../core/controller/controller-machine'
import type { LearningSelection } from '../authoring/learning-selection-service'

export interface LearningAnchorChange {
  readonly sectionBdcId: string
  readonly change: ElceSectionChange
}

export type LearningDocumentChange =
  | Readonly<{ kind: 'anchor'; operation: LearningAnchorChange; historyGroupKey?: string; recordedAt: number; selectionBefore?: SectionSelection; selectionAfter?: SectionSelection }>
  | Readonly<{ kind: 'question-media-import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'card-media-import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'summary-media-import'; file: File; media: MediaMetadata }>
  | Readonly<{ kind: 'command'; command: LearningDocumentCommand; historyGroupKey?: string; recordHistory?: boolean; recordedAt: number }>
  | Readonly<{ kind: 'page-create'; placement: PagePlacement; pageType?: PageType; name?: string }>
  | Readonly<{ kind: 'history-undo' }>
  | Readonly<{ kind: 'history-redo' }>

export type LearningHistoryMetadata = ControllerHistoryMetadata<LearningSelection>
export type PreparedLearningDocumentChange = PreparedDocumentChange<LearningDocumentChange>

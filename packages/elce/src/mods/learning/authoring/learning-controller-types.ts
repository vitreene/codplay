import type { ControllerContext, ControllerEvent, ControllerMachineInput, ProjectControllerPort } from '../../../core/controller/controller-types'
import type { BdcId, MediaMetadata } from '../../../core/document/content-document-types'
import type { CatalogTabType } from './learning-authoring-config'
import type { ElceSectionChange } from '../../../resources/anchoring/domain/anchor-types'
import type { LearningDocument } from '../document/learning-document'
import type { LearningDocumentCommand } from '../commands/learning-document-command-types'
import type { LearningDocumentChange } from '../commands/learning-document-change-types'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { PageType } from '../learning-definition'
import type { ElceDocumentStore } from '../../../infrastructure/indexed-db/document-store-types'
import type { ElceProjectSummary } from '../../../infrastructure/project-api/project-api-types'
import type { ProjectSessionOperation, ProjectSessionPort } from '../../../app/projects/project-session-types'
import type { LearningSelection, SectionSelection } from './learning-selection-service'

export type LearningCompositionEvent =
  | Readonly<{ type: 'carousel.card.select'; bdcId: string | null }>
  | Readonly<{ type: 'catalog.tab.select'; tabId: CatalogTabType }>
  | Readonly<{ type: 'section.change'; sectionBdcId: string; change: ElceSectionChange; historyGroupKey?: string; selectionBefore?: SectionSelection; selectionAfter?: SectionSelection }>
  | Readonly<{ type: 'question.media.file.import'; bdcId: string; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'card.media.file.import'; bdcId: BdcId; file: File; media: MediaMetadata }>
  | Readonly<{ type: 'summary.media.file.import'; file: File; media: MediaMetadata }>

export type LearningPageCreateEvent = Readonly<{ type: 'page.create'; placement: PagePlacement; pageType?: PageType; name?: string }>

export type LearningControllerEvent = ControllerEvent<
  LearningDocument,
  LearningDocumentCommand,
  LearningPageCreateEvent,
  ElceProjectSummary,
  ProjectSessionOperation,
  LearningCompositionEvent
>

export type LearningControllerInput = ControllerMachineInput<ElceDocumentStore, ProjectSessionPort>
export type LearningProjectControllerPort = ProjectControllerPort<
  LearningDocument,
  LearningSelection,
  ElceProjectSummary,
  ProjectSessionOperation
>

export interface LearningCompositionState {
  readonly catalogTab: CatalogTabType
}

export type LearningAppContext = ControllerContext<
  LearningDocument,
  LearningDocumentChange,
  LearningSelection,
  ElceProjectSummary,
  ProjectSessionOperation,
  ElceDocumentStore,
  ProjectSessionPort
> & Readonly<{ composition: LearningCompositionState }>

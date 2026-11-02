import { createControllerMachine } from '../../../core/controller/controller-machine'
import type { ControllerMachineServices } from '../../../core/controller/controller-machine'
import { learningDocumentCommandService } from '../commands/learning-command-composition'
import type { LearningDocumentCommandService } from '../commands/learning-document-command-service'
import { LearningDocumentChangeService } from '../commands/learning-document-change-service'
import type { LearningDocumentChange } from '../commands/learning-document-change-types'
import { learningDocumentService } from '../document/learning-document-service'
import { CATALOG_TAB } from './learning-authoring-config'
import { LearningSelectionService } from './learning-selection-service'
import type {
  LearningCompositionEvent,
  LearningCompositionState,
  LearningPageCreateEvent,
} from './learning-controller-types'
import type { LearningDocumentCommand } from '../commands/learning-document-command-types'
import type { LearningDocument } from '../document/learning-document'
import type { LearningSelection } from './learning-selection-service'
import type { ElceProjectSummary } from '../../../infrastructure/project-api/project-api-types'
import type { ProjectSessionOperation, ProjectSessionPort } from '../../../app/projects/project-session-types'
import type { ElceDocumentStore } from '../../../infrastructure/indexed-db/document-store-types'

type LearningControllerServices = ControllerMachineServices<
  LearningDocument,
  LearningDocumentCommand,
  LearningDocumentChange,
  LearningSelection,
  ElceProjectSummary,
  ProjectSessionOperation,
  ElceDocumentStore,
  ProjectSessionPort,
  LearningPageCreateEvent,
  LearningCompositionEvent,
  LearningCompositionState
>

/** Creates the Learning services owned by one controller composition. */
function createLearningControllerServices(documentCommands: LearningDocumentCommandService): LearningControllerServices {
  const selectionService = new LearningSelectionService()
  const changeService = new LearningDocumentChangeService(selectionService)
  return {
  document: {
    createInitialDocument: () => learningDocumentService.createInitialDocument(),
    createPageCommand: (document, event) => learningDocumentService.createDefaultPageCommand(
      document,
      event.placement,
      event.name,
      event.pageType,
    ),
    applyCommand: (document, command) => documentCommands.applyCommand(document, command),
    mergeMedia: (document, canonicalMediaId, duplicateMediaIds) => {
      const mediaIds = new Set(document.medias.map((media) => media.id))
      if (!mediaIds.has(canonicalMediaId) || duplicateMediaIds.some((mediaId) => !mediaIds.has(mediaId))) return null
      return documentCommands.applyCommand(document, {
        type: 'media.merge', canonicalMediaId, duplicateMediaIds,
      })
    },
  },
  changes: {
    documentChangeForEvent: (event, recordedAt) => changeService.documentChangeForEvent(event, recordedAt),
    prepare: (change, document, store, signal) => changeService.prepare(change, document, store, signal),
    commandForChange: (change, mediaCreated, document) => changeService.commandForChange(change, mediaCreated, document),
    isImportChange: (change) => changeService.isImportChange(change),
    historyMetadata: (change, selection) => changeService.historyMetadata(change, selection),
  },
  selection: {
    initial: (document) => selectionService.initial(document),
    afterReplace: (document, current) => selectionService.afterReplace(document, current),
    afterCommand: (document, command, current, selectCreatedPage, selectionAfter) => selectionService.afterCommand(
      document,
      command,
      current,
      selectCreatedPage,
      selectionAfter?.sectionSelection,
    ),
    selectPage: (document, current, pageId) => selectionService.selectPage(document, current, pageId),
    selectChapter: (document, current, chapterId) => selectionService.selectChapter(document, current, chapterId),
  },
  queuedEventTypes: [
    'section.change',
    'question.media.file.import',
    'card.media.file.import',
    'summary.media.file.import',
  ],
  additionalEventTypes: ['carousel.card.select', 'catalog.tab.select'],
  createInitialCompositionState: (_input, _document) => ({ catalogTab: CATALOG_TAB.AVAILABLE_BDCS }),
  handleAdditionalEvent: (context, event) => {
    if (event.type === 'carousel.card.select') {
      return { selection: selectionService.selectCarouselCard(context.document, context.selection, event.bdcId) }
    }
    if (event.type === 'catalog.tab.select') {
      return { composition: { ...context.composition, catalogTab: event.tabId } }
    }
    return {}
  },
    isBootstrapOperation: (operation) => operation.kind === 'bootstrap',
  }
}

/** Creates the Learning instance of the shared authoring actor. */
export function createLearningControllerMachine(
  documentCommands: LearningDocumentCommandService = learningDocumentCommandService,
) {
  return createControllerMachine<
    LearningDocument,
    LearningDocumentCommand,
    LearningDocumentChange,
    LearningSelection,
    ElceProjectSummary,
    ProjectSessionOperation,
    ElceDocumentStore,
    ProjectSessionPort,
    LearningPageCreateEvent,
    LearningCompositionEvent,
    LearningCompositionState
  >(createLearningControllerServices(documentCommands))
}

/** Exposes the default Learning machine for the existing application entry points. */
export const learningControllerMachine = createLearningControllerMachine()

/** Reports whether the current Learning document change can be cancelled as an import. */
export function isLearningImportChange(change: LearningDocumentChange | undefined): boolean {
  return LearningDocumentChangeService.isImportChange(change)
}

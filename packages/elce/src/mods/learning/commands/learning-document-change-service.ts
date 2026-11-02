import { MEDIA_TYPE } from '../../../core/media/media-config'
import { createObjectUrl, resolveImportedMedia } from '../../../core/media/media-import-service'
import type { MediaImportStore } from '../../../core/media/media-import-service'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { createLearningAnchorDropService } from '../anchoring/learning-anchor-drop-service'
import { learningDocumentService } from '../document/learning-document-service'
import type { LearningDocument } from '../document/learning-document'
import type { MediaMetadata } from '../../../core/document/content-document-types'
import type { LearningDocumentCommand } from './learning-document-command-types'
import { LearningSelectionService } from '../authoring/learning-selection-service'
import type { LearningSelection } from '../authoring/learning-selection-service'
import type {
  LearningDocumentChange,
  LearningHistoryMetadata,
  PreparedLearningDocumentChange,
} from './learning-document-change-types'
import type { LearningControllerEvent } from '../authoring/learning-controller-types'

/** Maps Learning authoring events to queued changes and prepares their resources. */
export class LearningDocumentChangeService {
  private readonly selectionService: LearningSelectionService
  private readonly anchorDropService = createLearningAnchorDropService()

  public constructor(selectionService: LearningSelectionService = new LearningSelectionService()) {
    this.selectionService = selectionService
  }

  /** Builds the controller-owned queue item for one Learning document event. */
  public documentChangeForEvent(event: LearningControllerEvent, recordedAt: number): LearningDocumentChange | null {
    switch (event.type) {
      case 'section.change':
        return {
          kind: 'anchor',
          operation: { sectionBdcId: event.sectionBdcId, change: event.change },
          historyGroupKey: event.historyGroupKey,
          recordedAt,
          selectionBefore: event.selectionBefore,
          selectionAfter: event.selectionAfter,
        }
      case 'question.media.file.import':
        return { kind: 'question-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
      case 'card.media.file.import':
        return { kind: 'card-media-import', bdcId: event.bdcId, file: event.file, media: event.media }
      case 'summary.media.file.import':
        return { kind: 'summary-media-import', file: event.file, media: event.media }
      case 'document.apply':
        return { kind: 'command', command: event.command, historyGroupKey: event.historyGroupKey, recordHistory: event.recordHistory, recordedAt }
      case 'page.create':
        return { kind: 'page-create', placement: event.placement, pageType: event.pageType, name: event.name }
      case 'history.undo':
        return { kind: 'history-undo' }
      case 'history.redo':
        return { kind: 'history-redo' }
      default:
        return null
    }
  }

  /** Persists imported files and resolves canonical media before command commit. */
  public async prepare(
    operation: LearningDocumentChange,
    document: LearningDocument,
    store: MediaImportStore | null,
    signal: AbortSignal,
  ): Promise<PreparedLearningDocumentChange> {
    if (operation.kind === 'anchor') {
      if (operation.operation.change.kind !== 'file-drop') return { operation, mediaCreated: false, mediaSource: null }
      if (store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
      const file = operation.operation.change.file
      const { media, created } = await resolveImportedMedia(
        file,
        operation.operation.change.target.media,
        document,
        store,
        signal,
      )
      const source = created ? createObjectUrl(file) : null
      return {
        operation: this.withAnchorMedia(operation, media),
        mediaCreated: created,
        mediaSource: source === null ? null : { mediaId: media.id, source },
      }
    }
    if (operation.kind !== 'question-media-import'
      && operation.kind !== 'card-media-import'
      && operation.kind !== 'summary-media-import') {
      return { operation, mediaCreated: false, mediaSource: null }
    }
    if (operation.kind === 'summary-media-import'
      && mediaTypeFromMimeType(operation.media.mimeType) !== MEDIA_TYPE.IMAGE) {
      throw new Error('Seules les images peuvent servir de fond au Sommaire.')
    }
    if (store === null) throw new Error('Le stockage Elcé n’est pas configuré pour un dépôt de fichier.')
    const { media, created } = await resolveImportedMedia(operation.file, operation.media, document, store, signal)
    const source = created ? createObjectUrl(operation.file) : null
    return {
      operation: { ...operation, media },
      mediaCreated: created,
      mediaSource: source === null ? null : { mediaId: media.id, source },
    }
  }

  /** Maps each prepared Learning change to one immutable document command. */
  public commandForChange(
    operation: LearningDocumentChange,
    mediaCreated: boolean,
    document: LearningDocument,
  ): LearningDocumentCommand {
    switch (operation.kind) {
      case 'command':
        return operation.command
      case 'page-create':
        return learningDocumentService.createDefaultPageCommand(document, operation.placement, operation.name, operation.pageType)
      case 'anchor':
        return this.anchorDropService.createDocumentCommand(operation.operation.sectionBdcId, operation.operation.change)
      case 'question-media-import':
        return mediaCreated
          ? { type: 'bdc.question.media.attach', bdcId: operation.bdcId, media: operation.media }
          : { type: 'bdc.question.media.set', bdcId: operation.bdcId, mediaId: operation.media.id }
      case 'card-media-import':
        return mediaCreated
          ? { type: 'bdc.card.media.attach', bdcId: operation.bdcId, media: operation.media }
          : { type: 'bdc.card.media.set', bdcId: operation.bdcId, mediaId: operation.media.id }
      case 'summary-media-import':
        return mediaCreated
          ? { type: 'summary.background.media.attach', media: operation.media }
          : { type: 'summary.settings.update', summary: { ...document.data.summary, backgroundMediaId: operation.media.id } }
      case 'history-undo':
      case 'history-redo':
        throw new Error('Les déplacements Undo/Redo ne produisent pas de commande documentaire.')
    }
  }

  /** Marks changes that the author can cancel while their file is being prepared. */
  public isImportChange(change: LearningDocumentChange | undefined): boolean {
    return LearningDocumentChangeService.isImportChange(change)
  }

  /** Checks the immutable change kind without requiring a session instance. */
  public static isImportChange(change: LearningDocumentChange | undefined): boolean {
    return change?.kind === 'card-media-import'
      || change?.kind === 'question-media-import'
      || change?.kind === 'summary-media-import'
      || (change?.kind === 'anchor' && change.operation.change.kind === 'file-drop')
  }

  /** Returns history metadata and full Learning selection snapshots for one change. */
  public historyMetadata(change: LearningDocumentChange, selection: LearningSelection): LearningHistoryMetadata {
    switch (change.kind) {
      case 'history-undo':
        return { kind: 'undo', groupKey: null, recordHistory: false, recordedAt: Date.now(), selectCreatedPage: false }
      case 'history-redo':
        return { kind: 'redo', groupKey: null, recordHistory: false, recordedAt: Date.now(), selectCreatedPage: false }
      case 'command':
        return {
          kind: 'commit',
          groupKey: change.historyGroupKey ?? null,
          recordHistory: change.recordHistory !== false,
          recordedAt: change.recordedAt,
          selectCreatedPage: false,
          ...(!change.recordHistory && change.command.type === 'media.merge' ? {
            mediaMerge: {
              canonicalMediaId: change.command.canonicalMediaId,
              duplicateMediaIds: change.command.duplicateMediaIds,
            },
          } : {}),
        }
      case 'page-create':
        return { kind: 'commit', groupKey: null, recordHistory: true, recordedAt: Date.now(), selectCreatedPage: true }
      case 'anchor':
        return {
          kind: 'commit',
          groupKey: change.historyGroupKey ?? null,
          recordHistory: change.operation.change.kind !== 'anchor-ratio',
          recordedAt: change.recordedAt,
          selectCreatedPage: false,
          ...(change.selectionBefore === undefined ? {} : {
            selectionBefore: this.selectionService.withSectionSelection(selection, change.selectionBefore),
          }),
          ...(change.selectionAfter === undefined ? {} : {
            selectionAfter: this.selectionService.withSectionSelection(selection, change.selectionAfter),
          }),
        }
      case 'question-media-import':
      case 'card-media-import':
      case 'summary-media-import':
        return { kind: 'commit', groupKey: null, recordHistory: true, recordedAt: Date.now(), selectCreatedPage: false }
    }
  }

  /** Replaces only the media reference on a new anchor target after deduplication. */
  private withAnchorMedia(operation: Extract<LearningDocumentChange, { kind: 'anchor' }>, media: MediaMetadata): LearningDocumentChange {
    if (operation.operation.change.kind !== 'file-drop') return operation
    return {
      ...operation,
      operation: {
        ...operation.operation,
        change: {
          ...operation.operation.change,
          target: { ...operation.operation.change.target, media },
        },
      },
    }
  }
}

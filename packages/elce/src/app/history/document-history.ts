export {
  EMPTY_DOCUMENT_HISTORY,
  recordDocumentHistory,
  rebaseMediaMergeHistory,
  redoDocumentHistory,
  retainedHistoryMediaIds,
  undoDocumentHistory,
} from '../../core/history/document-history'
export type {
  DocumentHistory,
  DocumentHistoryEntry,
  DocumentHistoryPosition,
} from '../../core/history/document-history'
export type { SectionSelection } from '../../mods/learning/authoring/learning-selection-service'

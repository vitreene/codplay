import type { ElceDocument } from '../../domain/document/document-model'
import type { ChapterId, PageId } from '../../domain/document/document-types'
import type { MediaId } from '../../domain/document/document-types'
import { applyDocumentCommand } from '../../domain/commands/document-commands'

export interface DocumentHistoryPosition {
  readonly document: ElceDocument
  readonly selectedPageId: PageId | null
  readonly selectedChapterId: ChapterId | null
  readonly selectedCarouselCardBdcId: string | null
  readonly sectionSelection: SectionSelection | null
}

export interface SectionSelection {
  readonly sectionBdcId: string
  readonly anchor: number
  readonly head: number
}

export interface DocumentHistoryEntry {
  readonly before: DocumentHistoryPosition
  readonly after: DocumentHistoryPosition
  readonly groupKey: string | null
  readonly recordedAt: number
}

export interface DocumentHistory {
  readonly past: readonly DocumentHistoryEntry[]
  readonly future: readonly DocumentHistoryEntry[]
}

export const EMPTY_DOCUMENT_HISTORY: DocumentHistory = { past: [], future: [] }

const HISTORY_LIMIT = 100
const TEXT_GROUP_DELAY_MS = 500

/** Records one successful author gesture in the actor-owned document history. */
export function recordDocumentHistory(
  history: DocumentHistory,
  before: DocumentHistoryPosition,
  after: DocumentHistoryPosition,
  groupKey: string | null,
  recordedAt: number,
): DocumentHistory {
  if (before.document === after.document) return history

  const last = history.past.at(-1)
  const merge = groupKey !== null
    && history.future.length === 0
    && last?.groupKey === groupKey
    && recordedAt - last.recordedAt >= 0
    && recordedAt - last.recordedAt <= TEXT_GROUP_DELAY_MS

  const entry: DocumentHistoryEntry = {
    before: merge ? last.before : before,
    after,
    groupKey,
    recordedAt,
  }
  const past = merge ? [...history.past.slice(0, -1), entry] : [...history.past, entry]
  return { past: past.slice(-HISTORY_LIMIT), future: [] }
}

/** Returns the preceding document state and moves its gesture to Redo. */
export function undoDocumentHistory(history: DocumentHistory): Readonly<{
  history: DocumentHistory
  position: DocumentHistoryPosition
}> | null {
  const entry = history.past.at(-1)
  if (entry === undefined) return null
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, entry] },
    position: entry.before,
  }
}

/** Returns the following document state and moves its gesture back to Undo. */
export function redoDocumentHistory(history: DocumentHistory): Readonly<{
  history: DocumentHistory
  position: DocumentHistoryPosition
}> | null {
  const entry = history.future.at(-1)
  if (entry === undefined) return null
  return {
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
    position: entry.after,
  }
}

/** Identifies session-imported bytes that Undo or Redo may still need. */
export function retainedHistoryMediaIds(history: DocumentHistory): ReadonlySet<MediaId> {
  const retained = new Set<MediaId>()
  for (const entry of [...history.past, ...history.future]) {
    const before = new Set(entry.before.document.medias.map((media) => media.id))
    for (const media of entry.after.document.medias) {
      if (!before.has(media.id)) retained.add(media.id)
    }
  }
  return retained
}

/** Folds a server-confirmed duplicate into every affected history snapshot. */
export function rebaseMediaMergeHistory(
  history: DocumentHistory,
  canonicalMediaId: MediaId,
  duplicateMediaIds: readonly MediaId[],
): DocumentHistory {
  /** Applies the canonical media identity only to revisions that contain it. */
  const rebasePosition = (position: DocumentHistoryPosition): DocumentHistoryPosition => {
    const ids = new Set(position.document.medias.map((media) => media.id))
    const presentDuplicates = duplicateMediaIds.filter((mediaId) => ids.has(mediaId))
    if (!ids.has(canonicalMediaId) || presentDuplicates.length === 0) return position
    return {
      ...position,
      document: applyDocumentCommand(position.document, {
        type: 'media.merge', canonicalMediaId, duplicateMediaIds: presentDuplicates,
      }),
    }
  }
  /** Preserves each gesture boundary while rewriting its two snapshots. */
  const rebaseEntry = (entry: DocumentHistoryEntry): DocumentHistoryEntry => ({
    ...entry,
    before: rebasePosition(entry.before),
    after: rebasePosition(entry.after),
  })
  return { past: history.past.map(rebaseEntry), future: history.future.map(rebaseEntry) }
}

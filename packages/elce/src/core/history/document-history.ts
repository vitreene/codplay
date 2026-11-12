import type { MediaId } from '../document/content-document-types'

export interface DocumentHistoryPosition<TDocument, TSelection> {
  readonly document: TDocument
  readonly selection: TSelection
}

export interface DocumentHistoryEntry<TDocument, TSelection> {
  readonly before: DocumentHistoryPosition<TDocument, TSelection>
  readonly after: DocumentHistoryPosition<TDocument, TSelection>
  readonly groupKey: string | null
  readonly recordedAt: number
}

export interface DocumentHistory<TDocument, TSelection> {
  readonly past: readonly DocumentHistoryEntry<TDocument, TSelection>[]
  readonly future: readonly DocumentHistoryEntry<TDocument, TSelection>[]
}

export const EMPTY_DOCUMENT_HISTORY: DocumentHistory<never, never> = { past: [], future: [] }

const HISTORY_LIMIT = 100
const TEXT_GROUP_DELAY_MS = 500

/** Records one successful author gesture in the actor-owned document history. */
export function recordDocumentHistory<TDocument, TSelection>(
  history: DocumentHistory<TDocument, TSelection>,
  before: DocumentHistoryPosition<TDocument, TSelection>,
  after: DocumentHistoryPosition<TDocument, TSelection>,
  groupKey: string | null,
  recordedAt: number,
): DocumentHistory<TDocument, TSelection> {
  if (before.document === after.document) return history

  const last = history.past.at(-1)
  const merge = groupKey !== null
    && history.future.length === 0
    && last?.groupKey === groupKey
    && recordedAt - last.recordedAt >= 0
    && recordedAt - last.recordedAt <= TEXT_GROUP_DELAY_MS

  const entry: DocumentHistoryEntry<TDocument, TSelection> = {
    before: merge ? last.before : before,
    after,
    groupKey,
    recordedAt,
  }
  const past = merge ? [...history.past.slice(0, -1), entry] : [...history.past, entry]
  return { past: past.slice(-HISTORY_LIMIT), future: [] }
}

/** Returns the preceding document state and moves its gesture to Redo. */
export function undoDocumentHistory<TDocument, TSelection>(
  history: DocumentHistory<TDocument, TSelection>,
): Readonly<{
  history: DocumentHistory<TDocument, TSelection>
  position: DocumentHistoryPosition<TDocument, TSelection>
}> | null {
  const entry = history.past.at(-1)
  if (entry === undefined) return null
  return {
    history: { past: history.past.slice(0, -1), future: [...history.future, entry] },
    position: entry.before,
  }
}

/** Returns the following document state and moves its gesture back to Undo. */
export function redoDocumentHistory<TDocument, TSelection>(
  history: DocumentHistory<TDocument, TSelection>,
): Readonly<{
  history: DocumentHistory<TDocument, TSelection>
  position: DocumentHistoryPosition<TDocument, TSelection>
}> | null {
  const entry = history.future.at(-1)
  if (entry === undefined) return null
  return {
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
    position: entry.after,
  }
}

/** Identifies session-imported bytes that Undo or Redo may still need. */
export function retainedHistoryMediaIds<TDocument, TSelection>(
  history: DocumentHistory<TDocument, TSelection>,
  mediaIds: (document: TDocument) => readonly MediaId[],
): ReadonlySet<MediaId> {
  const retained = new Set<MediaId>()
  for (const entry of [...history.past, ...history.future]) {
    const before = new Set(mediaIds(entry.before.document))
    for (const mediaId of mediaIds(entry.after.document)) {
      if (!before.has(mediaId)) retained.add(mediaId)
    }
  }
  return retained
}

/** Folds a server-confirmed duplicate into every affected history snapshot. */
export function rebaseMediaMergeHistory<TDocument, TSelection>(
  history: DocumentHistory<TDocument, TSelection>,
  canonicalMediaId: MediaId,
  duplicateMediaIds: readonly MediaId[],
  mergeMedia: (document: TDocument, canonicalMediaId: MediaId, duplicateMediaIds: readonly MediaId[]) => TDocument,
): DocumentHistory<TDocument, TSelection> {
  /** Applies the canonical media identity only to revisions that contain it. */
  const rebasePosition = (position: DocumentHistoryPosition<TDocument, TSelection>): DocumentHistoryPosition<TDocument, TSelection> => {
    return {
      ...position,
      document: mergeMedia(position.document, canonicalMediaId, duplicateMediaIds),
    }
  }
  /** Preserves each gesture boundary while rewriting its two snapshots. */
  const rebaseEntry = (entry: DocumentHistoryEntry<TDocument, TSelection>): DocumentHistoryEntry<TDocument, TSelection> => ({
    ...entry,
    before: rebasePosition(entry.before),
    after: rebasePosition(entry.after),
  })
  return { past: history.past.map(rebaseEntry), future: history.future.map(rebaseEntry) }
}

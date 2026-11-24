import type { EditorScene } from '../commands/types'
import type { Selection } from '../controller/types'
import { editorScenesEqual } from '../commands/scene-equality'

export const MAX_DOCUMENT_HISTORY = 100

export type DocumentHistoryChange = Readonly<{
  beforeScene: EditorScene
  afterScene: EditorScene
  beforeSelection: Selection
  afterSelection: Selection
}>

export type DocumentHistorySnapshot = Readonly<{
  scene: EditorScene
  selection: Selection
}>

type DocumentHistoryEntry = Readonly<{
  before: DocumentHistorySnapshot
  after: DocumentHistorySnapshot
}>

export type DocumentHistoryState = Readonly<{
  canUndo: boolean
  canRedo: boolean
}>

/** Keeps the application-local before/after document history for EditorScene. */
export class DocumentHistory {
  private past: DocumentHistoryEntry[] = []
  private future: DocumentHistoryEntry[] = []
  private readonly listeners = new Set<(state: DocumentHistoryState) => void>()

  /** Reports whether the current session has an Undo or Redo step. */
  getState(): DocumentHistoryState {
    return { canUndo: this.past.length > 0, canRedo: this.future.length > 0 }
  }

  /** Adds one successful document transaction and clears any abandoned Redo branch. */
  record(change: DocumentHistoryChange): void {
    if (editorScenesEqual(change.beforeScene, change.afterScene)) return

    this.past = [
      ...this.past,
      {
        before: { scene: change.beforeScene, selection: copySelection(change.beforeSelection) },
        after: { scene: change.afterScene, selection: copySelection(change.afterSelection) },
      },
    ].slice(-MAX_DOCUMENT_HISTORY)
    this.future = []
    this.notify()
  }

  /** Moves the latest transaction to Redo and returns its valid before snapshot. */
  undo(): DocumentHistorySnapshot | null {
    const entry = this.past.at(-1)
    if (!entry) return null

    this.past = this.past.slice(0, -1)
    this.future = [...this.future, entry]
    this.notify()
    return {
      scene: entry.before.scene,
      selection: sanitizeSelection(entry.before.scene, entry.before.selection),
    }
  }

  /** Moves the latest Redo transaction to history and returns its valid after snapshot. */
  redo(): DocumentHistorySnapshot | null {
    const entry = this.future.at(-1)
    if (!entry) return null

    this.future = this.future.slice(0, -1)
    this.past = [...this.past, entry].slice(-MAX_DOCUMENT_HISTORY)
    this.notify()
    return {
      scene: entry.after.scene,
      selection: sanitizeSelection(entry.after.scene, entry.after.selection),
    }
  }

  /** Clears the session history when a different document is installed. */
  clear(): void {
    if (this.past.length === 0 && this.future.length === 0) return
    this.past = []
    this.future = []
    this.notify()
  }

  /** Subscribes to availability changes for the history controls. */
  subscribe(listener: (state: DocumentHistoryState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Notifies application views after a history boundary changes. */
  private notify(): void {
    const state = this.getState()
    for (const listener of this.listeners) listener(state)
  }
}

/** Copies selection IDs so a module cannot mutate a stored history endpoint. */
function copySelection(selection: Selection): Selection {
  return selection.keyframeId === undefined
    ? { itemIds: [...selection.itemIds] }
    : { itemIds: [...selection.itemIds], keyframeId: selection.keyframeId }
}

/** Keeps only selection references that still belong to the restored document. */
function sanitizeSelection(scene: EditorScene, selection: Selection): Selection {
  const itemIds = selection.itemIds.filter((itemId) => scene.items.some((item) => item.id === itemId))
  if (itemIds.length !== 1 || selection.keyframeId === undefined) return { itemIds }

  const item = scene.items.find((candidate) => candidate.id === itemIds[0])
  const hasKeyframe = item?.keyframes.some((keyframe) => keyframe.id === selection.keyframeId) ?? false
  return hasKeyframe ? { itemIds, keyframeId: selection.keyframeId } : { itemIds }
}

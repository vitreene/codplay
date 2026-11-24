import type { Actor } from 'xstate'
import { DocumentHistory, type DocumentHistoryState } from '../history/document-history'
import { applyDefaultTextFontSize, applyDefaultZonePlacementStyle } from '../commands/default-decor-presets'
import type { EditorScene, OffsetData, RootPlacementMode } from '../commands/types'
import { createId } from '../commands/ids'

/** Placeholder content of a newly created text item. */
const DEFAULT_TEXT_CONTENT = 'Nouveau texte'
import type { controllerMachine } from '../controller/controller-machine'
import type { Command } from '../controller/types'
import type { EditorScenePersistence } from '../persistence/editor-scene-persistence'

/** Routes editor UI intentions through the document-owning XState actor. */
export class EditorActionsFacade {
  private readonly history = new DocumentHistory()
  private readonly stopSubscriptions: Array<() => void> = []
  private readonly controller: Actor<typeof controllerMachine>

  constructor(controller: Actor<typeof controllerMachine>) {
    this.controller = controller
    const documentSubscription = controller.on('documentCommitted', (change) => this.history.record(change))
    const sceneSubscription = controller.on('sceneLoaded', () => this.history.clear())
    this.stopSubscriptions.push(
      () => documentSubscription.unsubscribe(),
      () => sceneSubscription.unsubscribe(),
    )
  }

  /** Loads a document through the central controller and its existing module bridges. */
  loadScene(scene: EditorScene): void {
    this.controller.send({ type: 'SCENE_LOADED', scene: applyDefaultZonePlacementStyle(applyDefaultTextFontSize(scene)) })
  }

  /** Saves pending author edits before replacing the document and awaiting its SQLite activation. */
  async selectScene(sceneId: string, persistence: EditorScenePersistence): Promise<void> {
    if (sceneId === this.controller.getSnapshot().context.currentSceneId) return
    this.controller.send({ type: 'HISTORY_BOUNDARY' })
    await persistence.flush()
    if (persistence.getStatus().kind === 'error') return

    const scene = await persistence.loadScene(sceneId)
    if (scene === null) return
    this.loadScene(scene)
    await persistence.flush()
  }

  /** Sends one typed document command through the central facade. */
  runCommand(command: Command): void {
    this.controller.send({ type: 'RUN_COMMAND', command })
  }

  /** Enters the existing Selection Frame creation gesture for one authoring item type. */
  beginItemCreation(itemType: 'bloc' | 'capsule', placementMode: RootPlacementMode): void {
    this.controller.send({ type: 'CREATE_MODE_ENTER', itemType, placementMode })
  }

  /** Commits one traced item created under `itemId`, selects it, and closes the creation gesture. */
  commitItemCreation(itemId: string, commands: Command[]): void {
    this.runTransaction(commands)
    if (!this.controller.getSnapshot().context.scene?.items.some((item) => item.id === itemId)) {
      this.cancelCreation()
      return
    }
    this.selectItem([itemId])
    this.controller.send({ type: 'CREATE_COMMIT' })
  }

  /**
   * Creates a block or a text item in one document transaction (one Undo step), then selects it. The
   * item is born at `introTimeMs` (the author playhead). A text receives its type, default preset and
   * placeholder content in the same transaction.
   */
  createItem(args: Readonly<{ type: 'bloc' | 'text'; geometry: OffsetData; introTimeMs: number; zoneId?: string }>): void {
    const itemId = createId('item')
    this.runTransaction([
      {
        name: 'createItem',
        args: { itemId, geometry: args.geometry, introTimeMs: args.introTimeMs, ...(args.zoneId === undefined ? {} : { zoneId: args.zoneId }) },
      },
      ...(args.type === 'text' ? [
        { name: 'assignType' as const, args: { itemId, type: args.type } },
        { name: 'assignContent' as const, args: { itemId, content: { type: args.type, text: DEFAULT_TEXT_CONTENT } } },
      ] : []),
    ])
    this.selectItem([itemId])
  }

  /** Leaves the current creation gesture without changing the document. */
  cancelCreation(): void {
    this.controller.send({ type: 'CREATE_CANCEL' })
  }

  /** Sends a grouped command batch as one document gesture. */
  runTransaction(commands: Command[]): void {
    this.controller.send({ type: 'RUN_TRANSACTION', commands })
  }

  /** Sends a structural selection intention to the controller. */
  selectItem(itemIds: string[], keyframeId?: string): void {
    this.controller.send({ type: 'SELECT_ITEM', itemIds, keyframeId })
  }

  /** Clears the central selection without entering document history. */
  clearSelection(): void {
    this.controller.send({ type: 'CLEAR_SELECTION' })
  }

  /** Flushes the current module phase, then restores the latest valid before snapshot. */
  undo(): void {
    this.controller.send({ type: 'HISTORY_BOUNDARY' })
    const snapshot = this.history.undo()
    if (snapshot !== null) this.controller.send({ type: 'RESTORE_DOCUMENT', ...snapshot })
  }

  /** Flushes the current module phase, then restores the latest valid after snapshot. */
  redo(): void {
    this.controller.send({ type: 'HISTORY_BOUNDARY' })
    const snapshot = this.history.redo()
    if (snapshot !== null) this.controller.send({ type: 'RESTORE_DOCUMENT', ...snapshot })
  }

  /** Returns the current session history availability for the menu controls. */
  getHistoryState(): DocumentHistoryState {
    return this.history.getState()
  }

  /** Subscribes to Undo/Redo availability changes. */
  subscribeHistory(listener: (state: DocumentHistoryState) => void): () => void {
    return this.history.subscribe(listener)
  }

  /** Releases the local history listeners when the application composition ends. */
  destroy(): void {
    this.stopSubscriptions.splice(0).forEach((stop) => stop())
    this.history.clear()
  }
}

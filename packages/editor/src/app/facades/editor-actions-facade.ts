import type { Actor } from 'xstate'
import { DocumentHistory, type DocumentHistoryState } from '../history/document-history'
import { applyDefaultTextFontSize } from '../commands/default-decor-presets'
import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { Command } from '../controller/types'

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
    this.controller.send({ type: 'SCENE_LOADED', scene: applyDefaultTextFontSize(scene) })
  }

  /** Sends one typed document command through the central facade. */
  runCommand(command: Command): void {
    this.controller.send({ type: 'RUN_COMMAND', command })
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

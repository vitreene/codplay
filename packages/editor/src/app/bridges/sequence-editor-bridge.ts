import type { Actor } from 'xstate'
import { SequenceEditorController } from '../../sequence-editor/controller'
import { mountSequenceEditor } from '../../sequence-editor/mount'
import type { controllerMachine } from '../controller/controller-machine'

export interface BridgeHandle {
  destroy(): void
}

/**
 * Pont `sequenceEditor` — `2026-07-13-controller-islands-bridge-plan.md` §3.1. Module de câblage
 * impératif, pas un acteur XState : le contrôleur n'a plus d'état propre à réconcilier (architecture
 * par émission), donc rien qu'un `invoke`/`fromCallback` apporterait ici. Créé une fois que son
 * conteneur DOM existe, détruit uniquement au démontage complet de l'app.
 */
export function createSequenceEditorBridge(container: HTMLElement, machine: Actor<typeof controllerMachine>): BridgeHandle {
  const controller = new SequenceEditorController(machine.getSnapshot().context.scene ?? undefined)
  const handle = mountSequenceEditor(container, controller, {
    onPlayheadChange: () => {
      // Pont `scenePlayer` (§3.3) pas encore construit — rien à notifier pour l'instant.
    },
  })

  const unsubscribeCommand = controller.onCommand((commands) => {
    machine.send({ type: 'RUN_TRANSACTION', commands })
  })
  const unsubscribeSelection = controller.onSelectionRequest((itemIds, keyframeId) => {
    machine.send({ type: 'SELECT_ITEM', itemIds, keyframeId })
  })
  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene, selection }) => {
    controller.syncFromCenter(scene, { itemIds: selection.itemIds, keyframeId: selection.keyframeId })
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    controller.deserialize(scene)
  })

  return {
    destroy(): void {
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeCommand()
      unsubscribeSelection()
      handle.destroy()
      controller.destroy()
    },
  }
}

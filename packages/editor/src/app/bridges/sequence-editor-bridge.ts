import type { Actor } from 'xstate'
import { SequenceEditorController } from '../../sequence-editor/controller'
import { mountSequenceEditor } from '../../sequence-editor/mount'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'

/**
 * Pont `sequenceEditor` — `2026-07-13-controller-islands-bridge-plan.md` §3.1. Module de câblage
 * impératif, pas un acteur XState : le contrôleur n'a plus d'état propre à réconcilier (architecture
 * par émission), donc rien qu'un `invoke`/`fromCallback` apporterait ici. Créé une fois que son
 * conteneur DOM existe, détruit uniquement au démontage complet de l'app.
 */
export function createSequenceEditorBridge(container: HTMLElement, machine: Actor<typeof controllerMachine>): BridgeHandle {
  const controller = new SequenceEditorController(machine.getSnapshot().context.scene ?? undefined)
  const handle = mountSequenceEditor(container, controller, {
    onPlayheadChange: (timeMs) => machine.send({ type: 'SEEK', timelineMs: timeMs }),
    onTelcoActionRequest: () => machine.send({ type: 'TELCO_ACTION_REQUEST' }),
    onTelcoPauseRequest: () => machine.send({ type: 'TELCO_PAUSE_REQUEST' }),
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

  // `context.telco` n'est publié qu'au premier `PLAYER_READY` (`2026-07-17-telco-real-transport-
  // plan.md` §Étape A bis) — même contrainte de disponibilité tardive qu'`authorApi`/`offsetBridge`
  // (`decor-editor-bridge.ts::ensureMounted()`) : vérifié immédiatement (rebuild déjà survenu avant
  // la construction de ce pont) puis à chaque `authorApiReady` tant que non encore branché.
  let telcoAttached = false
  function ensureTelco(): void {
    if (telcoAttached) return
    const { telco } = machine.getSnapshot().context
    if (!telco) return
    telcoAttached = true
    handle.attachTelco(telco)
  }
  ensureTelco()
  const unsubscribeAuthorApiReady = machine.on('authorApiReady', () => ensureTelco())

  return {
    destroy(): void {
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeAuthorApiReady.unsubscribe()
      unsubscribeCommand()
      unsubscribeSelection()
      handle.destroy()
      controller.destroy()
    },
  }
}

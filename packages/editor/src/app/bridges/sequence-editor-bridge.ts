import type { Actor } from 'xstate'
import { SequenceEditorController } from '../../sequence-editor/controller'
import { mountSequenceEditor } from '../../sequence-editor/mount'
import { DEFAULT_PALETTE } from '../../decor-editor/default-palette'
import { resolveKeyframeInsertionPatch, patchToDecorArgs, type ItemVisualType } from './decor-editor-bridge'
import type { controllerMachine } from '../controller/controller-machine'
import type { Command } from '../controller/types'
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
    machine.send({ type: 'RUN_TRANSACTION', commands: commands.flatMap(enrichIfKeyframeCreation) })
  })

  /**
   * `KEYFRAME.ADD` (`sequence-editor/machine.ts`) est une fonction PURE, sans accès à
   * `authorApi`/`scene` réels — elle ne peut pas calculer l'état interpolé courant elle-même
   * (`2026-07-25-decor-unified-channel-plan.md` §B). Ce pont, lui, a accès aux deux : il enrichit
   * la commande `createNamedKeyframe` d'un `setDecor` séparé quand l'état affiché au moment de
   * l'insertion diverge de la cascade héritée — « photographier » l'item, rendu trivial par
   * `getPersoStates()` (`2026-07-25-perso-state-at-t-plan.md`, tout perso/toute propriété, jamais
   * le node).
   */
  function enrichIfKeyframeCreation(command: Command): Command[] {
    if (command.name !== 'createNamedKeyframe') return [command]
    const { itemId, timeMs, keyframeId } = command.args
    const { scene, authorApi } = machine.getSnapshot().context
    const item = scene?.items.find((i) => i.id === itemId)
    if (!scene || !authorApi || !item || item.type === 'bloc') return [command]
    const content = item.contentId ? scene.contents[item.contentId] : undefined
    const patch = resolveKeyframeInsertionPatch(
      scene, item, timeMs, content, authorApi, DEFAULT_PALETTE, item.type as ItemVisualType,
    )
    if (patch === null) return [command]
    // `resolveKeyframeInsertionPatch` n'a déjà renvoyé un patch non-null qu'après avoir vérifié
    // `patchDiffersFromBase` — au moins un champ diverge donc forcément ici, `patchToDecorArgs`
    // (`touched` sur les mêmes champs) ne peut pas renvoyer `null` pour ce même patch.
    const decorArgs = patchToDecorArgs(patch, scene)
    if (decorArgs === null) return [command]
    // `decorId` omis (jamais celui résolu par `adjacentDecorId` côté machine.ts) : `createNamedKeyframe`
    // crée alors lui-même un décor vide frais à `decor-${keyframeId}` — `setDecor` l'y remplit dans la
    // MÊME transaction, aucune commande `registerDecor` séparée n'est nécessaire.
    const { decorId: _ignored, ...argsWithoutDecorId } = command.args
    return [
      { ...command, args: argsWithoutDecorId },
      { name: 'setDecor', args: { decorId: `decor-${keyframeId}`, patch: decorArgs } },
    ]
  }
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

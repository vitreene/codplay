import type { Actor } from 'xstate'
import { SequenceEditorController } from '../../sequence-editor/controller'
import { mountSequenceEditor } from '../../sequence-editor/mount'
import { DEFAULT_PALETTE } from '../../decor-editor/default-palette'
import { resolveKeyframeInsertionPatch, patchToDecorArgs, type ItemVisualType } from './decor-editor-bridge'
import type { controllerMachine } from '../controller/controller-machine'
import type { Command } from '../controller/types'
import type { BridgeHandle } from './types'
import type { EditorCoordinationBridge, EditorDecorPreviewCandidate } from './editor-coordination-bridge'

/**
 * Pont `sequenceEditor` — `2026-07-13-controller-islands-bridge-plan.md` §3.1. Module de câblage
 * impératif, pas un acteur XState : le contrôleur n'a plus d'état propre à réconcilier (architecture
 * par émission), donc rien qu'un `invoke`/`fromCallback` apporterait ici. Créé une fois que son
 * conteneur DOM existe, détruit uniquement au démontage complet de l'app.
 */
export function createSequenceEditorBridge(
  container: HTMLElement,
  machine: Actor<typeof controllerMachine>,
  coordination: EditorCoordinationBridge,
): BridgeHandle {
  const controller = new SequenceEditorController(machine.getSnapshot().context.scene ?? undefined)
  coordination.attachSequenceEditor(controller)
  const handle = mountSequenceEditor(container, controller, {
    transport: coordination.transport,
    onPlayheadChange: (timeMs) => coordination.requestSeek(timeMs),
  })

  const unsubscribeCommand = controller.onCommand((commands) => {
    const captures: KeyframeCapture[] = []
    const enrichedCommands = commands.flatMap((command) => enrichIfKeyframeCreation(command, captures))
    machine.send({ type: 'RUN_TRANSACTION', commands: enrichedCommands })

    // A document transaction supersedes the live preview. The candidate is cleared only after it
    // has been consumed, and a captured keyframe is selected explicitly so a raw seek such as
    // 2487.5 ms cannot leave the newly created 2500 ms keyframe in the temporary route.
    coordination.snapshot.clear()
    for (const capture of captures) coordination.decorPreview.clear(capture.itemId, capture.candidate.timeMs)
    const firstCaptured = captures.find((capture) => capture.persisted)
    if (firstCaptured) controller.selectKeyframe(firstCaptured.itemId, firstCaptured.keyframeId)
  })

  type KeyframeCapture = {
    itemId: string
    keyframeId: string
    candidate: EditorDecorPreviewCandidate
    persisted: boolean
  }

  /**
   * `KEYFRAME.ADD` (`sequence-editor/machine.ts`) est une fonction PURE, sans accès à
   * `snapshot`/`scene` réels — elle ne peut pas calculer l'état interpolé courant elle-même
   * (`2026-07-25-decor-unified-channel-plan.md` §B). Ce pont, lui, a accès aux deux : il enrichit
   * la commande `createNamedKeyframe` d'un `setDecor` séparé quand l'état affiché au moment de
   * l'insertion diverge de la cascade héritée — « photographier » l'item depuis le snapshot V2
   * logique au temps présenté, jamais depuis un node ou une pose runtime.
   */
  function enrichIfKeyframeCreation(command: Command, captures: KeyframeCapture[]): Command[] {
    if (command.name !== 'createNamedKeyframe') return [command]
    const { itemId, timeMs, keyframeId } = command.args
    const { scene } = machine.getSnapshot().context
    const item = scene?.items.find((i) => i.id === itemId)
    if (!scene || !item || item.type === 'bloc') return [command]
    const content = item.contentId ? scene.contents[item.contentId] : undefined
    const candidate = coordination.decorPreview.getForKeyframe(itemId, timeMs)
    const patch = resolveKeyframeInsertionPatch(
      scene, item, timeMs, content, coordination.snapshot.get(), DEFAULT_PALETTE, item.type as ItemVisualType,
      candidate?.patch,
    )
    if (candidate === null) return [command]
    if (patch === null) {
      captures.push({ itemId, keyframeId, candidate, persisted: false })
      return [command]
    }
    // `resolveKeyframeInsertionPatch` n'a déjà renvoyé un patch non-null qu'après avoir vérifié
    // `patchDiffersFromBase` — au moins un champ diverge donc forcément ici, `patchToDecorArgs`
    // (`touched` sur les mêmes champs) ne peut pas renvoyer `null` pour ce même patch.
    const decorArgs = patchToDecorArgs(patch, scene)
    if (decorArgs === null) {
      captures.push({ itemId, keyframeId, candidate, persisted: false })
      return [command]
    }
    // `decorId` omis (jamais celui résolu par `adjacentDecorId` côté machine.ts) : `createNamedKeyframe`
    // crée alors lui-même un décor vide frais à `decor-${keyframeId}` — `setDecor` l'y remplit dans la
    // MÊME transaction, aucune commande `registerDecor` séparée n'est nécessaire.
    const { decorId: _ignored, ...argsWithoutDecorId } = command.args
    captures.push({ itemId, keyframeId, candidate, persisted: true })
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

import type { Actor } from 'xstate'
import { SequenceEditorController } from '../../sequence-editor/controller'
import { mountSequenceEditor } from '../../sequence-editor/mount'
import { resolveKeyframeAlignment, resolveKeyframeInsertionPatch, patchToDecorArgs } from './decor-editor-bridge'
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
    onPlayheadRelease: (timeMs) => coordination.requestSeekRelease(timeMs),
  })

  type KeyframeCapture = {
    itemId: string
    keyframeId: string
    candidate: EditorDecorPreviewCandidate | null
    persisted: boolean
  }

  type PendingSnapshotCapture = {
    commands: Command[]
    timeMs: number
  }

  const pendingSnapshotCaptures: PendingSnapshotCapture[] = []
  let requestedSnapshotTimeMs: number | null = null

  /** True when the player reports a ready logical frame at the author's insertion time. */
  function snapshotIsPresentedAt(timeMs: number): boolean {
    const progress = coordination.transport.getProgress()
    const snapshot = coordination.snapshot.get()
    return progress !== null
      && Math.abs(progress.timelineMs - timeMs) <= 1
      && snapshot !== null
      // `snapshot.timeMs` and `progress.playerTimeMs` share the player reference (the latter is
      // deliberately kept on the facade result); this check also rejects a stale snapshot whose
      // author progress happened to be updated first.
      && Math.abs(snapshot.timeMs - progress.playerTimeMs) <= 1
  }

  /** Defers an insertion until the seek acknowledgement has made its target snapshot readable. */
  function requestSnapshotAt(timeMs: number): void {
    if (requestedSnapshotTimeMs === timeMs) return
    requestedSnapshotTimeMs = timeMs
    coordination.requestSeek(timeMs)
  }

  /** Sends one command batch after enriching any keyframe insertion from the presented state. */
  function dispatchCommands(commands: Command[]): void {
    const captures: KeyframeCapture[] = []
    const enrichedCommands = commands.flatMap((command) => enrichIfKeyframeCreation(command, captures))
    machine.send({ type: 'RUN_TRANSACTION', commands: enrichedCommands })

    // A document transaction supersedes the live preview. The candidate is cleared only after it
    // has been consumed, and a captured keyframe is selected explicitly so a raw seek such as
    // 2487.5 ms cannot leave the newly created 2500 ms keyframe in the temporary route.
    coordination.snapshot.clear()
    for (const capture of captures) {
      if (capture.candidate !== null) coordination.decorPreview.clear(capture.itemId, capture.candidate.timeMs)
    }
    const firstCaptured = captures.find((capture) => capture.persisted)
    if (firstCaptured) controller.selectKeyframe(firstCaptured.itemId, firstCaptured.keyframeId)
  }

  const unsubscribeCommand = controller.onCommand((commands) => {
    // A double-click first emits a seek from the timeline's pointerdown, then emits the keyframe
    // command. The seek is asynchronous; never photograph the previous frame in that window.
    // The no-player/unit-test path remains synchronous because there is no presented progress to
    // wait for and therefore no interpolated runtime state that could be captured incorrectly.
    if (commands.length === 1) {
      const command = commands[0]!
      const progress = coordination.transport.getProgress()
      if (keyframeNeedsPresentedSnapshot(command) && progress !== null && !snapshotIsPresentedAt(command.args.timeMs)) {
        pendingSnapshotCaptures.push({ commands, timeMs: command.args.timeMs })
        requestSnapshotAt(command.args.timeMs)
        return
      }
    }
    dispatchCommands(commands)
  })

  /**
   * `KEYFRAME.ADD` (`sequence-editor/machine.ts`) est une fonction PURE, sans accès à
   * `snapshot`/`scene` réels — elle ne peut pas calculer l'état interpolé courant elle-même
   * (`2026-07-25-decor-unified-channel-plan.md` §B). Ce pont, lui, a accès aux deux : il enrichit
   * la commande `createNamedKeyframe` d'un `setDecor` séparé quand la map de propriétés modifiées
   * fournit un candidat d'édition, jamais depuis un node ou une pose runtime. Sans candidat,
   * l'insertion conserve le décor adjacent et ne fige aucune valeur interpolée.
   */
  function enrichIfKeyframeCreation(command: Command, captures: KeyframeCapture[]): Command[] {
    if (command.name !== 'createNamedKeyframe') return [command]
    const { itemId, timeMs, keyframeId } = command.args
    const { scene } = machine.getSnapshot().context
    const item = scene?.items.find((i) => i.id === itemId)
    if (!scene || !item || item.type === 'bloc') return [command]
    const content = item.contentId ? scene.contents[item.contentId] : undefined
    const candidate = coordination.decorPreview.getForKeyframe(itemId, timeMs)
    const patch = resolveKeyframeInsertionPatch(scene, item, timeMs, content, coordination.snapshot.get(), candidate?.patch)
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

  /** Identifies keyframe insertions carrying a sparse user candidate that needs the target time. */
  function keyframeNeedsPresentedSnapshot(command: Command): command is Extract<Command, { name: 'createNamedKeyframe' }> {
    if (command.name !== 'createNamedKeyframe') return false
    const { scene } = machine.getSnapshot().context
    const item = scene?.items.find((candidate) => candidate.id === command.args.itemId)
    return item !== undefined && item.type !== 'bloc'
      && resolveKeyframeAlignment(item, command.args.timeMs).kind === 'between'
      && coordination.decorPreview.getForKeyframe(command.args.itemId, command.args.timeMs) !== null
  }

  const unsubscribeSeekApplied = coordination.onSeekApplied(() => {
    const pending = pendingSnapshotCaptures[0]
    if (!pending || !snapshotIsPresentedAt(pending.timeMs)) return
    pendingSnapshotCaptures.shift()
    requestedSnapshotTimeMs = null
    dispatchCommands(pending.commands)
    const next = pendingSnapshotCaptures[0]
    if (next) requestSnapshotAt(next.timeMs)
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
      unsubscribeSeekApplied()
      pendingSnapshotCaptures.length = 0
      requestedSnapshotTimeMs = null
      unsubscribeSelection()
      handle.destroy()
      controller.destroy()
    },
  }
}

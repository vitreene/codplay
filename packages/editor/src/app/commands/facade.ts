/**
 * La façade de commandes — propriétaire des écritures documentaires, selon
 * `specs/editor-history-spec.md`. Point d'entrée
 * UNIQUE pour toute mutation du document : le contrôleur ne connaît que `runCommand`/`transaction`
 * (jamais les fonctions de `base-commands.ts` directement, jamais une mutation arbitraire fournie
 * par l'appelant) — la union discriminée `Command` (`controller/types.ts`) ferme le vocabulaire
 * de commandes.
 */

import * as base from './base-commands'
import { setItemRotationMode } from './item-rotation/item-rotation-commands'
import { setItemDecor } from './item-decor/item-decor-commands'
import * as rootPlacement from './root-placement-commands'
import * as sequenceEditor from '../../sequence-editor/commands'
import type { Command } from '../controller/types'
import type { EditorScene } from './types'
import { editorScenesEqual } from './scene-equality'
import { syncLinkedBoundTimes } from '../../scene-bounds/scene-bounds'

/**
 * Exécute une commande nommée sur le document. Commandes qui produisent aussi un id
 * (`createItem`, `createCapsule`) retournent `{ scene, ...ids }` — leur `scene`
 * est extraite ici pour que `runCommand` retourne toujours un `EditorScene` uniforme ; l'appelant
 * qui a besoin de l'id créé passe par `runCommandWithResult` (ci-dessous).
 */
export function runCommand(scene: EditorScene, command: Command): EditorScene {
  try {
    return keepWhenUnchanged(scene, runCommandWithResult(scene, command).scene)
  } catch (cause) {
    throw new CommandError(command.name, cause)
  }
}

/** A document command refused by its own validation; names the command for the failure display. */
export class CommandError extends Error {
  readonly commandName: string

  /** Wraps the refusal raised by one named command. */
  constructor(commandName: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'CommandError'
    this.commandName = commandName
  }
}

/**
 * Comme `runCommand`, mais renvoie aussi ce que la commande produit en plus du document (id créé…).
 * Chaque commande se termine par la projection en ms des bornes liées (`syncLinkedBoundTimes`) : leur
 * instant suit la distribution dans le même commit, donc dans la même étape d'historique.
 */
export function runCommandWithResult(scene: EditorScene, command: Command): { scene: EditorScene; [key: string]: unknown } {
  const result = executeCommand(scene, command)
  return { ...result, scene: syncLinkedBoundTimes(result.scene) }
}

/** Dispatches one named command to its owner. */
function executeCommand(scene: EditorScene, command: Command): { scene: EditorScene; [key: string]: unknown } {
  switch (command.name) {
    case 'createItem':
      return base.createItem(scene, command.args)
    case 'setRootPlacementMode':
      return { scene: rootPlacement.setRootPlacementMode(scene, command.args) }
    case 'createRootZone':
      return { scene: rootPlacement.createRootZone(scene, command.args) }
    case 'setZonesSurface':
      return { scene: rootPlacement.setZonesSurface(scene, command.args) }
    case 'assignType':
      return { scene: base.assignType(scene, command.args) }
    case 'setItemRotationMode':
      return { scene: setItemRotationMode(scene, command.args) }
    case 'assignContent':
      return { scene: base.assignContent(scene, command.args) }
    case 'attachItem':
      return { scene: base.attachItem(scene, command.args) }
    case 'setDecor':
      return { scene: base.setDecor(scene, command.args) }
    case 'setItemDecor':
      return { scene: setItemDecor(scene, command.args) }
    case 'registerDecor':
      return { scene: base.registerDecor(scene, command.args) }
    case 'createCapsule':
      return base.createCapsule(scene, command.args)
    case 'setCapsuleDef':
      return { scene: base.setCapsuleDef(scene, command.args) }
    case 'deleteItem':
      return { scene: base.deleteItem(scene, command.args) }
    // ── Commandes locales au sequence-editor (`sequence-editor/commands.ts`) — même voie
    // d'écriture, deuxième bibliothèque de fonctions pures (contrat d’intégration V2) ──────────────
    case 'createNamedKeyframe':
      return { scene: sequenceEditor.createNamedKeyframe(scene, command.args) }
    case 'setKeyframeChannel':
      return { scene: sequenceEditor.setKeyframeChannel(scene, command.args) }
    case 'deleteKeyframe':
      return { scene: sequenceEditor.deleteKeyframe(scene, command.args) }
    case 'moveKeyframe':
      return { scene: sequenceEditor.moveKeyframe(scene, command.args) }
    case 'renameKeyframe':
      return { scene: sequenceEditor.renameKeyframe(scene, command.args) }
    case 'lockKeyframeBound':
      return { scene: sequenceEditor.lockKeyframeBound(scene, command.args) }
    case 'assignKeyframeDecor':
      return { scene: sequenceEditor.assignKeyframeDecor(scene, command.args) }
    case 'setKeyframeTransitionIn':
      return { scene: sequenceEditor.setKeyframeTransitionIn(scene, command.args) }
    case 'setKeyframeTransitionOut':
      return { scene: sequenceEditor.setKeyframeTransitionOut(scene, command.args) }
    case 'attachMarkerToKeyframe':
      return { scene: sequenceEditor.attachMarkerToKeyframe(scene, command.args) }
    case 'detachMarkerFromKeyframe':
      return { scene: sequenceEditor.detachMarkerFromKeyframe(scene, command.args) }
    case 'clearItemKeyframes':
      return { scene: sequenceEditor.clearItemKeyframes(scene, command.args) }
    case 'clearCapsuleKeyframes':
      return { scene: sequenceEditor.clearCapsuleKeyframes(scene, command.args) }
    case 'toggleItemVisibility':
      return { scene: sequenceEditor.toggleItemVisibility(scene, command.args) }
    case 'addMarkerTrack':
      return { scene: sequenceEditor.addMarkerTrack(scene, command.args) }
    case 'removeMarkerTrack':
      return { scene: sequenceEditor.removeMarkerTrack(scene, command.args) }
    case 'renameMarkerTrack':
      return { scene: sequenceEditor.renameMarkerTrack(scene, command.args) }
    case 'toggleMarkerTrackVisibility':
      return { scene: sequenceEditor.toggleMarkerTrackVisibility(scene, command.args) }
    case 'addMarker':
      return { scene: sequenceEditor.addMarker(scene, command.args) }
    case 'moveMarker':
      return { scene: sequenceEditor.moveMarker(scene, command.args) }
    case 'removeMarker':
      return { scene: sequenceEditor.removeMarker(scene, command.args) }
    case 'setMasterWaveform':
      return { scene: sequenceEditor.setMasterWaveform(scene, command.args) }
    case 'setSceneDuration':
      return { scene: sequenceEditor.setSceneDuration(scene, command.args) }
  }
}

/**
 * Une transaction groupe N commandes en un seul commit (une macro en est la première
 * instance, pas un cas isolé). Chaque commande reçoit le document produit par la précédente ; seul
 * le document final est retourné — pas d'état intermédiaire visible au contrôleur.
 */
export function transaction(scene: EditorScene, commands: Command[]): EditorScene {
  return keepWhenUnchanged(scene, base.transaction(scene, commands.map((command) => (s: EditorScene) => runCommand(s, command))))
}

/** Returns the previous document when a command left its values unchanged: no commit, no write. */
function keepWhenUnchanged(before: EditorScene, after: EditorScene): EditorScene {
  return editorScenesEqual(before, after) ? before : after
}

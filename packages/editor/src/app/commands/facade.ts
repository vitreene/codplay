/**
 * La façade de commandes — `plan/app/2026-07-12-app-controller-definition.md` §4. Point d'entrée
 * UNIQUE pour toute mutation du document : le contrôleur ne connaît que `runCommand`/`transaction`
 * (jamais les fonctions de `base-commands.ts` directement, jamais une mutation arbitraire fournie
 * par l'appelant) — la union discriminée `Command` (`controller/types.ts`) ferme le vocabulaire
 * exactement au §4.1.
 */

import * as base from './base-commands'
import type { Command } from '../controller/types'
import type { EditorScene } from './types'

/**
 * Exécute une commande nommée sur le document. Commandes qui produisent aussi un id
 * (`createItem`, `createCapsule`, `createKeyframe`) retournent `{ scene, ...ids }` — leur `scene`
 * est extraite ici pour que `runCommand` retourne toujours un `EditorScene` uniforme ; l'appelant
 * qui a besoin de l'id créé passe par `runCommandWithResult` (ci-dessous).
 */
export function runCommand(scene: EditorScene, command: Command): EditorScene {
  return runCommandWithResult(scene, command).scene
}

/** Comme `runCommand`, mais renvoie aussi ce que la commande produit en plus du document (id créé…). */
export function runCommandWithResult(scene: EditorScene, command: Command): { scene: EditorScene; [key: string]: unknown } {
  switch (command.name) {
    case 'createItem':
      return base.createItem(scene, command.args)
    case 'assignType':
      return { scene: base.assignType(scene, command.args) }
    case 'assignContent':
      return { scene: base.assignContent(scene, command.args) }
    case 'attachItem':
      return { scene: base.attachItem(scene, command.args) }
    case 'setDecor':
      return { scene: base.setDecor(scene, command.args) }
    case 'createKeyframe':
      return base.createKeyframe(scene, command.args)
    case 'createCapsule':
      return base.createCapsule(scene, command.args)
    case 'setCapsuleDef':
      return { scene: base.setCapsuleDef(scene, command.args) }
    case 'placeInZone':
      return { scene: base.placeInZone(scene, command.args) }
    case 'deleteItem':
      return { scene: base.deleteItem(scene, command.args) }
  }
}

/**
 * Une transaction groupe N commandes en un seul commit (§4.1 — une macro en est la première
 * instance, pas un cas isolé). Chaque commande reçoit le document produit par la précédente ; seul
 * le document final est retourné — pas d'état intermédiaire visible au contrôleur.
 */
export function transaction(scene: EditorScene, commands: Command[]): EditorScene {
  return base.transaction(scene, commands.map((command) => (s: EditorScene) => runCommand(s, command)))
}

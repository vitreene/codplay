import type { DecorPatch } from './types'

/**
 * Construit un écart minimal à partir d'un chemin générique ("groupe.propriete", ou racine
 * pour un champ non imbriqué comme "zone") et d'une valeur — mécanique pure, symétrique de
 * `readPath` (field-state.ts). Ne connaît rien du sens métier du chemin : le rendu peut
 * ainsi écrire n'importe quel champ du décor (style, position, textAutoSize, un futur
 * module…) sans en connaître la structure — le rendu n'a pas à limiter ce qu'un panneau
 * peut cibler (spec §4 bis : « un panneau lit des champs de n'importe quelle propriété CSS
 * de style, plus éventuellement custom/classes/position.* »).
 */
export function buildPatchFromPath(path: string, value: unknown): DecorPatch {
  const segments = path.split('.')
  let result: unknown = value
  for (let i = segments.length - 1; i >= 0; i--) {
    result = { [segments[i]!]: result }
  }
  return result as DecorPatch
}

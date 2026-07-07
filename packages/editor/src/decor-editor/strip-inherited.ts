import type { DecorPatch } from './types'

/**
 * Retire l'écart d'une propriété — le champ retombe sur la valeur héritée. `path` est
 * soit une propriété racine ("custom", "zone", "text", "classes"), soit "style.<nom-css>"
 * pour une propriété CSS de la carte plate, soit "groupe.propriete" pour un module
 * structuré ("position.x", "capsule.behavior"). Ne mute pas `patch`.
 */
export function stripInherited(patch: DecorPatch, path: string): DecorPatch {
  const segments = path.split('.')

  if (segments.length === 1) {
    const [key] = segments as [keyof DecorPatch]
    const { [key]: _removed, ...rest } = patch
    return rest as DecorPatch
  }

  const [group, prop] = segments as [keyof DecorPatch, string]
  const groupValue = patch[group] as Record<string, unknown> | undefined
  if (!groupValue || !(prop in groupValue)) return patch

  const { [prop]: _removed, ...restGroup } = groupValue
  const result: DecorPatch = { ...patch }

  if (Object.keys(restGroup).length === 0) {
    delete result[group]
  } else {
    result[group] = restGroup as never
  }

  return result
}

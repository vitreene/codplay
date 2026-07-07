import type { ResolvedDecor } from './types'

/** État d'un champ à travers plusieurs décors résolus : valeur commune, ou mixte. */
export type FieldState<T> = { kind: 'uniform'; value: T } | { kind: 'mixed' }

function readPath(decor: ResolvedDecor, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = decor
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * Résout l'état d'une propriété (par chemin "groupe.propriete" ou racine) à travers
 * plusieurs décors déjà résolus (défauts ⊕ chaîne ⊕ écart, un par item). Comparaison
 * par égalité structurelle (JSON) — suffisant pour les valeurs de décor, toutes des
 * littéraux ou de petits objets plats.
 */
export function resolveFieldAcrossItems<T>(decors: ResolvedDecor[], path: string): FieldState<T> {
  if (decors.length === 0) return { kind: 'mixed' }
  const first = readPath(decors[0]!, path)
  const firstKey = JSON.stringify(first)
  const allSame = decors.every(decor => JSON.stringify(readPath(decor, path)) === firstKey)
  return allSame ? { kind: 'uniform', value: first as T } : { kind: 'mixed' }
}

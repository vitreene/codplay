/**
 * Primitives d'acces a l'etat logique d'un perso.
 *
 * Elles reprennent la forme utile de `anime.utils.get/set` pour une cible objet,
 * sans DOM ni mutation : l'etat precedent reste disponible pour une nouvelle
 * evaluation a un autre instant.
 */

/** Etat logique partiel d'un perso a un instant donne. */
export type PersoState = Readonly<Record<string, unknown>>

/**
 * Lit une valeur de l'etat sans inventer de valeur par defaut.
 */
export const get = <Value = unknown>(state: PersoState, key: string): Value | undefined =>
  state[key] as Value | undefined

/**
 * Produit l'etat obtenu apres application d'un patch, sans modifier l'etat source.
 */
export const set = <State extends Record<string, unknown>, Patch extends Record<string, unknown>>(
  state: Readonly<State>,
  patch: Readonly<Patch>,
): State & Patch => ({ ...state, ...patch })

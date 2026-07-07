import type { ClassNameValue } from 'codplay/runtime/perso-shared-types'
import type { DecorPatch, ResolvedDecor } from './types'
import { STRUCTURED_GROUPS } from './decor-patch-groups'

/**
 * Résout un `classes` déjà courant (chaîne, toujours le cas dans un décor résolu)
 * contre un nouveau patch — même algorithme que `applyClassNamePatch` du runtime
 * (`packages/codplay/src/runtime/components/lib/dom-component-adapter.ts`), en
 * pur (pas de DOM) puisqu'ici on compose des écarts, pas un élément réel.
 */
function resolveClassNamePatch(current: string, patch: ClassNameValue): string {
  if (typeof patch === 'string') return patch

  const tokens = new Set(current.split(/\s+/).filter(t => t.length > 0))
  if (patch.add) {
    for (const token of patch.add.split(/\s+/)) if (token.length > 0) tokens.add(token)
  }
  if (patch.remove) {
    for (const token of patch.remove.split(/\s+/)) if (token.length > 0) tokens.delete(token)
  }
  return [...tokens].join(' ')
}

/**
 * Fusion profonde par propriété feuille. Une clé absente dans `addition` laisse `base`
 * intacte ; une clé présente (y compris `null`) écrase la valeur de `base` — jamais de
 * merge plus profond que ça, sauf pour :
 * - `style` : fusion clé-CSS par clé-CSS (une propriété absente de `addition.style`
 *   reste héritée, une présente écrase) ;
 * - `classes` : résolution add/remove/remplacement (cf `resolveClassNamePatch`).
 */
export function mergePatch(base: DecorPatch, addition: DecorPatch): DecorPatch {
  const result: DecorPatch = { ...base }

  if (addition.style) {
    result.style = { ...base.style, ...addition.style }
  }

  if (addition.classes !== undefined) {
    // Invariant : base.classes, s'il est présent à ce stade (défauts ou repli
    // intermédiaire), est toujours déjà résolu en string — jamais un patch
    // add/remove non résolu (cf commentaire sur resolveDecor).
    result.classes = resolveClassNamePatch((base.classes as string | undefined) ?? '', addition.classes)
  }

  for (const group of STRUCTURED_GROUPS) {
    if (group in addition) {
      const baseGroup = base[group] as Record<string, unknown> | undefined
      const additionGroup = addition[group] as Record<string, unknown> | undefined
      result[group] = { ...baseGroup, ...additionGroup } as never
    }
  }

  if ('zone' in addition) result.zone = addition.zone
  if ('text' in addition) result.text = addition.text
  if ('custom' in addition) result.custom = addition.custom

  return result
}

/**
 * Repli complet de la chaîne d'héritage : défauts ⊕ écart(1) ⊕ … ⊕ écart(n).
 * `defaults.classes`, s'il est fourni, doit être une chaîne déjà résolue (jamais un
 * patch add/remove — celui-ci n'a de sens qu'en écart, contre un état courant).
 */
export function resolveDecor(defaults: ResolvedDecor, patches: DecorPatch[]): ResolvedDecor {
  return patches.reduce((acc, patch) => mergePatch(acc, patch), defaults)
}

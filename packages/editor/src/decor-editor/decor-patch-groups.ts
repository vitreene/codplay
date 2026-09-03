/**
 * Modules non-CSS du décor dont l'écart est un objet imbriqué, fusionné superficiellement
 * propriété par propriété — même mécanique que `style`, mais hors de la carte CSS plate
 * (spec dedit §3.2 : « toute donnée qui produit du CSS via une interface intermédiaire
 * sort de `style` » — `offset` en est le premier exemple, `capsule` et `textAutoSize`
 * suivent le même principe).
 *
 * Config, pas logique : `mergePatch` (merge.ts) lit cette liste plutôt que de coder les
 * noms en dur. Ajouter un module au décor (`types.ts`, `DecorPatch`) nécessite de
 * l'enregistrer ici aussi — sans quoi son écart serait silencieusement perdu à la fusion
 * (bug déjà rencontré une fois avec `textAutoSize`). `path` est l'exception
 * documentée : il est segment-local et doit rester hors de cette cascade.
 */
export const STRUCTURED_GROUPS = ['offset', 'capsule', 'textAutoSize'] as const

# CodPlay V2 — composant spécialisé `polygon`

## Périmètre vérifié

Cette spécification décrit le rendu SVG réel, le morph temporel exercé et la
projection de `diameter`. Les cas d'acceptation non encore vérifiés restent au
[plan image/input/polygon](../plan/components-image-input-polygon-svg-plan.md).

## Racine SVG et géométrie

`PolygonComponent` matérialise un élément racine SVG dans le namespace
`http://www.w3.org/2000/svg`, avec des parts `path` et `content`. La géométrie
initiale est sérialisée sur `path[d]`, et le texte est projeté dans la part
`content`.

La valeur `diameter` détermine `width` et `height` en pixels. La suite composant
vérifie une valeur numérique initiale, puis une nouvelle valeur de chaîne
numérique ; la démo vérifie également une entrée native `input` diffusée comme
`polygon:diameter`, dont le payload conserve `data.value` sous forme de chaîne.

## Morph temporel

Une occurrence d'action `morph` fournit la forme cible et sa progression est
calculée à partir du temps logique. Le test du composant vérifie une forme
intermédiaire à 500 ms et la forme finale à 1000 ms. La fixture de démo utilise
le runner HTML réel : elle vérifie le changement de path pendant Play et les
formes finales de deux morphs déclenchés par le circuit DOM emit.

Le Seek vers le milieu ou la fin d'un morph n'est pas exercé par ces preuves ;
ce cas reste dans le plan d'acceptation.

## Preuves

- [`image-input-polygon.spec.ts`](../tests/runtime/components/image-input-polygon.spec.ts)
  vérifie le namespace SVG, les parts, le diamètre et la progression
  déterministe d'un morph sur le composant.
- [`polygon-demo.spec.ts`](../tests/runtime/components/polygon-demo.spec.ts)
  construit la scène avec le builder et l'exécute par le runner HTML ; il vérifie
  `polygon:sides`, `polygon:diameter`, le payload natif `value`, la mise à jour
  des contrôles et les deux morphs pendant Play.

La suite ciblée image/input/polygon exécutée le 2026-09-25 passe : 2 fichiers,
6 tests réussis. Les validations complètes Seek et navigateur restent ouvertes.

# CodPlay V2 — canaux de transformation et projection HTML

## Périmètre vérifié

Cette spécification couvre les canaux de transformation scalaires vérifiés par
ACE et leur sérialisation par le service HTML. Les unités logiques et leur
conversion vers `px` sont détaillées dans la [spécification des unités](./unit-values-v2-spec.md).
Les canaux et defaults qui n'ont pas encore leur preuve restent au
[plan de transformation](../plan/transform-properties-plan.md).

## Normalisation ACE

Dans la forme testée, `x` et `y` normalisent respectivement vers `translateX` et
`translateY`. ACE ordonne les canaux de transformation reconnus et conserve une
opération `matrix` distincte après les canaux. Déclarer simultanément `x` et
`translateX` produit un diagnostic de doublon sur le canal canonique.

`transform` brut et la propriété CSS `translate` ne sont pas des canaux de cette
normalisation ACE : `normalizeTransformProperties` les signale comme non
reconnus. Leur traitement HTML suit la frontière décrite ci-dessous.

Les identités testées utilisent l'unité de la borne cible pour une translation
ou une rotation : `translateX` vers `50%` commence à `0%`, et `rotate` vers
`20deg` commence à `0deg`. L'identité de `scaleX` est `1`. Aucune identité
n'est produite pour `matrix` ou `perspective`; une interpolation `matrix` sans
borne source explicite est refusée.

## Projection HTML

Le service HTML sérialise les canaux présents dans un ordre canonique. Pour les
canaux exercés, `x` et `y` ensemble donnent `translate(x, y)` ; un seul axe
donne `translateX(...)` ou `translateY(...)`, sans axe nul ajouté. Les chaînes
d'unités présentes sont conservées et une rotation numérique est rendue en
degrés.

La chaîne auteur `style.transform` reste opaque : le service la conserve sans
parser ni réordonner ses fonctions, puis l'ajoute après les canaux scalaires.
La propriété CSS `translate` reste séparée de `style.transform`.

Le runner réévalue la frame logique au Seek et en lecture Play. Le test runner
exerce la même valeur de transformation dans les deux parcours ainsi que sa
réapplication après `resize`; la conversion des longueurs structurées au point
HTML est couverte par la spécification des unités.

## Preuves

- [`transform.spec.ts`](../tests/ace/transform.spec.ts) couvre les alias `x` et
  `y`, l'ordre observé des canaux, les doublons, les identités et la borne
  source nécessaire à `matrix`.
- [`component-materializer.spec.ts`](../tests/runtime/runner-html/component-materializer.spec.ts)
  couvre la sérialisation des axes, l'ordre des canaux exercés, les unités, les
  rotations numériques, la chaîne `transform` opaque et la propriété `translate`.
- [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  couvre la projection d'une scène par Seek, Play et `resize`.
- [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts)
  vérifie que les chaînes `transform` auteur sont conservées au build.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/ace/transform.spec.ts \
  tests/runtime/runner-html/component-materializer.spec.ts \
  tests/runtime/runner-html/player-runner.spec.ts \
  tests/scene/compiled/scene-builder.spec.ts
4 fichiers, 69 tests réussis
```

## Limite de certification

La liste complète des canaux et leur ordre intermédiaire, l'alias `z`, les
identités des autres axes et opérations, ainsi que les interactions
`loop`/`alternate` ne sont pas couverts par cette validation ciblée. La
conversion `numericLengthScale` reste spécifiée avec les unités, pas comme une
propriété de transformation.

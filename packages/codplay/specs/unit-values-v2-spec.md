# CodPlay V2 — valeurs numériques et unités CSS

## Périmètre vérifié

Cette spécification décrit la conservation des unités pendant la préparation
et l'interpolation ACE, la qualification des longueurs structurées par le
builder et leur conversion au rendu HTML. La stabilité de la forme publique
`UnitValue` reste une décision ouverte dans le [plan associé](../plan/unit-values-plan.md).

## Préparation ACE

ACE sépare la partie numérique et l'unité d'une valeur CSS prise en charge. Une
unité présente à l'entrée est conservée à la résolution : par exemple,
`-8cqw → 12cqw` reste en `cqw`, et une longueur en `px` reste en `px`. Les
unités ne sont pas converties pendant la préparation.

Une interpolation numérique exige la même unité aux deux bornes. Une paire
comme `50% → 20px` est refusée pendant la préparation, avant la résolution.
Les valeurs relatives en position de destination sont calculées à partir de la
borne source, avec son unité. Une borne source relative est refusée car elle ne
dispose pas de valeur amont à lire.

## Longueurs structurées et rendu

Pendant le build, les valeurs numériques des champs structurés `x`, `y`,
`width` et `height` sont qualifiées avec l'unité logique configurée par
CodPlay, actuellement `cqw`. Cette opération préserve la valeur numérique et
ne la convertit pas en pixels. Elle laisse inchangés les nombres CSS
intrinsèquement `unitless`, les autres propriétés et les chaînes auteur déjà
munies d'une unité.

Le materializer HTML convertit les longueurs numériques vers `px` à la
frontière de rendu. Son facteur `numericLengthScale` multiplie la valeur
projetée ; `HtmlPlayerRunner.resize(scale)` met ce facteur à jour et réapplique
la frame courante. Les chaînes CSS opaques et leurs unités explicites restent
inchangées.

## Code et acceptation

- Décomposition ACE : [`values.ts`](../src/ace/values.ts).
- Qualification au build : [`length.ts`](../src/scene/compiled/length.ts).
- Résolution et matérialisation HTML :
  [`resolve.ts`](../src/runtime/player/pipeline/resolve.ts) et
  [`component-materializer.ts`](../src/runtime/runner-html/component-materializer.ts).
- Tests ACE : [`values.spec.ts`](../tests/ace/values.spec.ts),
  [`interval.spec.ts`](../tests/ace/interval.spec.ts) et
  [`transform.spec.ts`](../tests/ace/transform.spec.ts).
- Tests de rendu :
  [`component-materializer.spec.ts`](../tests/runtime/runner-html/component-materializer.spec.ts),
  [`player-runner.spec.ts`](../tests/runtime/runner-html/player-runner.spec.ts)
  et [`cqw.spec.ts`](../tests/facade/cqw.spec.ts).

Le 2026-09-25, l'exécution ciblée a passé **6 fichiers et 74 tests**.

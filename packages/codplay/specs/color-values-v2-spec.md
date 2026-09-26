# CodPlay V2 — valeurs couleur

## Périmètre vérifié

Cette spécification décrit la normalisation des couleurs vers `ColorValue`,
leur préparation et leur interpolation dans ACE, la normalisation des
propriétés `style` déclarées lors du build et leur matérialisation HTML. Le
passage direct des chaînes couleur à `prepareTween` et sa validation sur la
scène scroll restent suivis dans le [plan d'acceptation couleur](../plan/color-values-plan.md).

## Valeur intermédiaire

ACE prépare les couleurs sous cette forme :

```ts
type ColorValue = Readonly<{
  kind: 'color'
  space: 'srgb' | 'oklch'
  coords: readonly number[]
  alpha: number
}>
```

Les couleurs nommées de la table explicite, `transparent`, les formes
hexadécimales courtes, `rgb()`/`rgba()` et `oklch()` sont reconnues par le
parseur. Les noms sont insensibles à la casse. Les formes numériques et
pourcentages RGB testées sont ramenés dans `[0, 1]` ; `alpha` est explicite et
vaut `1` quand elle manque. `transparent` produit une valeur sRGB avec alpha
nul.

OKLCH conserve son espace jusqu'au rendu. `L` est borné à `[0, 1]`, les
pourcentages de chroma utilisent l'échelle CSS (`100 % = 0.4`) et la teinte est
normalisée en degrés dans `[0, 360)`. Les valeurs de chroma hors gamut ne sont
pas converties par ACE.

## Préparation et interpolation

`prepareInterval` accepte les `ColorValue` normalisés et les chaînes couleur
prises en charge. Il les prépare avant la résolution temporelle. Les tests
vérifient l'interpolation sRGB, l'interpolation OKLCH par le chemin de teinte
le plus court et le rejet d'exemples mal formés ou non pris en charge.

Le service `style` normalise les propriétés qu'il connaît comme couleurs avant
de produire `CompiledScene`. Il préserve les autres valeurs de style sans les
interpréter comme couleurs. Le materializer HTML convertit les `ColorValue`
sRGB en `rgba(...)` et conserve OKLCH sous la forme CSS `oklch(...)`.

Aucune couleur par défaut n'est ajoutée globalement par ACE ou le service
`style`. Un défaut éventuel relève du profil de la propriété ou de la scène.

## Code et acceptation

- Représentation et interpolation : [`interval.ts`](../src/ace/interval.ts).
- Analyse des valeurs CSS :
  [`color-adapter.ts`](../src/ace/adapters/color-adapter.ts) et
  [`named-colors.ts`](../src/ace/adapters/named-colors.ts).
- Normalisation par le service `style` :
  [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts).
- Analyse et interpolation : [`colors.spec.ts`](../tests/ace/colors.spec.ts)
  et [`interval.spec.ts`](../tests/ace/interval.spec.ts).
- Matérialisation HTML :
  [`component-materializer.spec.ts`](../tests/runtime/runner-html/component-materializer.spec.ts).

Le 2026-09-25, l'exécution ciblée des frontières couleur, build, service et
runner HTML a passé **6 fichiers et 94 tests**.

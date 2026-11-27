# CodPlay V2 — valeurs couleur

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Cette spécification décrit la normalisation des couleurs vers `ColorValue`,
leur préparation et leur interpolation dans ACE, la normalisation des
propriétés `style` déclarées lors du build et leur matérialisation HTML.

## Valeur intermédiaire

Les couleurs n'ont qu'un espace actif : OKLCH. Le compilateur et ACE
préparent toutes les couleurs sous cette forme :

```ts
type ColorValue = Readonly<{
  kind: 'color'
  space: 'oklch'
  coords: readonly [lightness, chroma, hue] // hue en degrés
  alpha: number
}>
```

Le parseur reconnaît les formes CSS Color 4 et les convertit toutes en OKLCH :
couleurs nommées de la table explicite, `transparent`, hexadécimal court et
long (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`,
`hsl()`/`hsla()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()` et
`color()` avec les espaces prédéfinis `srgb`, `srgb-linear`, `display-p3`,
`a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz`, `xyz-d50` et `xyz-d65`. Les
conversions suivent les matrices et fonctions de transfert de CSS Color 4.
Les noms sont insensibles à la casse ; `none` vaut `0`. Les canaux `rgb()` sont
bornés à la plage sRGB, les pourcentages suivent les échelles CSS de chaque
fonction et `alpha` est explicite, `1` quand elle manque. `color-mix()`, les
couleurs relatives, `currentcolor` et les autres espaces sont rejetés.

`L` d'un `oklch()` auteur est borné à `[0, 1]`, le chroma à `0` minimum et la
teinte normalisée dans `[0, 360)`. Une couleur dont le chroma est inférieur à
`1e-4` est achromatique : elle est stockée avec chroma et teinte nuls, pour
qu'aucun bruit d'arrondi ne devienne une teinte. Les valeurs hors gamut ne sont
pas ramenées par ACE ; le navigateur les ramène au rendu.

La forme intermédiaire sRGB (`space: 'srgb'`, canaux dans `[0, 1]`) est
dépréciée. Elle est encore acceptée en entrée du service `style`, d'ACE et du
materializer HTML, et convertie en OKLCH.

## Préparation et interpolation

Le service `style` normalise en OKLCH les propriétés qu'il connaît comme
couleurs (`color`, `backgroundColor`, `borderColor`), valeurs directes et
bornes de tween, avant de produire `CompiledScene`. Il préserve les autres
valeurs de style sans les interpréter comme couleurs. Une couleur non reconnue
produit `AUTHOR_STYLE_COLOR_INVALID`.

`prepareInterval` accepte les `ColorValue` et, en voie de dépréciation, les
chaînes couleur CSS, converties avant la résolution temporelle. Deux bornes
écrites dans des formes différentes s'interpolent donc toujours dans le même
espace. L'interpolation suit CSS Color 4 : lightness et chroma en alpha
prémultiplié, teinte par le chemin le plus court, et une borne achromatique
emprunte la teinte de l'autre borne. Un fondu vers `transparent` garde ainsi la
couleur de départ au lieu de s'assombrir.

Le materializer HTML écrit chaque couleur en `oklch(L C H / alpha)`, avec six
décimales au plus. Le chroma du rouleau de glyphes de replace interpole depuis
une teinte d'accent vers la couleur calculée du glyphe, et rend cette couleur
exacte en fin de transition.

Aucune couleur par défaut n'est ajoutée globalement par ACE ou le service
`style`. Un défaut éventuel relève du profil de la propriété ou de la scène.

## Références d’implémentation et de preuve

- Représentation et interpolation : [`interval.ts`](../src/ace/interval.ts).
- Analyse des valeurs CSS :
  [`color-adapter.ts`](../src/ace/adapters/color-adapter.ts) et
  [`named-colors.ts`](../src/ace/adapters/named-colors.ts) ; conversions :
  [`color-spaces.ts`](../src/ace/adapters/color-spaces.ts).
- Normalisation par le service `style` :
  [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts).
- Analyse et interpolation : [`colors.spec.ts`](../tests/ace/colors.spec.ts)
  et [`interval.spec.ts`](../tests/ace/interval.spec.ts).
- Matérialisation HTML :
  [`component-materializer.spec.ts`](../tests/runtime/runner-html/component-materializer.spec.ts).

# Selection Frame V2

## Rôle

`createSelectionFrameV2()` fournit une bordure d’édition neutre. L’hôte garde
l’autorité sur le document, le player, les unités auteur et les commits. Les
valeurs transmises au cadre sont des coordonnées locales en pixels CSS ; elles
restent des projections d’interface et ne définissent pas de format de
persistance.

## Géométrie affine

`SelectionFrameValue` décrit la boîte locale, son angle, ses échelles et son
axe de rotation. `rotationOrigin` exprime cet axe en fractions de la boîte,
avec le centre comme valeur par défaut.

Un hôte peut fournir `affineProjection` pour représenter la transformation 2D
complète de la boîte dans la scène. `origin` donne la position scène du point
local `(0, 0)` ; `matrix` contient les coefficients linéaires CSS `a, b, c, d`.
Cette représentation préserve aussi les cisaillements. Quand elle est présente,
le cadre DOM utilise cette origine et cette matrice ; le rendu ne reconstruit
pas l’affine à partir de `rotate` et `scaleX/Y`.

`selectionFrameLocalToScene()` projette les points locaux avec la matrice
complète. `updateSelectionFrameAffineOrigin()` recalcule son origine après un
changement de boîte ou de pose. `rotateSelectionFrameAffine()` applique la
rotation au linéaire existant et conserve ses autres contributions. Sans
`affineProjection`, la géométrie est dérivée de l’angle, des échelles et de
l’axe local.

Le cadre expose déplacement, redimensionnement, rotation et déplacement de
l’axe. Les deltas de déplacement et de taille sont en pixels locaux, la
rotation est en degrés et le pivot est une fraction absolue de la boîte. Les
gestes transmis à l’hôte restent distincts ; leur composition complète
appartient à l’hôte. Le paquet n’expose pas de poignée de cisaillement.

## Cycle d’un geste

L’hôte reçoit les deltas dans `onPreview` et décide de la projection de chaque
candidat. `onCommit` reçoit le candidat accepté au relâchement ; `onCancel`
abandonne le geste sans mutation documentaire. Le Selection Frame ne sérialise
pas les valeurs et n’accède pas au player.

## Limites

L’affine 2D permet de porter les transformations d’un item déjà composé,
y compris un cisaillement fourni par l’hôte. V2 ne définit pas de propriété
auteur `skew` ni de geste d’édition dédié. L’API `AuthorApi` V1 possède son
[contrat séparé](./selection-frame-v1-spec.md).

## Références de vérification

- [`v2.spec.ts`](../tests/v2.spec.ts) couvre le rendu affine, la rotation avec
  axe décentré, le déplacement de l’axe et la composition des outils.
- Le mode création V2 possède sa
  [spécification dédiée](./v2-creation-spec.md).

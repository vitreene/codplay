# Selection-frame — mode création

## Périmètre vérifié

Cette spécification décrit le mode création de l’entrée racine
`@codplay/selection-frame`. Il permet de produire une géométrie d’élément avant
que l’élément existe. Il ne décrit pas l’entrée distincte `/v2`.

Le cadre émet une géométrie à l’hôte ; la création et la persistance de l’item
restent sous la responsabilité de l’éditeur.

## Déclaration et émission

Fournir `creation: { onCreate }` active le mode création. Dans ce mode,
`itemId` et `adapter` peuvent être omis à la construction : aucun item n’est
encore attaché.

`onCreate` reçoit l’une de ces formes :

```ts
type CreationResult =
  | { kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
  | { kind: 'cell-area'; area: { row: number; col: number; rowSpan: number; colSpan: number } }
```

Un tracé libre émet un rectangle en pixels locaux du conteneur de référence.
Un tracé en contexte de grille émet l’emprise des pistes touchées. Sans contexte
explicite, une grille configurée active le tracé par cellule ; `context: 'libre'`
force le rectangle même dans ce conteneur. Les tests couvrent ces deux parcours.

Un tracé libre plus petit que `minTraceSizePx` sur l’un des axes est abandonné
et n’appelle pas `onCreate`. Un tracé accepté émet une seule fois au relâché.

L’hôte peut aussi fournir directement une géométrie :

```ts
type CreationGeometry =
  | { rect: { fx: number; fy: number; fw: number; fh: number } }
  | { cellArea: { row: number; col: number; rowSpan: number; colSpan: number } }
```

`applyCreationGeometry()` convertit le rectangle fractionnel dans les dimensions
locales du conteneur, ou place l’emprise dans la grille, puis appelle
immédiatement `onCreate`.

## Passage à la sélection

Après la création de l’item par l’éditeur, `attachItem({ itemId, adapter })`
attache l’item au même cadre. Le cadre existant est conservé ; le suivi de son
nœud passe alors par `subscribeToNode` et le mode normal de sélection prend le
relais. Les opérations de création sont sans effet hors du mode création.

## Preuves

- [`selection-frame.spec.ts`](../tests/selection-frame.spec.ts) couvre
  l’activation du mode, les tracés libre et grille, le contexte libre explicite,
  le seuil minimal, `applyCreationGeometry()` et le transfert par `attachItem()`.
- [`types.ts`](../src/types.ts) et
  [`selection-frame.ts`](../src/selection-frame.ts) portent l’interface et le
  circuit décrit ci-dessus.

# Selection-frame V2 — tracé de création

## Rôle

`createSelectionFrameV2()` peut monter une surface de création indépendante du
cadre attaché à un item existant. L’éditeur hôte garde la création documentaire,
la conversion d’unités et la persistance.

## Contrat

- Le paramètre optionnel `creation` fournit `onCreate`, `onCancel` facultatif
  et `minTraceSizePx` (4 px par défaut).
- `setCreationMode({ kind: 'free' })` trace un rectangle dans les coordonnées
  locales de la surface et émet `{ kind: 'rect', rect }` au relâché.
- `setCreationMode({ kind: 'grid', rows, cols })` accroche le rectangle aux
  pistes touchées et émet `{ kind: 'cell-area', area }` avec indices
  `row`/`col` à partir de 1 et spans entiers positifs.
- Un rectangle libre sous le seuil sur un axe n’est pas émis. Un
  `pointercancel`, une suspension ou un changement de mode interrompt le tracé
  courant sans création.
- La surface ne capte les pointeurs qu’en mode création ; le cadre de sélection
  existant est masqué le temps du tracé et revient à la fin du mode.
- La géométrie utilise `offsetX`/`offsetY` et les dimensions locales de la
  surface (`clientWidth`/`clientHeight`). Elle ne lit pas de rectangle DOM ni
  de nœud player.

## Preuves

[`tests/v2.spec.ts`](../tests/v2.spec.ts) couvre le rectangle libre, l’émission
au relâché, l’accrochage à la grille, le seuil, l’interruption et la visibilité
du cadre.

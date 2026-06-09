# Plan — Cadre de sélection (SelectionFrame)

## Contexte

En mode auteur, un éditeur externe à codplay doit pouvoir sélectionner et modifier visuellement les éléments d'une scène. Le cadre de sélection est le composant UI qui superpose un élément sélectionné pour permettre drag (translate) et resize. Il n'est pas un perso de la scène.

## Récapitulatif de la problématique

### Positionnement

`getBoundingClientRect()` seul est insuffisant : il donne une boîte axis-aligned et ne préserve pas la rotation. Le bon modèle est celui d'`overlay-world` : `position: fixed`, translation via `left/top`, rotation/scale via `matrix(a, b, c, d, 0, 0)` — la matrice combinée de tous les transforms parents jusqu'à la racine de scène.

### Scale : traitement séparé

Le scale de l'élément ne doit pas être appliqué comme transform sur le cadre. Si le scale était dans le transform, les bordures et poignées du cadre seraient elles-mêmes déformées visuellement. Le scale est absorbé dans les dimensions `width` et `height` du cadre :

```
scaleX = sqrt(M.a² + M.b²)
scaleY = sqrt(M.c² + M.d²)

frameWidth  = localWidth  × scaleX   // = worldWidth rendu
frameHeight = localHeight × scaleY   // = worldHeight rendu

rotationOnly = matrix(M.a/scaleX,  M.b/scaleX,
                      M.c/scaleY,  M.d/scaleY,  0, 0)
```

Le cadre reçoit `width: frameWidth`, `height: frameHeight`, `transform: rotationOnly`. Il enveloppe l'élément à sa taille rendue, orienté correctement, sans déformation de ses propres bordures et poignées.

### Drag → diff

Le delta souris est en espace viewport. Il est converti en espace local via l'inverse de la matrice cumulée (`worldDeltaToLocalDelta`). Le résultat est un `PersoEditDiff { x, y }` en espace local. C'est ce diff uniquement qui est transmis à l'éditeur.

Un élément positionné en grid (sans `position: absolute` ni `transform`) est déplacé par un translate additionnel — le diff est donc toujours un delta, jamais une position absolue extraite du rendu.

### Resize → diff

Les poignées de coin produisent un `{ width, height }` local via `worldSizeToLocalSize`.

### Interprétation du diff

L'éditeur possède la définition de l'action ciblée. Il sait si la valeur est absolue (`x: 30`) ou additive (`x: "+30"`, au sens anime.js) et applique le diff en conséquence. Le player ne connaît pas cette sémantique.

### Nœud instable

Le player peut détruire et recréer le nœud DOM (seek, re-init). Le cadre se rebranche via `subscribeToNode`, pas via une référence DOM directe.

## Ce qui existe déjà (à réutiliser)

| Besoin | Code existant |
|---|---|
| Matrice cumulée du nœud | `captureCombinedMatrixForNode` (privé dans `ListFlipModuleInstance`) |
| Conversion delta viewport → local | `worldDeltaToLocalDelta` (idem) |
| Conversion size viewport → local | `worldSizeToLocalSize` (idem) |
| Positionnement overlay world | pattern `setupClone` dans `createOverlayWorldPhotoClones` |
| Layer overlay fixe | `ensureOverlayLayer` (idem) |
| Noms de propriétés | `FlipTransitionState` : `x, y, width, height` |

## Plan d'implémentation

### Étape 1 — Extraire les utilitaires matrix ✓

Extraire de `create-list-flip-module.ts` vers un nouveau fichier `src/runtime/modules/list-flip/engine/dom-matrix.ts` :

- `captureCombinedMatrixForNode(node: Element): Matrix2D`
- `worldDeltaToLocalDelta(matrix: Matrix2D, dx: number, dy: number): { x: number; y: number }`
- `worldSizeToLocalSize(matrix: Matrix2D, w: number, h: number): { width: number; height: number }`

Ces fonctions doivent devenir des exports publics du moteur. `create-list-flip-module.ts` les importe ensuite au lieu de les définir en privé.

### Étape 2 — Définir `PersoEditDiff`

```ts
// src/authoring/types.ts
type PersoEditDiff = {
  x?: number
  y?: number
  width?: number
  height?: number
}
```

Mêmes noms que `FlipTransitionState`. Module `src/authoring/`.

### Étape 3 — Exposer `subscribeToNode` sur le player

Ajout minimal à `PlayerApi`, actif en mode `'author'` uniquement :

```ts
subscribeToNode(persoId: string, cb: (node: Element | null) => void): () => void
```

**Contexte d'implémentation**

Le nœud DOM d'un perso n'a aucun attribut `data-perso-id` — il n'est pas interrogeable depuis le DOM. La seule source de vérité est `nodeByPersoId : Map<string, unknown>` dans `RuntimeComponentOrchestrator` (privé, ligne 83). Le persoId est la clé stable, le nœud est la valeur.

Ce nœud est écrit à l'initialisation du perso (`nodeByPersoId.set(perso.id, rootNode)`, ligne 460) et peut être remplacé lors d'un re-init (seek profond, destroy partiel). La map est vidée entièrement au `clear()` (ligne 486).

**Modification à apporter à l'orchestrateur**

Ajouter un `Map<string, Set<(node: Element | null) => void>>` de subscribers dans `RuntimeComponentOrchestrator`. Chaque appel existant à `nodeByPersoId.set(persoId, node)` notifie les abonnés avec le nouveau nœud. Le `clear()` notifie tous les abonnés avec `null`. Le player délègue `subscribeToNode` à l'orchestrateur.

Aucun attribute DOM n'est ajouté — la résolution reste entièrement dans le runtime.

### Étape 4 — Implémenter `SelectionFrame`

```ts
// src/authoring/selection-frame.ts

type SelectionFrameOptions = {
  node: Element
  sceneRoot: Element
  onDiff: (diff: PersoEditDiff) => void
}

function createSelectionFrame(options: SelectionFrameOptions): { destroy: () => void }
```

Responsabilités :
- Créer le layer overlay fixe (pattern `ensureOverlayLayer`)
- Capturer `{ rect, matrix, localWidth, localHeight }` du nœud cible à l'attache et à chaque rebranchement (via `ResizeObserver` + `MutationObserver` sur les ancêtres si nécessaire)
- Positionner le cadre : `position: fixed`, `left/top` depuis `rect`, `width/height` depuis `localWidth × scaleX` / `localHeight × scaleY`, `transform: rotationOnly` (scale extrait de la matrice, e/f à zéro — la translation est dans `left/top`)
- Pointer events sur le corps du cadre : drag → `worldDeltaToLocalDelta` → preview + `onDiff` au relâché
- Pointer events sur les poignées de coin : resize → `worldSizeToLocalSize` → preview + `onDiff` au relâché
- `destroy()` : détache les listeners, supprime le layer

### Étape 5 — Scène de démo

Une scène avec un seul perso `layout` (une div avec `transform: rotate(20deg)` pour valider le cadre sur un élément tourné). Le player en mode auteur. Un `SelectionFrame` branché via `subscribeToNode`. Le `onDiff` logue le diff en console et applique visuellement le translate pour feedback immédiat.

Fichiers :
- `src/demos/scenes/selection-frame-scene.ts`
- `src/demos/codplay/selection-frame-demo.ts`

## Points ouverts

1. **Emplacement** : confirmer `src/authoring/` comme module pour `SelectionFrame` et `PersoEditDiff`.
2. **`subscribeToNode`** : vérifier si des attributs `data-perso-id` (ou équivalent) sont déjà posés sur les nœuds montés — pourrait court-circuiter l'implémentation pour la démo.
3. **Rebranchement** : définir précisément quand `subscribeToNode` doit notifier — uniquement sur destroy/recreate, ou aussi sur chaque seek qui repositionne le nœud ?
4. **Poignées** : V1 = 4 coins uniquement. Les poignées de côté (redimensionnement sur un seul axe) sont hors scope pour l'instant.

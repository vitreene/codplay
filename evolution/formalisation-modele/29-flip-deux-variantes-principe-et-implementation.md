# FLIP: deux variantes, principe et implementation

## Statut

Note technique d'implementation, orientee code runtime actuel.

Objectif: expliquer de facon lisible et detaillee les deux variantes FLIP disponibles:

- `local` (mode par defaut)
- `overlay-world` (mode opt-in auteur)

---

## 1) Vue d'ensemble rapide

Le runtime utilise toujours le meme socle FLIP (`FIRST -> LAST -> INVERT -> PLAY`), mais applique deux strategies de rendu selon le contexte visuel.

### Variante A - `local`

- le node reel est anime dans son conteneur
- robuste pour la majorite des moves/reorders
- simple a maintenir

### Variante B - `overlay-world`

- le node reel est temporairement masque
- un clone anime en espace "world" dans une overlay layer
- utile quand deux listes se chevauchent et que le transfert doit rester visible

---

## 2) Invariants partages

Les deux variantes partagent ces regles:

1. un seul pipeline d'animation (adapter animejs)
2. mesure DOM comme source de verite (`getBoundingClientRect`, styles computes)
3. decisions FLIP centralisees dans l'orchestrator runtime
4. transitions converties en `TransitionRequest` standard

Code de reference:

- `src/runtime/flip-engine/create-flip-engine.ts`
- `src/runtime/components/runtime-component-orchestrator.ts`

---

## 3) Variante `local`: principe

Le principe est FLIP classique:

1. capturer `FIRST` (avant move)
2. appliquer la mutation (reparent/reorder)
3. capturer `LAST` (apres move)
4. calculer l'etat inverse (`from`) pour que le premier frame visuel corresponde a `FIRST`
5. animer vers `to` (etat `LAST`)

### Ce qui est calcule

- deplacement local (`x`, `y`)
- taille (`width`, `height`)
- compensation de transform heritee (`rotate`, `scaleX`, `scaleY`)

Le moteur prend en compte les matrices parent + node, puis convertit en canaux animables.

---

## 4) Variante `local`: implementation actuelle

Chemin principal:

1. l'orchestrator collecte les `flipEntries`
2. capture `firstFlipSnapshots`
3. applique move + update composant
4. capture `lastFlipSnapshots`
5. `flipEngine.plan(first, last)`
6. `flipEngine.applyInvert(...)`
7. calibration locale optionnelle (pour mieux coller au FIRST)
8. conversion en transitions runtime (`toAnimationTransitions`)

Points code:

- `src/runtime/components/runtime-component-orchestrator.ts` (bloc `routeUpdates`)
- `src/runtime/flip-engine/create-flip-engine.ts` (`capture`, `plan`, `applyInvert`, `toAnimationTransitions`)

---

## 5) Variante `overlay-world`: principe

Cette variante existe pour un probleme visuel specifique:

- l'item transferre change de contexte parent
- les listes peuvent se chevaucher
- animer le node reel localement peut produire une discontinuite visuelle

Solution:

1. calculer une photo `old` et `next` en world-space
2. creer deux clones world (`old` et `next`)
3. masquer le node reel pendant la transition
4. animer le clone `old` vers l'etat du clone `next`
5. detruire clones + reveler node reel en fin

---

## 6) Variante `overlay-world`: points clefs d'implementation

### 6.1 Decision de mode

Dans `routeUpdates`, si `move.flipMode === 'overlay-world'`:

- on retire la transition FLIP locale de l'item deplace
- on conserve les transitions locales des autres items touches
- on ajoute des transitions overlay pour l'item deplace

### 6.2 Photos world (`old` / `next`)

Le runtime calcule des photos world a partir de l'etat FLIP local:

- `computeOverlayWorldPhotosFromLocalFlip(...)`
- `captureWorldPhotoFromLocalFlipState(...)`

Important:

- `old` est calibre pour coller au FIRST reel
- `next` est derive de l'etat local `to`

### 6.3 Verrouillage obligatoire de `w/h`

C'est le point qui a stabilise la demo.

Regle appliquee:

- mesurer les tailles locales reelles pour `old` et `next`
- appliquer ces `width/height` explicitement aux clones
- ne pas laisser la calibration recasser ces tailles

Concretement:

- les tailles sont stockees dans `OverlayWorldPhoto.localWidth/localHeight`
- `createOverlayWorldPhotoClones(...)` force `style.width/style.height`
- `calibrateOverlayGhostToWorldSnapshot(..., { lockSize: true })` n'ajuste plus la taille

### 6.4 Ajustement matrice pour lisser

Pour reduire les petits ecarts restants, la matrice world du clone est tunee:

- `tuneMatrixToWorldSize(...)`

But:

- conserver les `w/h` forces
- rapprocher la projection world du clone de la cible

### 6.5 Transition reelle remise en place

La variante n'est plus en mode "photo statique".

Le runtime construit des transitions:

- `left`, `top`, `width`, `height`
- `transform` (matrix CSS complete)

Chemin:

- `buildOverlayWorldTransitions(...)`

Lifecycle:

1. `nextCloneNode` cache (reference)
2. `animatedCloneNode` visible et anime
3. node reel masque pendant l'animation
4. en finalize: revele node reel, cleanup overlay

---

## 7) Pourquoi `overlay-world` est plus difficile que `local`

`local` anime un node dans son contexte CSS naturel.

`overlay-world` doit reconstruire simultanement:

- position world
- orientation/scale
- taille locale de rendu

Or une bbox world seule n'encode pas toute l'information de layout local.

Conclusion pratique:

- en `overlay-world`, il faut forcer explicitement les dimensions locales mesurees, sinon le rendu peut diverger (surtout sur `height`).

---

## 8) Exemples concrets

## Exemple A - move local simple

Payload auteur:

```ts
{
  move: {
    parentId: 'list-a',
    mode: 'append',
    flip: true,
    flipMode: 'local'
  }
}
```

Effet runtime:

- le node reel est anime directement
- transitions FLIP locales generees pour l'item et les items impactes

## Exemple B - transfert entre listes qui se chevauchent

Payload auteur:

```ts
{
  move: {
    parentId: 'list-b',
    mode: 'prepend',
    flip: true,
    flipMode: 'overlay-world'
  }
}
```

Effet runtime:

1. l'item deplace n'utilise pas sa transition locale FLIP
2. un clone `old` et un clone `next` sont poses en overlay world
3. `w/h` old/next sont mesures puis imposes aux clones
4. animation du clone `old -> next`
5. node reel masque puis revele en fin

Resultat attendu pour la demo:

- continuite visuelle pendant le transfert
- dimensions stables (pas de saut de `height`)

---

## 9) Extrait de pseudo-code (orchestrator)

```ts
if (move.flipMode !== 'overlay-world') {
  return localFlipTransitions
}

worldPhotos = computeOverlayWorldPhotosFromLocalFlip(...)
clones = createOverlayWorldPhotoClones(worldPhotos)

hide(realNode)
hide(clones.next)

overlayTransitions = buildOverlayWorldTransitions({
  from: clones.old,
  to: clones.next
})

onFinalize(() => {
  show(realNode)
  cleanup(clones)
})

return overlayTransitions
```

---

## 10) Check-list de validation rapide

Pour verifier qu'une regression n'a pas ete introduite:

1. `npm run test:lot8` (coeur FLIP local)
2. `npx vitest run tests/lot18` (orchestration move/overlay)
3. `npm run build`

Observation visuelle demo:

- aller + retour d'un item entre deux listes
- absence de saut brutal de `height`
- apparition/disparition propre du clone

---

## 11) Resume decisionnel

- `local` reste la voie par defaut: simple, robuste, peu couteuse
- `overlay-world` est une variante specialisee pour overlap/reparent critiques
- la cle de stabilite overlay est: **mesurer puis forcer `w/h` aux deux etats**
- la transition actuelle de demo est assez stable pour livraison de preuve visuelle

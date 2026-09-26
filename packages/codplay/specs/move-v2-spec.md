# CodPlay V2 — contrat auteur de `move`

## Périmètre vérifié

Cette spécification fixe la forme auteur de `move`, sa compilation et les
informations de placement ou de présentation qu’elle transmet au runtime. Les
validations complètes des cycles Play/Seek, reset, replay, retarget et capture
restent suivies par les [plans motion](../plan/motion-live-discovery-invalidation-plan.md),
[move vers une cible dépendante](../plan/move-target-dependency-plan.md),
[Seek DnD/capture S6](../plan/drag-capture-list-s6-validation-plan.md).

## Déclaration auteur

`move` est un champ commun aux états initiaux et aux actions d’un perso. Il
accepte une chaîne de destination ou un objet dont `target` est obligatoire.

```ts
type Move = string | Readonly<{
  target: string
  mode?: 'auto' | 'first' | 'last' | 'append' | 'prepend' | number
  reparent?: boolean
  reorder?: boolean
  resize?: Readonly<{
    width?: 'auto' | 'preserve' | 'container'
    height?: 'auto' | 'preserve' | 'container'
  }>
  transition?: Readonly<{
    duration?: number
    delay?: number
    ease?: string
    path?: string
  }>
}>
```

La chaîne `target` est équivalente à `{ target }`. `@root` désigne la racine de
montage de la scène ; `@off` détache le perso. Une autre chaîne nomme une cible
de placement résolue par le registre runtime.

## Placement et présentation

- `target` choisit la destination structurelle.
- `mode` choisit la position dans l’ordre de la cible ; il ne sélectionne pas
  le mode de présentation.
- `reorder` est transmis comme métadonnée de placement pour la politique
  d’ordre de la cible.
- `reparent: true` demande la présentation par overlay. Un changement de parent
  structurel produit aussi une présentation `reparent`, tandis qu’un placement
  local inchangé reste présenté localement par défaut.
- `resize` porte une option indépendante par axe. Les valeurs acceptées sont
  conservées jusqu’au schedule motion. La réservation de dimension de
  `height: 'preserve'` est vérifiée par le host HTML ; `width: 'preserve'` et
  les combinaisons d'axes restent à valider au plan dimensions. L’effet
  géométrique de `container` reste également dans ce plan.

La structure résolue ne contient pas `transition`. Le test du pipeline vérifie
que le solveur conserve les métadonnées structurelles sans verser la transition
dans le graphe de placement.

## Transition et chemin

`transition` accepte `duration`, `delay`, `ease` et `path`. Le builder prépare
une chaîne SVG `path` en valeur `Path` sérialisable avant que la scène soit
exécutée. Le runtime motion consomme cette valeur préparée en suivant sa
longueur cumulée (`arc-length`) et le centre visuel affine de l’élément
(`center`). Les paramètres d’intégration `traversal` et `pathAnchor` ne font
pas partie de la déclaration auteur.

Les exemples vérifiés couvrent les commandes SVG `M`, `L` et `A` : segments
droits et arcs elliptiques. Le compilateur refuse une commande cubique `C` ;
la déclaration `path` ne certifie donc pas la prise en charge de l'ensemble du
format SVG.

## Invariants vérifiés

- La destination et l’ordre sont des données de placement ; la transition est
  une donnée de présentation.
- Les cibles racine et détachée sont résolues par le même circuit de placement
  que les autres destinations.
- Un `reparent` explicite est transmis au schedule ; les changements de parent
  sont représentés dans le graphe motion par une présentation `reparent`.
- Les options `resize` validées par le compilateur sont transportées au schedule.
- `height: 'preserve'` réserve la hauteur naturelle de destination pendant la
  période active puis retire cette réservation. La largeur et les combinaisons
  d'axes ne sont pas encore certifiées.
- Le chemin SVG déclaré est transformé en `Path` préparé avant l’exécution.

## Code et acceptation

- Forme publique : [`scene/types.ts`](../src/scene/types.ts).
- Compilation du chemin :
  [`move-path-compiler.ts`](../src/scene/compiled/move-path-compiler.ts).
- Résolution de placement :
  [`move-policy.ts`](../src/runtime/move/move-policy.ts).
- Schedule et présentation :
  [`motion-schedule.ts`](../src/runtime/motion/motion-schedule.ts) et
  [`graph-builder.ts`](../src/runtime/motion/motion-graph/graph-builder.ts).
- Les tests builder, solveur, schedule, graphe, pose et host HTML sont référencés
  dans [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts),
  [`pipeline.spec.ts`](../tests/runtime/player/pipeline.spec.ts),
  [`motion-schedule.spec.ts`](../tests/runtime/motion/motion-schedule.spec.ts),
  [`motion-graph.spec.ts`](../tests/runtime/motion/motion-graph.spec.ts),
  [`motion-pose.spec.ts`](../tests/runtime/motion/motion-pose.spec.ts) et
  [`motion-presentation-host.spec.ts`](../tests/runtime/runner-html/motion-presentation-host.spec.ts).

Le 2026-09-25, l’exécution ciblée de ces frontières et des tests de placement
et runner a passé **9 fichiers et 139 tests**.

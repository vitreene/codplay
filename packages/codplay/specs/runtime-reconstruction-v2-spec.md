# CodPlay V2 — reconstruction logique d’une scène

## Périmètre vérifié

Cette spécification décrit le chemin logique exécuté par le player pour une
scène compilée et une position temporelle :

```text
CompiledScene + position temporelle + journal runtime
  -> materialize
  -> resolve
  -> solve
  -> état logique et graphe structurel
```

La reconstruction ne lit pas le DOM et ne crée pas de composant. La présentation
HTML est décrite par les spécifications de composants et du runner. Les faits
runtime, leur visibilité et le reset des stories relèvent de la
[spécification événementielle](./event-pipeline-v2-spec.md). Les formes auteur
et la présentation de `move` relèvent de la [spécification move](./move-v2-spec.md).

## `materialize`

[`materializeScene`](../src/runtime/player/pipeline/materialize.ts) sélectionne
les occurrences actives à la position demandée. Les actions résultantes gardent
l’ordre temporel et les métadonnées nécessaires à leur résolution. Le registre
des tracks statiques suit l’ordre de déclaration. Une track inactive ne fournit
pas ses événements statiques ; un événement runtime est évalué depuis sa propre
track déclarée.

La reconstruction accepte aussi le côté gauche exclusif d’une frontière
d’événement, sans décaler le temps avec un epsilon numérique. Un temps non fini
est refusé avant l’évaluation.

Les événements, sorties de straps, états journalisés, portées et règles de
reset sont spécifiés dans le document événementiel. L’expansion vérifiée des
`ActionSequence` et `TweenAction` est décrite dans leur
[spécification](./action-sequence-tween-v2-spec.md).

## `resolve`

[`resolveScene`](../src/runtime/player/pipeline/resolve.ts) reconstruit l’état
des persos à partir de leur état initial et des actions matérialisées. Il
applique les patches discrets dans l’ordre et résout les valeurs prises en
charge par ACE sans muter les données compilées. Les fonctions de
`TweenAction` utilisent la même position temporelle que la reconstruction par
Seek. Les canaux, unités et types de valeur certifiés sont détaillés dans les
spécifications [transformation](./transform-properties-v2-spec.md),
[unités](./unit-values-v2-spec.md) et [couleurs](./color-values-v2-spec.md).

## `solve`

[`solveScene`](../src/runtime/player/pipeline/solve.ts) résout les placements
depuis le registre interne des cibles, puis construit le graphe parent/enfant
des persos. Les identifiants de cible sont traités comme des identifiants
opaques ; leur nom n’encode pas leur propriétaire. Les états détachés se
propagent aux descendants et un cycle de parentage est rejeté.

Les conflits de placement au même instant et les métadonnées d’ordre sont
résolus dans le graphe structurel. La capacité `list` garde ses propres
politiques d’ordre et de dimension dans ses plans. Le solveur ne projette pas
ces résultats sur un substrat.

[`diffSolvedScenes`](../src/runtime/move/move-state.ts) compare deux résultats
résolus et produit des deltas génériques `mount`, `unmount` et `move`. Il ne
réordonne pas les enfants et n’applique aucune politique de renderer ou de
liste.

## Preuves

- [`pipeline.spec.ts`](../tests/runtime/player/pipeline.spec.ts) vérifie
  l’ordre des occurrences, les frontières temporelles, le registre et
  l’activité des tracks, les patches résolus sans mutation, les placements,
  l’ordre stable du graphe, la propagation du détachement, les cycles et le
  refus d’un temps invalide.
- [`move-state.spec.ts`](../tests/runtime/player/move-state.spec.ts) vérifie
  les deltas structurels génériques et l’absence de delta lorsque le placement
  ne change pas.
- [`presentation-graph.spec.ts`](../tests/runtime/player/presentation-graph.spec.ts)
  vérifie le parcours parent-first des outlets imbriqués et le rejet d’un ordre
  de module qui déplacerait temporairement un item vers une autre cible.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/player/pipeline.spec.ts \
  tests/runtime/player/move-state.spec.ts \
  tests/runtime/player/presentation-graph.spec.ts
3 fichiers, 35 tests réussis
```

## Frontières

Les mesures dépendantes du DOM, la présentation motion, les capacités de liste,
la capture et le DnD ne sont pas définis par cette spécification. Leurs
comportements certifiés et leurs acceptations restantes sont décrits dans les
spécifications et plans spécialisés liés ci-dessus.

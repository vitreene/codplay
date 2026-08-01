# CodPlay V2 - tranche materialize, resolve et solve

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before components

## Frontiere

Cette tranche consomme uniquement un `CompiledScene` et une position temporelle.
Elle ne lit pas le DOM, ne cree pas de composant et ne produit aucun effet externe.

```text
CompiledScene + timeMs
        -> materialize
        -> MaterializedScene
        -> resolve
        -> ResolvedScene
        -> solve
        -> SolvedScene
```

## Materialize

`materializeScene(scene, timeMs)` selectionne les occurrences discretes dont
`startAt <= timeMs` et les associe aux persos concernes. Il conserve l'ordre
chronologique, puis l'ordre de declaration pour les occurrences au meme instant.

Materialize :

- ne modifie pas `CompiledScene`;
- ne prepare pas de tween;
- ne lit pas le DOM;
- ne rejoue pas de strap;
- porte l'elapsed time de chaque action active vers l'etape suivante.

La premiere tranche reconnait seulement les eventimes `{ name, startAt }` et les
actions dont la valeur est un record compile.

## Resolve

`resolveScene(materialized)` produit un etat de perso resolu :

- les patches `className` sont appliques dans l'ordre materialise;
- les tweens `style` scalaires sont prepares et resolus par ACE;
- les couleurs sont normalisees par l'adapter avant ACE;
- les donnees compilees ne sont jamais mutilees.

Resolve ne compose pas encore les ancetres et ne projette pas vers un substrat.

## Solve

`solveScene(resolved)` etablit la sortie stable de la tranche et preserve les
identites `storyId:persoId`. Cette premiere implementation ne pretend pas encore
resoudre la hierarchie, les moves, les transforms d'ancetres ou les mesures.

Le solve hierarchique sera une extension de cette frontiere, pas une modification
de `materialize` ou de `resolve`.

## Invariants

- Une evaluation depend uniquement de `CompiledScene` et `timeMs`.
- Un temps invalide est refuse avant l'evaluation.
- Aucun traitement de cette tranche n'ecrit dans le DOM ou dans un composant.
- Aucun event discret n'est transforme en effet externe.
- Les valeurs ACE sont preparees avant leur resolution.
- Les sorties portent des types de tranche nommes, pas un `CompiledRecord` ambigu au
  niveau de la frontiere complete.

## Hors perimetre

- tracks et listen complets;
- straps et emissions;
- `live`, capture et DnD;
- hierarchie, move, FLIP et matrices d'ancetres;
- media, preload et services runtime;
- composants et renderer de production.

## Validation

La tranche est couverte par `tests/runtime/player/pipeline.spec.ts` et reste exercee
par la demo temporaire `demos/validation/player`. La demo est un banc visible, pas
la definition du contrat final.

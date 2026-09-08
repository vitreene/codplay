# Coordination mouvement / listes V2

> Status: En cours — coordination logique conservée ; syntaxe `move` et
> préparation motion alignées sur la migration autorisée.
> CodPlay version: V2 foundation
> Référence : [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md)

Ce document conserve uniquement le contrat de coordination résolu. La
préparation par occurrence est définie dans
[`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md) ;
le présent plan ne crée ni calendrier motion global, ni circuit de liste parallèle.

## Contrat

- `SolvedGraph` porte la membership et l'ordre complet par target.
- `StructuralTimeline` porte cet ordre à chaque frontière compilée.
- La capacité list fournit les politiques V1 `reorderOnMove/Add/Remove` au calcul
  structurel, sans conserver de reducer d'ordre concurrent.
- Le runner HTML capture les géométries nécessaires avant/après l'événement sur
  les materialisations auteur visibles.
- Tous les items dont l'attachement local change reçoivent un segment propre.
- Le changement reste local dans une même target et devient reparent entre deux
  targets.
- Play et Seek résolvent le même `MotionGraph` à un temps absolu.
- `mount`, `unmount`, reparentage et reorder ne détruisent pas les materialisations
  auteur ; les mêmes éléments sont conservés et réutilisés au seek.
- Seules les représentations techniques transitoires, comme les clones d'overlay,
  sont créées et détruites au cours d'une présentation.

## Modes

`reparent` est facultatif :

- absent ou `false` dans la même target : présentation locale ;
- target/parent différent : reparent forcé par overlay ;
- `reparent: true` : overlay explicite même dans une target inchangée.

`mode` reste la propriété d’ordre. `reparent` ne modifie jamais la destination
ou l’ordre logique.

## Circuits internes écartés

Ces éléments sont des circuits internes qui ne doivent pas être recréés ; cette
liste ne retire aucune API auteur. La seule évolution de forme auteur est le
remplacement de `flipMode` par `reparent` dans le plan de migration.

La coordination ne repose plus sur `touchedItemIds`, l'identification de
captures par un cache historique, des aliases, le replay d'un module list, un
handoff de ghost ou une transaction FIRST/LAST construite sur le DOM visible.
Les groupes de capture par occurrence restent nécessaires ; le plan motion les
ferme sur les materialisations auteur et les publie par un commit unique.

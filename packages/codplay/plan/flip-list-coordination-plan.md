# Coordination mouvement / listes V2

> Status: Fixe
> CodPlay version: V2 foundation
> Review: validé le 2026-08-20 pour la coordination structurelle et le mouvement compilé

Ce document conserve uniquement le contrat de coordination résolu. La
description capture-centrique précédente est remplacée par
[`runner-flip-integration-study.md`](./runner-flip-integration-study.md).

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

`flipMode` est facultatif :

- absent ou `local` dans la même target : présentation locale ;
- target/parent différent : reparent forcé par overlay ;
- `overlay-world` : reparent explicite même dans une target inchangée.

Le mode ne modifie jamais la destination ou l'ordre logique.

## Concepts supprimés

La coordination ne repose plus sur `touchedItemIds`, captures groupées, aliases,
cache historique, replay d'un module list, handoff de ghost ou transaction
FIRST/LAST sur le DOM visible.

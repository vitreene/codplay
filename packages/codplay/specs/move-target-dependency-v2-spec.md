# CodPlay V2 — dépendance d’un mouvement actif à sa cible

## Périmètre vérifié

Cette spécification décrit le comportement vérifié du graphe motion lorsqu’une
cible résolue change pendant un mouvement dépendant. Elle couvre la mise à
jour des segments actifs et les cas où aucune mise à jour n’est attendue. La
validation complète sur le runner HTML et ses parcours Play/Seek reste au
[plan d’acceptation](../plan/move-target-dependency-plan.md).

La forme auteur de move et sa compilation sont définies dans la
[spécification move](./move-v2-spec.md). Ici, target désigne la cible
structurelle résolue dans les snapshots de présentation.

## Retarget vérifié

Lorsqu’un mouvement actif a son endpoint attaché à une cible résolue et qu’une
frontière ultérieure déplace cette cible, le graphe ajoute un retarget au
segment actif. La pose présentée à la frontière reste continue et la pose à
l’endpoint suit la destination recalculée.

Tous les mouvements actifs attachés à la même cible concrète sont retargetés.
Lorsqu’un nouveau mouvement direct remplace un segment actif, il repart de la
pose visible à la frontière et conserve l’endpoint initial avec la durée
restante. Le graphe conserve les segments antérieurs nécessaires à
l’évaluation temporelle.

## Cas sans retarget

Les tests vérifient qu’un retarget n’est pas ajouté lorsque :

- une cible absente au début est simplement montée ensuite ;
- un frère change de pose dans la même cible sans déplacer la cible elle-même ;
- un ancêtre avance pendant un reflow indépendant de la cible ;
- le segment concerné a déjà été remplacé par un mouvement plus récent.

## Vérification

Les assertions du graphe sont dans
[motion-graph.spec.ts](../tests/runtime/motion/motion-graph.spec.ts). Les
tests de layout, de capture et de frontière runner associée se trouvent dans
[motion-layout.spec.ts](../tests/runtime/motion/motion-layout.spec.ts),
[motion-capture.spec.ts](../tests/runtime/runner-html/motion-capture.spec.ts)
et [story-six-motion.spec.ts](../tests/facade/story-six-motion.spec.ts).

Le 2026-09-26, la validation ciblée de ces frontières et de la première
frontière runner a passé cinq fichiers et 50 tests.

## Limites

Cette spécification ne certifie pas encore la fréquence de capture pendant un
drag réel, l’équivalence de toutes les sources d’événements, ni les parcours
complets de conflit, reset, répétition, resize, persistance, lifecycle et
destruction. Ces gates restent au plan d’acceptation.

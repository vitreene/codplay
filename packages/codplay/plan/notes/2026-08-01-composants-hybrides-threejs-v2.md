# Rationale — projection Three hébergée par un composant

## Rôle

Cette note conserve le motif de séparation entre l'hôte HTML d'une projection
native et les composants logiques qui contribuent à cette projection. Elle ne
définit pas les contrats : les spécifications courantes de
[`rel`](../../specs/third-party-rel-spec.md), du
[pont de cible](../../specs/third-party-target-bridge-spec.md), des
[bibliothèques](../../specs/third-party-library-spec.md) et de la
[première unité Three.js](../../specs/third-party-threejs-spec.md) font foi.
Les travaux d'intégration restent au [plan tiers](../2026-09-18-third-party-components-v2-plan.md)
et au [plan Avatar](../2026-09-19-avatar-components-v2-plan.md).

## Motif de la frontière

Le matérialiseur HTML possède le montage et le placement DOM. Un host Three
possède ensuite son canvas, son renderer, sa scène et son commit. Cette
projection reste une capacité d'un composant d'intégration ; le matérialiseur
global CodPlay demeure HTML/DOM. Ainsi, une application peut mêler des
représentations DOM et une projection native hébergée sans demander au core de
sélectionner un renderer global.

Les composants logiques qui règlent caméra, lumière, géométrie ou Avatar sont
rattachés par `rel`. La relation exprime une destination de capacité native ;
`move` conserve son rôle de placement structurel dans la scène HTML. Le core
ne connaît ni les types Three ni les nœuds internes d'un modèle et ne parcourt
pas les valeurs opaques publiées.

Les composants attachés évaluent leurs états depuis le temps absolu CodPlay et
laissent le host effectuer le commit de présentation. Ils ne démarrent pas de
clock ou de boucle de rendu parallèle. Cette propriété permet à l'intégration
de reconstruire un même état en Play et en Seek.

## Choix Avatar en cours

Le plan Avatar porte actuellement lip-sync comme composant logique séparé,
rattaché à l'Avatar par `rel`, parce qu'il transforme des événements de visème
en contributions de pose. Ce choix s'applique à la transposition en cours ; une
future représentation comme capacité interne nécessiterait une décision et une
acceptation propres. La composition de ses contributions avec les clips et les
autres couches reste à relire dans le plan Avatar.

# CodPlay V2 — gestes Avatar

## Rôle

`avatar-gesture` reçoit les actions ordinaires `avatar:gesture:<nom>` de son
perso et les transmet au coordonnateur de l'Avatar désigné par `rel.target`.
Il ne possède ni le modèle Three, ni ses os, ni le rendu. Le composant central
`avatar` présente les gestes dans son unique flux `avatar-coordinate`.

## Temps et interruptions

Les occurrences de la track geste restent ordonnées par leur date `startAt`.
Le composant échantillonne les canaux morphiques des motions TalkingHead à la
date CodPlay et utilise la graine de l'occurrence pour leurs choix aléatoires.
Une nouvelle action qui interrompt la précédente part de la valeur obtenue à
sa date de départ. L'état initial sans geste fait partie du même historique :
la première action prend ses canaux depuis la valeur spontanée affichée à sa
date, avec le même raccord de `250 ms` que les actions suivantes. Ce raccord
est échantillonné à la date CodPlay ; il n'ajoute aucun lissage dépendant des
frames. Chaque morph prend sa propre part de propriété : l'arrivée d'un canal
absent du geste précédent commence depuis la couche spontanée, même si
d'autres canaux du geste précédent sont encore en cours de sortie. La sortie
naturelle d'une motion et l'action
`avatar:gesture:release` ramènent les morphs du geste vers la couche spontanée
courante sur `250 ms`. L'interruption explicite utilise l'easing TalkingHead ;
la sortie naturelle suit les durées de la motion. Un `release` reçu après la
fin d'une motion ne reprend pas la propriété de ses canaux morphiques.
L'échantillon calculé est appliqué directement au moteur de morphs ; il ne
reçoit pas un second lissage dépendant des frames. La parole garde la priorité
si elle et un geste revendiquent le même morph.

Les marqueurs de gestes squelettiques et de poses contenus dans une motion
sont conservés avec leur date absolue. Le coordonnateur les rejoue avec les
changements de pose du mood dans l'ordre des dates à chaque présentation.
Un Seek vers l'avant ou l'arrière reconstruit donc la source d'une transition
native à partir des instructions auteur déjà reçues, sans réutiliser l'état
mutable de la frame précédente.

Un visème ne porte aucune instruction de geste. Les actions de mood et de
regard gardent leurs tracks respectives. Le geste ne sélectionne aucun mode
corporel à partir de la track `word` ou de la parole.

## Validation

Les tests autonomes comparent les valeurs d'un `bow` interrompu en Play et en
Seek pendant sa sortie, l'entrée du premier geste depuis une couche mood
non nulle, ainsi que la pose d'un geste natif pendant son
relâchement. Le plan Avatar conserve le suivi des validations du modèle réel
et des autres transformations de la composition.

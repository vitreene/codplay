# CodPlay V2 — regard Avatar

## Rôle

`avatar-gaze` reçoit ses propres événements ordinaires et contribue au regard
de la cible Avatar. Le perso se rattache par `rel.target` ; il ne reçoit ni la
caméra Three, ni les os, ni le modèle. Le composant central `avatar` obtient la
caméra du host et présente la contribution de regard après les couches
morphiques, dans son flux de présentation commun.

## Instructions et temps

Le contact caméra est actif par défaut (`enabled: true`). L'initial du perso
peut le désactiver, régler sa force avec `contact` (valeur par défaut `1`),
la participation de la tête avec `headMove` et une durée par défaut avec
`durationMs`. Tant que le contact est actif, sa force échantillonnée reste
celle de la track `avatar-gaze` : les fenêtres spontanées du mood et les
marqueurs d'une motion de geste ne l'annulent pas. Les profils `idle`,
`speaking` et `listening` règlent les probabilités des animations spontanées
TalkingHead et leur mouvement de tête ; sans valeur auteur, ils reprennent les
valeurs TalkingHead. `ignoreCamera` sélectionne la direction avant au lieu de
la caméra.
La participation de la tête réglée par `avatar-gaze` reste indépendante du
mouvement spontané de tête du mood : désactiver ce dernier ne coupe pas le
suivi de la caméra. Le marqueur `headMove` intégré dans une motion de geste ne
remplace pas la force de suivi réglée par le perso `avatar-gaze`. Un geste emoji
TalkingHead peut toutefois demander temporairement la cible caméra ; cette
exception de cible utilise le même service de regard et respecte `ignoreCamera`.

Les actions `avatar:gaze:on` et `avatar:gaze:off` sélectionnent la contrainte ;
`contact`, `headMove` et `durationMs` sont des données de l'occurrence. Une
durée positive interpole la force du contact sur le temps absolu CodPlay avec
l'easing TalkingHead. Pendant une désactivation, la contrainte reste active
jusqu'au terme de la transition, pour que la tête et les yeux reviennent
progressivement. Une durée nulle applique le changement immédiatement.
Lorsqu'une action interrompt une transition, sa valeur source est celle
échantillonnée à son propre `startAt` dans l'historique de la track regard.
Le changement de cible conserve aussi sa cible source dans l'instruction
transmise au moteur natif ; un Seek direct ne dépend pas de sa cible précédente
en mémoire.

La cible `camera` ou `ahead` et le template fini `look-ahead` appartiennent au
même circuit de regard. Une action future ne modifie pas la cible avant son
`startAt`. Le même historique produit le même échantillon en Play, Seek et
replay. Le regard n'interprète ni les visèmes, ni les mots, ni les actions de
mood ou de geste comme ses propres instructions. La cible caméra temporaire
d'un geste emoji reste l'exception définie plus haut ; elle passe par le même
service de regard.
Pour une animation d'entrée, le déplacement racine de la date courante est
appliqué avant le calcul du regard. Le calcul met à jour les matrices des
parents des yeux, de la tête et de la caméra avant de résoudre la direction ;
il ne dépend donc pas du dernier temps présenté.

## Validation

Les tests autonomes vérifient les transitions de contact et de cible, le
retour temporel et la correction tête/yeux. La scène Avatar vérifie dans
Safari TP les actions de regard sur le modèle chargé, leur coexistence avec
mood, lip-sync et gesture, ainsi que Play, Seek et rechargement. Le suivi de
cette intégration reste dans le plan Avatar.

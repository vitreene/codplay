# CodPlay V2 — articulation des visèmes Avatar

## Rôle

`avatar-lip-sync` reçoit les événements ordinaires `avatar:viseme` et fournit
au coordonnateur Avatar une timeline de morphs indexée sur le temps absolu
CodPlay. Il ne possède ni horloge, ni rendu, ni accès direct au modèle Three.
Le composant central `avatar` présente cette contribution dans son flux unique.

## Enveloppe temporelle

Une occurrence porte le visème, sa durée optionnelle et son poids optionnel.
Le morph et son intensité de pic suivent la table canonique du composant.
L'occurrence ne peut agir avant sa date `startAt`, car le composant ne reçoit
pas les événements futurs. Sa valeur commence à zéro à cette date, atteint le
pic par l'easing TalkingHead après une montée d'au moins `60 ms`, puis revient
à zéro avec au moins `60 ms` après la fin nominale. Une durée absente emploie
la durée par défaut du composant.

Les morphs de visèmes différents peuvent contribuer simultanément. Deux
occurrences du même morph se composent par leur valeur maximale à chaque
date : l'arrivée de la seconde ne coupe pas la sortie de la première. Un
visème nul n'ouvre aucun nouveau morph et laisse les enveloppes antérieures
terminer leur sortie. Il ne change ni le mood, ni la pose, ni le regard, ni le
comportement spontané. Les visèmes sont les seules instructions de ce perso ;
une piste de mots ou de sous-titres n'est pas une instruction Avatar. Un même
temps absolu produit les mêmes valeurs en Play, Seek et replay, sans état de
file mutable.

Tant que le perso lip-sync est présent, sa couche garde `jawOpen` et
`mouthOpen` à zéro : les formes de visème portent l'articulation parlée. Un
visème nul peut ainsi refermer la bouche même lorsqu'un geste demande une
ouverture. Les morphs de sourire du mood ou du geste restent indépendants et
conservent leur expression sur une bouche fermée.

## Composition avec les gestes

Le coordonnateur applique immédiatement les valeurs échantillonnées de
parole aux morphs du modèle. L'easing natif reste réservé aux cibles de geste.
Si parole et geste visent le même morph, la parole a priorité pendant sa
contribution ; à sa libération, le morph rejoint la cible du geste par
l'easing natif. Sans cible de geste, la libération de parole remet le morph à
sa baseline. Un retour temporel reconstruit les couches avant le commit de
la frame Avatar.
Les deux ouvertures de bouche restent prises par le lip-sync pendant toute la
présence de sa timeline ; elles ne sont libérées qu'avec cette contribution.

## Validation

Les tests autonomes du composant couvrent le début, le pic, la sortie et le
recouvrement de deux occurrences, sans dépendre des données de la démo. Les
tests du coordonnateur couvrent l'intensité de parole, l'easing des gestes et
le changement de propriétaire d'un morph, y compris la fermeture des deux
ouvertures face à un geste souriant, en Play et Seek. La démo Avatar vérifie
le parcours réel eventime, player, composant, modèle chargé et audio dans
Safari TP ; son suivi d'intégration reste dans le plan Avatar.

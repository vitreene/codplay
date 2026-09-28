# CodPlay V2 — animations liées à l'Avatar

## Rôle et surface auteur

`avatar.initial.animations` associe un nom à un clip GLB ou FBX préchargé.
`avatar-motion`, relié par `rel.target`, choisit ce clip avec son initial
`motion` ou les actions `avatar:motion:<nom>` et `avatar:motion:release`.
L'occurrence peut régler la durée, la vitesse et la boucle. Le composant ne
possède ni modèle, ni mixer, ni scène ; il transmet sa sélection au
coordonnateur. Seul le composant `avatar` écrit la pose finale dans le flux
commun `avatar-coordinate`.

## Lecture et composition

Le loader Three.js normalise les noms d'os Mixamo et les positions FBX. Le
lecteur échantillonne le clip au temps absolu CodPlay, puis le compose avec la
pose sémantique, les deltas de geste, le regard et l'équilibre hanches/pieds.
Une animation entre depuis la pose sémantique pendant `1 000 ms` par défaut ;
une pose pendant `2 000 ms`. La ressource peut régler `entryTransitionMs`.
À la fin naturelle d'un clip non bouclé, sa pose terminale revient vers la
pose Avatar ; la durée de sortie vaut `400 ms` par défaut. Une action de
release peut choisir sa propre durée. Le calcul hanches/pieds emploie le
repère local de l'armature afin qu'un déplacement de son parent ne change pas
la pose squelettique.

Une ressource avec `rootMotion: 'arrival'` extrait la translation horizontale
de `Hips.position` vers le groupe de présentation. La fin du clip ramène ce
groupe à la position auteur `avatar.initial.position`. La piste squelettique
conserve les rotations et la translation verticale, sans appliquer une seconde
fois la translation horizontale. Cette entrée ne boucle pas ; la forme objet
de `rootMotion` peut régler `easing: 'ease-out'` et `transitionMs`.

Une entrée `arrival` ancre ses pistes locales à la base du modèle chargé,
même si une autre pose a déjà été présentée au moment de sa sélection. Le
mixer Three.js reçoit de nouveaux bindings à chaque échantillon : le
composeur ayant pu réécrire les os entre deux dates, le lecteur ne peut pas
déduire de ses seules valeurs en cache qu'une piste est déjà appliquée.

Le même historique d'actions et la même date donnent la même position du
groupe et la même pose des os en Play, Seek et replay, y compris pendant
l'entrée et le retour. Un seek restaure les bases du modèle avant de
rééchantillonner le clip. Le déplacement du groupe est présenté dans le même
passage que la pose, avant la contrainte de regard qui lit les positions monde.

## Validation

Les tests autonomes couvrent le chargement des clips, la sélection, les
transitions, l'arrivée, l'interruption et l'égalité Play/Seek. La scène
`?demo=avatar-motion` précharge le modèle et `hero-walk.fbx` dans le runtime
réel pour observer le départ, la marche, l'arrivée et le retour à la pose.

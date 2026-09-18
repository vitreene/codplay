# Events V2 demo

## Role

La démo `?demo=events` explique le circuit V2 des événements avec quatre
stories-cadres navigables au clavier. Elle utilise le layout V2 partagé pour la
page, la télécommande, le journal, l'instance, le player et la lecture.

La scène ne démarre pas sa propre lecture. L'hôte injecte l'event d'entrée du
premier cadre, puis les touches `ArrowLeft`, `ArrowRight` et `Enter` passent par
le circuit DOM `Perso.emit -> listen -> strap` déjà utilisé par la démo
`position`.

## Stories

- Une factory produit un contexte d'animation pour chaque cadre. La story-cadre
  possède la borne et la barrière de son contexte ; les cadres 2 à 4 possèdent
  également leur feu. Elle est donc le propriétaire isolé de toutes les actions
  de cette animation. Les quatre contextes restent montés dans le même stage,
  mais un seul est visible à la fois.
- Les commandes d'animation sont propres à leur contexte (`up1`, `down1`,
  `changing1`, puis `up2`, `down2`, `changing2`, etc.). Les boutons continuent
  d'émettre les commandes publiques `up` et `down`; le strap du cadre les traduit
  vers les persos image qu'il possède.
- Chaque story-cadre possède la borne et la barrière de son contexte ; les
  cadres avec feu possèdent aussi leur signal. `upN` anime la rotation de
  `0deg` à `70deg` autour du point gris de l'image.
- Pour les trois premiers cadres, `upN` affiche le feu vert, `changingN` le
  feu orange et `downN` le feu rouge. À l'entrée des deuxième et troisième
  story-cadres, les contextes affichent d'abord leur état initial rouge. Les
  events `up2` et `up3` les font passer au vert.
- Dans le quatrième cadre, `changing4` lance le passage à l'orange. Quand ce
  fade de `300ms` est terminé, `down4` démarre la descente de la barrière.
  `red4` reste émis après `1800ms`. La durée de rotation de la barrière est
  portée à `2100ms`, sans modifier le planning de cet event.
- `events-frame-one` à `events-frame-four` possèdent les textes, les messages,
  les flèches, les boutons et les persos image de leur cadre courant.

Les ressources d'image sont celles du dossier
`packages/demos/public/assets/barrier/`. Le layout précharge le manifeste
dérivé de la scène avant de créer l'instance. Les actions de changement du feu
portent `replace: 'fade-in'` et passent par le preset du module partagé
`replace` : la nouvelle image apparaît au-dessus de l'ancienne, qui reste
opaque jusqu'à la fin de la transition ; le composant image reste inchangé.

## Event paths

Les cadres 1 et 2 planifient leurs messages et flèches à `1000ms`, `1800ms` et
`2600ms`, avec un pas de `800ms`. Dans le premier cadre, l'event `up` est émis
à `1000ms`, puis le strap planifie l'action de la barrière à `3400ms` ; sa
rotation dure `1500ms` et se termine donc à `4900ms`. Dans le deuxième cadre,
le message du `perso feu` apparaît à `1800ms`, celui du `perso barrière` à
`2600ms`, puis le feu reste rouge jusqu'à `3400ms`, quand l'event distribué
atteint la barrière et le feu. Les faits temporels ciblent directement leur
story-cadre, qui est aussi le propriétaire isolé des persos image ; leur
matérialisation ne repasse pas artificiellement par `listen`.

Les boutons `Lever` et `Baisser` émettent respectivement `up` et `down` avec
une visibilité story. Le story-cadre courant écoute ces events et son strap
dispatch les commandes uniques de son contexte.

Dans le quatrième cadre, l’état initial est `up` : la barrière est levée et
le feu est vert. `down` dispatch immédiatement `changing` vers le feu, puis
planifie `down` après le fade de l'orange (`300ms`) et `red` à `1800ms`.
La rotation de la barrière dure `2100ms` et se termine à `2400ms`. Le délai
reste rejouable par le player et par Seek, sans timer local à la démo.

## Presentation invariants

Le stage utilise une grille explicite à deux colonnes : `65%` pour le texte et
les flèches, `35%` pour les illustrations. La colonne image est elle-même une
grille à deux lignes : le feu en haut, la barrière en bas. Les cadres empilés
et les images qui partagent un point de montage utilisent la cellule
`grid-area: 1 / 1`, suivant le modèle de placement de `capsule-automation` ; la
présentation ne recourt pas à `position: absolute` pour ces placements. Le
cadre place les messages à gauche avec un padding de `4rem` en haut et à
gauche. Chaque ligne d'action étend la flèche vers la colonne image : le
message et la flèche restent dans la colonne texte et ne passent jamais sous
une illustration.
La flèche est centrée dans sa colonne, allongée et renforcée pour rester
lisible comme lien visuel. Elle se révèle en `300ms` avec un déplacement de
gauche à droite. Les messages utilisent également une transition d'opacité de
`300ms`. Les points de montage du message et de la flèche
sont des ancres sans boîte
DOM intermédiaire ; les éléments `<code>` et `<span>` restent directement dans
leur ligne. Les lignes d'explication sont resserrées verticalement. Dans le
deuxième cadre, la flèche de l'action du feu reste dans la colonne texte et
pointe horizontalement vers la colonne image, sans modifier l'ordre des events.
Les messages ne sont pas enfermés dans des cartes et les lignes de séparation
sont absentes. La barrière reste en bas à droite et le feu en haut à droite.
Les textes, flèches et persos d'animation sont dédiés au contexte du cadre ;
les contextes non courants restent masqués dans le stage. Chaque changement
de vue réinitialise la story-cadre sortante et active la suivante dans son état
initial déclaré : barrière fermée et feu vert pour le cadre 1, barrière fermée
et feu rouge pour les cadres 2 et 3, barrière levée et feu vert pour le cadre
4. Les règles `enter` et `reset` de la
story-cadre portent cette isolation.

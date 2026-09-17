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

- `events-barrier` possède la borne et la barrière réutilisées par tous les
  cadres. Ses actions internes sont `up` et `down`; `up` anime la rotation de
  `0deg` à `70deg` autour du point gris de l'image.
- `events-signal` possède une seule image réutilisable. Ses actions internes
  sont `down` pour l'image verte, `changing` pour l'image orange et `up` pour
  l'image rouge. À l'entrée de la deuxième story-cadre, son état initial
  `down` est visible : le feu est vert avant l'event `up` planifié.
- `events-frame-one` à `events-frame-four` possèdent uniquement les textes,
  les messages, les flèches et les boutons de leur cadre courant.

Les ressources d'image sont celles du dossier
`packages/demos/public/assets/barrier/`. Le composant `img` remplace le `src`
actif sans créer un second circuit de présentation. Le layout précharge le
manifeste dérivé de la scène avant de créer l'instance ; le contrat `img`
conserve toutefois la création paresseuse d'un nœud natif par source, donc ce
preload ne promet pas à lui seul un changement de source sans flicker.

## Event paths

Les cadres 1 et 2 planifient leurs explications à `2000ms`, `2500ms` et
`3000ms`. Les faits temporels ciblent explicitement les stories concernées;
leur matérialisation ne repasse pas artificiellement par `listen`.

Les boutons `Lever` et `Baisser` émettent respectivement `up` et `down` avec
une visibilité story. Le story-cadre courant écoute ces events et son strap
dispatch les actions vers les stories persistantes.

Dans le quatrième cadre, `up` dispatch immédiatement `changing` vers le feu,
puis planifie `up` avec `context.planned.wait(1000, ...)`. Le délai est donc
rejouable par le player et par Seek, sans timer local à la démo.

## Presentation invariants

Le cadre place les textes à gauche, chaque flèche immédiatement à leur droite,
la barrière en bas à droite et le feu en haut à droite. Les textes et flèches
sont détruits et reconstruits avec le story-cadre; les deux stories d'images
restent réutilisables et sont réinitialisées à l'entrée d'un nouveau cadre.
Chaque changement de vue réinitialise les deux animations : barrière fermée
(`down`) et feu vert (`down`); le feu est ensuite masqué pour le premier cadre
et visible pour les suivants. Ce reset passe par un event de scène avec
`reset: true` sur les deux stories persistantes.

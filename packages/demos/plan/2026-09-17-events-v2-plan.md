# Démo events — plan V2

> Statut : En cours
> Version CodPlay : V2 foundation

Cette démo est une fixture indépendante consacrée au circuit
`event -> listen -> strap -> action`. Elle reprend le dispositif de navigation
de la démo `position` sans importer sa scène, ses stories ou ses constantes.

## Décisions retenues

- La démo est enregistrée séparément sous `?demo=events`.
- La scène possède quatre cadres de présentation, parcourus par les touches
  clavier du circuit V2 existant : émission, distribution, émission par
  boutons et événements différés.
- Le layout partagé V2 reste propriétaire de la page, de la télécommande, du
  journal, de l'instance et de la durée de vie du player. La scène ne lance
  jamais elle-même la lecture.
- Le cadre actif est activé par un event injecté par l'hôte, puis la
  navigation passe par `Perso.emit -> listen -> strap -> events`, comme dans
  `position`.
- Les textes, les flèches et les persos d'animation appartiennent au
  story-cadre courant. Une factory produit un contexte d'animation par cadre ;
  chaque contexte possède ses propres events (`up1`, `down1`, `changing1`,
  etc.) et reste isolé par l'activation de sa story-cadre.
- Les commandes publiques des boutons sont `up` et `down`, avec les libellés
  « Lever » et « Baisser ». La factory les traduit vers les commandes internes
  propres à chaque contexte (`up1`, `down1`, `up2`, `down2`, etc.).
- Les couleurs `vert`, `orange` et `rouge` sont des valeurs explicatives dans
  les messages. Les actions du perso feu sont respectivement `down`,
  `changing` et `up`.
- À l'entrée de la deuxième story-cadre, le feu affiche immédiatement son
  état initial vert (`down`) avant l'event `up` planifié.
- À chaque changement de vue, la story-cadre sortante est réinitialisée et la
  story-cadre entrante est activée avec `reset: true`; la factory rend visible
  uniquement le contexte entrant. Le feu est masqué uniquement dans le premier
  cadre.
- Le layout précharge les cinq URLs d'image dérivées de tous les `src` présents
  dans les persos du `CompiledScene` avant de créer l'instance. Les changements
  `vert -> orange -> rouge` passent ensuite par le module `replace` partagé.
- La barrière pivote de 0 à 70 degrés vers le haut à gauche, autour du point
  gris présent dans l'image, en `1500ms`, avec l'ease `inOutBack(1.7)` pour
  obtenir un départ progressif, une accélération et un léger rebond en fin de
  course. Le point de transformation sera ajusté visuellement dans le CSS.
- La présentation place les textes et messages sans cadre ni ligne à gauche,
  avec un padding de `4rem` en haut et à gauche. La grille du stage réserve
  `65%` au texte et `35%` aux images ; la colonne image est divisée en deux
  lignes, feu puis barrière. Les cadres et les images empilés utilisent la
  cellule `grid-area: 1 / 1`, conformément au modèle de placement de
  `capsule-automation`, sans `position: absolute` pour le layout.
- Dans les deux premières vues, les messages successifs apparaissent à
  `1000ms`, `1800ms` et `2600ms` ; les flèches apparaissent avec leur message
  d'action en glissant de gauche à droite, puis l'animation commence à
  `3400ms`. Les textes et les flèches se révèlent sur `300ms`.
- Dans la quatrième vue, `up` lance la barrière et la séquence du feu :
  `changing` pendant 1 seconde, puis `up`. Les actions différées passent par
  les helpers `planned` du strap, sans timer de démo.
- Les événements temporels des cadres sont des faits planifiés et ciblés vers
  leur story-cadre propriétaire ; ils ne repassent pas artificiellement par
  `listen` au moment où ils sont matérialisés. Les boutons, eux, exercent le
  circuit live `Perso.emit -> listen -> strap -> event`.

## Travaux

1. Construire le stage et le circuit de navigation de la nouvelle scène.
2. Construire la factory des persos barrière par cadre et leur rotation.
3. Construire la factory des persos feu par cadre et le remplacement de leur
  `src`.
4. Construire les quatre stories-cadres avec leurs textes, flèches,
   eventimes, boutons et straps.
5. Enregistrer la démo, précharger les ressources déclarées et valider le
  parcours réel Play, Seek, changement de vue, resize, lifecycle, typecheck
  et build.

## Suivi d'implémentation

- Les points 1 à 4 sont implémentés dans `src/v2/demos/events/` et enregistrés
  indépendamment dans le registry V2.
- Le core expose le preset `replace: 'fade-in'` en plus de `fade`. Le test du
  module vérifie que la nouvelle représentation apparaît au-dessus de l'ancien
  snapshot, que celui-ci reste opaque pendant la transition, puis qu'il est
  retiré.
- Le test façade `packages/codplay/tests/facade/events-demo.spec.ts` valide le
  preload réel du manifeste events avant l'instance, puis le premier cadre
  planifié, la distribution du deuxième et le délai du quatrième sur le vrai
  player HTML V2.
- La présentation des messages est sans cartes ni séparateurs ; les flèches
  relient maintenant explicitement les actions aux animations. Les lignes sont
  resserrées verticalement et la grille réserve une colonne aux illustrations
  pour éviter les superpositions. La flèche du feu du deuxième cadre suit la
  position haute du feu. La rotation de la barrière dure `1500ms` avec
  `inOutBack(1.7)`.
- La validation navigateur complète reste à faire; le statut demeure donc
  `En cours`.

## Critère de sortie de la première tranche

- aucun fichier de `position` n'est modifié ;
- le build compile la nouvelle scène par le catalogue et le player V2 uniques ;
- les images sont materialisées par le composant `img` V2 ;
- les boutons `Lever` et `Baisser` traversent le circuit DOM, `listen`,
  `strap` et action ;
- les événements temporels des deux premiers cadres sont matérialisés depuis
  leurs faits planifiés ciblés vers leurs propres stories-cadres propriétaires ;
- un événement planifié d'un cadre précédent ne modifie pas le contexte du cadre
  courant lors d'un changement rapide de vue ;
- `changing` est produit par le strap du quatrième cadre, puis `up` est
  planifié à +1 s et rejoué par Seek sans circuit parallèle ;
- le statut reste `En cours` tant que la validation navigateur complète n'est
  pas effectuée.

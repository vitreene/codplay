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
- Les textes et les flèches appartiennent au story-cadre courant. Les images
  de la barrière et du feu sont portées par deux stories d'animation
  persistantes et réutilisées par les quatre cadres.
- Les noms internes des commandes sont `up` et `down`. Les libellés publics
  des boutons sont « Lever » et « Baisser ».
- Les couleurs `vert`, `orange` et `rouge` sont des valeurs explicatives dans
  les messages. Les actions du perso feu sont respectivement `down`,
  `changing` et `up`.
- À l'entrée de la deuxième story-cadre, le feu affiche immédiatement son
  état initial vert (`down`) avant l'event `up` planifié.
- À chaque changement de vue, les deux stories d'animation sont réinitialisées
  par leur event de scène `reset: true`; le feu est masqué uniquement dans le
  premier cadre.
- Le layout précharge les cinq URLs d'image dérivées du `CompiledScene` avant
  de créer l'instance. Le flicker éventuel au premier changement de source
  reste lié à la création paresseuse du nœud `img` et ne doit pas être masqué
  par un circuit de démo parallèle.
- La barrière pivote de 0 à 70 degrés vers le haut à gauche, autour du point
  gris présent dans l'image. Le point de transformation sera ajusté
  visuellement dans le CSS.
- La présentation place les textes et messages à gauche, les flèches à leur
  droite, la barrière en bas à droite et le feu en haut à droite.
- Dans la quatrième vue, `up` lance la barrière et la séquence du feu :
  `changing` pendant 1 seconde, puis `up`. Les actions différées passent par
  les helpers `planned` du strap, sans timer de démo.
- Les événements temporels des cadres sont des faits planifiés et ciblés vers
  les stories d'animation ; ils ne repassent pas artificiellement par `listen`
  au moment où ils sont matérialisés. Les boutons, eux, exercent le circuit
  live `Perso.emit -> listen -> strap -> event`.

## Travaux

1. Construire le stage et le circuit de navigation de la nouvelle scène.
2. Construire la story persistante de la barrière et sa rotation.
3. Construire la story persistante du feu et le remplacement de son `src`.
4. Construire les quatre stories-cadres avec leurs textes, flèches,
   eventimes, boutons et straps.
5. Enregistrer la démo, précharger les ressources déclarées et valider le
  parcours réel Play, Seek, changement de vue, resize, lifecycle, typecheck
  et build.

## Suivi d'implémentation

- Les points 1 à 4 sont implémentés dans `src/v2/demos/events/` et enregistrés
  indépendamment dans le registry V2.
- Le test façade `packages/codplay/tests/facade/events-demo.spec.ts` valide le
  premier cadre planifié, la distribution du deuxième et le délai du quatrième
  sur le vrai player HTML V2.
- La validation navigateur complète reste à faire; le statut demeure donc
  `En cours`.

## Critère de sortie de la première tranche

- aucun fichier de `position` n'est modifié ;
- le build compile la nouvelle scène par le catalogue et le player V2 uniques ;
- les images sont materialisées par le composant `img` V2 ;
- les boutons `Lever` et `Baisser` traversent le circuit DOM, `listen`,
  `strap` et action ;
- les événements temporels des deux premiers cadres sont matérialisés depuis
  leurs faits planifiés ciblés ;
- `changing` est produit par le strap du quatrième cadre, puis `up` est
  planifié à +1 s et rejoué par Seek sans circuit parallèle ;
- le statut reste `En cours` tant que la validation navigateur complète n'est
  pas effectuée.

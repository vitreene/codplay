# Démos FLIP du runner HTML

Status: Fixe — enregistré dans le registry V2
CodPlay version: V2 foundation
Review: gabarit de validation validé le 2026-08-20; cette démo ne constitue pas le renderer de production

## Rôle

Cette source de validation compile des `SceneDoc` déclaratifs et les présente avec
`HtmlPlayerRunner`. Elle n'implémente ni capture, ni mutation DOM, ni boucle de
rendu parallèle : tout le mouvement appartient au runner V2.

La source est chargée par les entrées `runner` et `flip-nested` du registry
commun. Son `main.ts` fournit uniquement les deux `SceneDoc`; le layout commun
crée l'engine, le player, le runner et la télécommande.

Deux scénarios exposent les usages distincts du même graphe :

- `List / local movement` : A appartient déjà à la liste et passe de la dernière
  à la première position à `800 ms`. Aucun `flipMode` n'est déclaré ; la target
  inchangée sélectionne automatiquement le mode local pour A, B et C.
- `flip imbriqué` : P change de conteneur et Q change d'outlet dans P. Sans
  `flipMode`, leur changement de cible impose une présentation reparent dans
  l'overlay, tandis que B et C restent des reflows locaux.

Dans les deux scénarios, la transition dure `1400 ms`. FIRST est l'état exact
avant l'événement et LAST est la mesure géométrique à la fin de la transition.
L'état structurel commis au démarrage est distinct de cette mesure d'endpoint :
`afterStart` sert aux reflows qui existent dès le départ, tandis que le mover
direct conserve sa cible et ses dimensions LAST. Play et Seek évaluent le même
graphe de mouvement à l'instant demandé.

Dans `flip imbriqué`, l'enfant Q entre dans un outlet qui est vide au FIRST et
plus haut au LAST. Le parent P adopte donc la hauteur naturelle de sa cible et
la présentation interpole cette hauteur avec le reste de sa pose ; aucune
hauteur fixe ne masque ce changement. Le mode compact du CSS réduit seulement
la mise en page de la fixture lorsque la fenêtre est très courte. À largeur
étroite, l'endpoint de Q devient proportionnel à la largeur disponible et son
rembourrage est retiré : Q peut donc réellement réduire au LAST au lieu de
grandir à cause du minimum de `3rem` du bureau. À hauteur courte, l'outlet
utilise la hauteur disponible et P ne peut pas être contracté sous le contenu
de Q ; le parent ne coupe donc pas l'enfant.

## Vérifications manuelles

1. Ouvrir `http://localhost:5173/?demo=runner` et vérifier à `0 ms` l'ordre
   `[B, C, A]`.
2. Vérifier à `1500 ms` l'ordre DOM `[A, B, C]`, A visuellement en première
   position et l'absence de représentation overlay.
3. Vérifier à `2200 ms` l'ordre `[A, B, C]` sans transform transitoire.
4. Ouvrir `http://localhost:5173/?demo=flip-nested` et vérifier à `1500 ms`
   deux représentations overlay indépendantes pour P et Q, et des déplacements
   locaux pour B et C.
5. Vérifier à `2200 ms` que l'overlay est vide, que les sources sont visibles et
   que Q est monté dans le dernier outlet de P.
6. Comparer Play et Seek au même instant : rectangles et matrices doivent être
   identiques.
7. Redimensionner le viewport : le graphe est remesuré sans créer de doublons.
8. Réduire la fenêtre jusqu'à `500 × 300` : la page ne doit pas défiler, la
   scène doit garder une hauteur non nulle et les items de la liste doivent
   rester visibles dans leur cadre.
9. À largeur `360 px` avec une hauteur suffisante, vérifier que Q passe d'une
   hauteur FIRST supérieure à sa hauteur LAST et qu'il reste visible après la
   fin de l'overlay.
10. Tester une hauteur extrême : l'en-tête, une scène visible et la
   télécommande essentielle restent présents sans défilement de la page.

La scène et le panneau de logs du layout commun gardent les erreurs de build,
d'initialisation et de lecture observables sans recréer un circuit de runner.

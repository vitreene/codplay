# HTML runner validation demo

Status: Fixe — enregistré dans le registry V2
CodPlay version: V2 foundation
Review: gabarit de validation validé le 2026-08-20; cette démo ne constitue pas le renderer de production

## Rôle

Cette source de validation compile des `SceneDoc` déclaratifs et les présente avec
`HtmlPlayerRunner`. Elle n'implémente ni capture, ni mutation DOM, ni boucle de
rendu parallèle : tout le mouvement appartient au runner V2.

La source est chargée par les entrées `runner` et `runner-overlay` du registry
commun. Son `main.ts` fournit uniquement les deux `SceneDoc`; le layout commun
crée l'engine, le player, le runner et la télécommande.

Deux scénarios exposent les usages distincts du même graphe :

- `List / local movement` : A appartient déjà à la liste et passe de la dernière
  à la première position à `800 ms`. Aucun `flipMode` n'est déclaré ; la target
  inchangée sélectionne automatiquement le mode local pour A, B et C.
- `Nested reparent / overlay` : P change de container et Q change d'outlet dans
  P. Sans `flipMode`, leur changement de target impose une présentation reparent
  dans l'overlay, tandis que B et C restent des reflows locaux.

Dans les deux scénarios, la transition dure `1400 ms`. FIRST est l'état exact
avant l'événement et LAST son état structurel immédiatement après. Play et Seek
évaluent le même graphe de mouvement à l'instant demandé.

## Vérifications manuelles

1. Ouvrir `http://localhost:5173/?demo=runner` et vérifier à `0 ms` l'ordre
   `[B, C, A]`.
2. Vérifier à `1500 ms` l'ordre DOM `[A, B, C]`, A visuellement en première
   position et l'absence de représentation overlay.
3. Vérifier à `2200 ms` l'ordre `[A, B, C]` sans transform transitoire.
4. Ouvrir `http://localhost:5173/?demo=runner-overlay` et vérifier à `1500 ms`
   deux représentations overlay indépendantes pour P et Q, et des déplacements
   locaux pour B et C.
5. Vérifier à `2200 ms` que l'overlay est vide, que les sources sont visibles et
   que Q est monté dans le dernier outlet de P.
6. Comparer Play et Seek au même instant : rectangles et matrices doivent être
   identiques.
7. Redimensionner le viewport : le graphe est remesuré sans créer de doublons.

La scène et le panneau de logs du layout commun gardent les erreurs de build,
d'initialisation et de lecture observables sans recréer un circuit de runner.

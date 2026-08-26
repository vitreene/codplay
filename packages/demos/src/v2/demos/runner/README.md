# HTML runner validation demo

Status: Fixe
CodPlay version: V2 foundation
Review: gabarit de validation validé le 2026-08-20; cette démo ne constitue pas le renderer de production

## Rôle

Cette source de validation compile des `SceneDoc` déclaratifs et les présente avec
`HtmlPlayerRunner`. Elle n'implémente ni capture, ni mutation DOM, ni boucle de
rendu parallèle : tout le mouvement appartient au runner V2.

La source a été déplacée sous l'arborescence des démos V2. Elle n'est pas encore
une entrée du registre commun : son `main.ts` conserve deux scénarios et leur
orchestration de page, qui seront repris séparément par le layout V2.

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

1. Dans `List / local movement`, vérifier à `0 ms` l'ordre `[B, C, A]`.
2. Vérifier à `1500 ms` l'ordre DOM `[A, B, C]`, A visuellement en première
   position et l'absence de représentation overlay.
3. Vérifier à `2200 ms` l'ordre `[A, B, C]` sans transform transitoire.
4. Dans `Nested reparent / overlay`, vérifier à `1500 ms` deux représentations
   overlay indépendantes pour P et Q, et des déplacements locaux pour B et C.
5. Vérifier à `2200 ms` que l'overlay est vide, que les sources sont visibles et
   que Q est monté dans le dernier outlet de P.
6. Comparer Play et Seek au même instant : rectangles et matrices doivent être
   identiques.
7. Redimensionner le viewport : le graphe est remesuré sans créer de doublons.

La ligne de statut expose l'ordre logique, les régimes effectifs et le nombre de
représentations overlay afin que les invariants restent directement observables.

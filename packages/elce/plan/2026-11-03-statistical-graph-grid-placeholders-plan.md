# Plan — placeholders compacts de la grille Graphe

**Statut : En cours — les placeholders compacts sont implémentés ; leur rendu
dans l’éditeur réel reste à valider avant mise à jour de la spécification.**

## Contrat accepté

- Les cellules d’intitulé vides affichent `Cat. A`, `Cat. B`, `Cat. C`… pour
  les catégories, et `Ser. 1`, `Ser. 2`, `Ser. 3`… pour les séries.
- Ces indications sont en italique, sans graisse, et restent des placeholders ;
  elles ne changent pas les valeurs enregistrées ni les noms accessibles.

## Travail et acceptation

- [x] Séparer les placeholders courts des noms accessibles complets dans les
  champs d’intitulé.
- [x] Appliquer l’italique et une graisse normale aux seuls placeholders.
- [ ] Vérifier le rendu des intitulés vides et saisis dans l’éditeur Graphe,
  notamment les catégories après `Z`.
- [ ] Reporter le comportement dans la
  [spécification du Graphe](../specs/statistical-graph-spec.md) après
  vérification.

# Plan — placeholders compacts de la grille Graphe

**Statut : En cours — les placeholders compacts et les noms de repli distincts
sont implémentés ; leur rendu dans l’éditeur réel reste à valider avant mise à
jour de la spécification.**

## Contrat accepté

- Les cellules d’intitulé vides affichent `Cat. A`, `Cat. B`, `Cat. C`… pour
  les catégories, et `Ser. 1`, `Ser. 2`, `Ser. 3`… pour les séries.
- Ces indications sont en italique, sans graisse, et restent des placeholders ;
  elles ne changent pas les valeurs enregistrées ni les noms accessibles.
- Les sélecteurs Secteurs réutilisent les mêmes noms de repli pour les entrées
  vides : `Cat. A`, `Cat. B`… et `Ser. 1`, `Ser. 2`… Les noms saisis restent
  prioritaires et les libellés accessibles des champs restent complets.
- Les fonctions de nommage catégorie/série sont partagées par la grille et les
  sélecteurs. Les catégories suivent les lettres de tableur au-delà de `Z`.

## Travail et acceptation

- [x] Séparer les placeholders courts des noms accessibles complets dans les
  champs d’intitulé.
- [x] Appliquer l’italique et une graisse normale aux seuls placeholders.
- [ ] Vérifier dans l’éditeur Graphe les intitulés vides et saisis dans la
  grille et les sélecteurs Secteurs, notamment les catégories après `Z`.
- [ ] Reporter le comportement dans la
  [spécification du Graphe](../specs/statistical-graph-spec.md) après
  vérification.

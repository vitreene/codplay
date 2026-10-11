# Elcé — BDC Graphe statistique

## Statut

**Fixe — modèle, éditeur, rendus et placements vérifiés dans les circuits Elcé
existants.** Le graphe peut être un BDC direct de Flux ou Diapo, un enfant de
Carousel, ou un BDC ancré dans une Section.

## Modèle et édition

`StatisticalGraphContent` porte les textes éditoriaux, les libellés des axes,
le type de rendu, les catégories, les séries, les valeurs et la série choisie
pour les secteurs. Les catégories et séries ont des identifiants stables ; une
cellule vide n’a pas de valeur stockée, tandis que zéro reste une valeur.
À la création, l’éditeur prépare quatre catégories et deux séries, soit une
grille de 5 × 3 avec la ligne et la colonne d’en-tête. Les graphes déjà
enregistrés conservent leurs dimensions : ce réglage initial ne les agrandit
pas.

Le modèle accepte jusqu’à 40 catégories et 40 séries. La grille inclut une
ligne et une colonne d’en-tête ; le collage maximal est donc de 41 × 41. Un
collage remplace toute la matrice et un collage trop grand est refusé sans
modification partielle. L’éditeur extrait les cellules tabulaires simples,
qu’elles arrivent sous forme tabulée ou CSV-like ; il n’interprète pas les
formules ni les formats propres à Excel.

Les commandes et façades Elcé existantes enregistrent l’édition dans le
document. L’auteur peut modifier les textes, libellés, cellules, rendu et
layout. Il y a toujours au moins une catégorie et une série. Les nombres
acceptent les virgules décimales et les valeurs négatives. Les secteurs ne
représentent que les valeurs positives ; une cellule absente reste vide et est
ignorée dans les rendus graphiques.

Le formulaire sépare les titres et le commentaire, les réglages de représentation,
puis le « Tableau de saisie ». Dans la grille, les catégories occupent les lignes,
les séries les colonnes et les valeurs leurs intersections. Les commandes d’ajout
et de suppression sont placées au contact de la grille ; la dernière catégorie et
la dernière série ne peuvent pas être supprimées.

SQLite conserve le contenu dans `statistical_graphs`, les catégories et les
séries dans leurs tables ordonnées, et uniquement les cellules numériques
présentes dans `graph_values`. Le placement reste celui du BDC générique.

## Rendu

Les modes sont `bar`, `line`, `pie` et `table`. Barres, courbes et secteurs
sont dessinés en SVG sans bibliothèque de graphique. Leur image porte un nom
accessible lié au titre et une courte description ; le même modèle fournit
une table HTML sémantique accessible. Le mode Tableau n’émet pas de SVG et
affiche cette matrice HTML avec ses libellés, son `caption` et ses en-têtes
scopés.

Dans les graphiques, les libellés denses sont espacés automatiquement : tous
jusqu’à 10 entrées, un sur cinq jusqu’à 20, puis un sur dix, avec le dernier
libellé conservé. Le tableau sémantique donne accès à toutes les données.

Dans le tableau visible, toute la matrice partage une seule taille de police,
calculée d’après les cellules les plus contraignantes. Le texte peut devenir
très petit dans une matrice dense ; le contenu n’est pas tronqué. Le navigateur
et son zoom permettent d’agrandir la lecture. À partir de 12 lignes ou colonnes,
les en-têtes de série sont orientés verticalement et la taille s’adapte à la
zone disponible. Les tableaux ne défilent pas à l’intérieur de leur zone.

## Layout et placements

Le layout présente le graphe au-dessus du commentaire éditorial ou à côté de
lui. La disposition côte à côte devient une colonne sur écran mobile, avec le
commentaire sous le graphe. Les proportions et le seuil suivent les réglages
communs de l’application et sa grille CSS existante.

Le BDC reprend les builders de page existants pour un placement direct dans
Flux ou Diapo. Carousel le séquence par identifiant dans sa liste de vues. Dans
une Section, le BDC quitte le catalogue, devient enfant de la Section, puis le
builder Flux monte ce même BDC dans le slot d’ancre existant ; aucune voie
d’insertion parallèle n’est créée.

La réserve du slot suit le rendu : le Tableau prend sa hauteur naturelle et
réserve `100%` de la largeur de ligne ; les rendus SVG réservent `56.25%`. Le
slot existant est réorganisé par le layout CodPlay. Le cœur CodPlay n’a pas été
modifié.

## Preuves

- [`statistical-graph-service.test.ts`](../src/domain/statistical-graph/statistical-graph-service.test.ts)
  couvre la grille, les nombres et le remplacement de matrice.
- [`statistical-graph-scene-builder.test.ts`](../src/builders/statistical-graph/statistical-graph-scene-builder.test.ts)
  couvre les quatre rendus, l’alternative accessible et le choix d’une taille
  commune selon le contenu le plus contraignant.
- [`statistical-graph-placements.test.ts`](../src/builders/statistical-graph/statistical-graph-placements.test.ts)
  compile les placements Flux, Diapo, Carousel et Section par les builders et
  le runtime CodPlay réels.
- [`sqlite-project-persistence.test.ts`](../src/server/projects/sqlite/sqlite-project-persistence.test.ts)
  vérifie l’aller-retour SQLite du Graphe statistique.
- [`remix-statistical-graph-editor.test.tsx`](../src/app/editor/statistical-graph/remix-statistical-graph-editor.test.tsx)
  vérifie la saisie contrôlée et le refus atomique d’un collage trop grand.
- Brave, sur le projet de test temporaire, affiche une matrice 40 × 40 ancrée
  dans une Section. À 390 × 844, la table fait `300 × 135.42 px`, la réserve
  `300 × 332 px` et le texte suivant reprend au bas du slot ; la taille commune
  est `1.575 px`. À 1280 × 900, la table fait `918 × 292.52 px` et la taille
  commune est `4.82 px`. Les 1 681 cellules sont présentes, aucune plage de
  texte ne déborde de sa cellule, la page ne déborde pas et la console Brave
  est vide.
- Le 9 octobre 2026, Brave sur `5175` montre le formulaire en sections et sa
  grille éditable avec les libellés de lignes et colonnes. Ajouter puis
  supprimer une ligne et une colonne met à jour la grille ; la dernière entrée
  reste protégée. La console est vide.
- Le 9 octobre 2026, dans Projet 1, la création d’un Graphe dans le Carousel
  de la Page B affiche quatre lignes de catégories et deux colonnes de séries
  (5 × 3 en-têtes compris). Le graphe temporaire est supprimé par son action
  d’édition ; le Carousel retrouve ses cinq vues et l’état repasse à
  « Synchronisé ».
- Les 47 tests ciblés passent ; le typecheck et le build passent. La suite
  complète a 245 tests réussis sur 246 ; le test restant échoue parce que
  l’environnement interdit l’ouverture de son port local (`listen EPERM`),
  dans le test de streaming média SQLite, sans rapport avec ce BDC.

# Elcé — BDC Graphe statistique

## Portée

Ce BDC est envisagé après la migration en cours. Il ne fait pas partie du POC
ni du schéma SQLite actuellement préparé.

## Intention

Le BDC Graphe statistique présente des données sous forme graphique. Son
interface d’édition permet de saisir les données dans un tableau à deux
dimensions, de choisir une représentation — par exemple histogramme, courbes
ou portions circulaires — et de définir un titre et une légende. Le rendu peut
être agrémenté d’animations de construction.

## À définir avant sa réalisation

- La signification des lignes et colonnes du tableau, ainsi que les règles de
  saisie et de validation des valeurs.
- Les représentations proposées dans la première version et la façon dont
  elles interprètent les données du tableau.
- Le caractère facultatif ou obligatoire du titre et de la légende.
- Les contextes où le BDC peut être placé, notamment dans une page Flux, une
  page Diapo ou à l’intérieur d’un autre BDC.
- Les animations de construction disponibles et leur relation avec les
  transitions du projet.
- Les tables relationnelles nécessaires au stockage de ce BDC. Le tableau
  d’édition ne préjuge pas d’un stockage JSON opaque.

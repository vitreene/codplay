# Composant polygon V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `polygon` affiche une forme SVG avec un contenu textuel. Il
reprend la géométrie V1 testée et peut interpoler deux formes pendant une
transition.

## Fonctionnement

Le profil `PolygonInitial` décrit les côtés, les rayons, la rotation,
l'inflexion et le morphing éventuel. La compilation vérifie ce profil et rend
explicites les valeurs numériques nécessaires. Play et Seek évaluent ensuite le
même résultat à partir du temps absolu.

## Organisation interne

- `polygon-types.ts` décrit les données auteur et les états complets ;
- `polygon-validation.ts` vérifie et complète les profils ;
- `polygon-geometry.ts` calcule les sommets, chemins, resamplings et
  interpolations sans connaître le DOM ;
- `polygon-component.ts` applique le chemin et le contenu au SVG ;
- `index.ts` expose le composant et les fonctions géométriques.

## Contrat et limites

La classe runtime ne revalide pas les valeurs auteur. Elle orchestre seulement
la projection SVG et le temps de transition ; les algorithmes géométriques
restent purs et testables séparément.

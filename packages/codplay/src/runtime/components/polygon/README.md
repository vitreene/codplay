# Composant polygon V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `polygon` affiche une forme SVG avec un contenu textuel. Il
reprend la géométrie V1 testée et peut interpoler deux formes pendant une
transition.

## Fonctionnement

Le profil `PolygonInitial` décrit les côtés, les rayons, le diamètre, la
rotation, l'inflexion et le morphing éventuel. La compilation vérifie ce profil
et rend explicites les valeurs auteur. Le composant normalise aussi les valeurs
dynamiques reçues d'un contrôle natif avant de calculer le rendu. Play et Seek
évaluent ensuite le même résultat à partir du temps absolu.

## Organisation interne

- `polygon-types.ts` décrit les données auteur et les états complets ;
- `polygon-validation.ts` vérifie et complète les profils ;
- `polygon-geometry.ts` calcule les sommets, chemins, resamplings et
  interpolations sans connaître le DOM ;
- `polygon-component.ts` applique le chemin, le contenu et les dimensions
  dérivées du diamètre au SVG ;
- `index.ts` expose le composant et les fonctions géométriques.

## Contrat et limites

La classe runtime ne revalide pas les profils auteur. Elle possède les
propriétés propres au polygon : elle normalise les entrées numériques et
projette leurs conséquences SVG/CSS, notamment `diameter` vers `width` et
`height`. Elle réutilise le service `style` existant et ne crée aucun service
spécifique. Les algorithmes géométriques restent purs et testables séparément.

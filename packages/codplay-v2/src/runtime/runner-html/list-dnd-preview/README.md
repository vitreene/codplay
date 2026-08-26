# Prévisualisation HTML des listes V2

> Statut : Fixe
> Version CodPlay : V2 foundation

## Rôle

Ce dossier contient les fonctions spécialisées de la prévisualisation HTML
utilisée pendant un geste de glisser-déposer dans une liste. La prévisualisation
montre un emplacement temporaire, sans modifier encore l'ordre logique.

## Fonctionnement

La géométrie décode le pointeur, teste les zones de dépôt et calcule les slots
d'insertion. Les effets créent le ghost et les styles du nœud flottant. Le
contrôleur principal assemble ces résultats pendant le geste.

## Organisation interne

- `geometry.ts` porte le décodage du pointeur, le hit-test et les slots ;
- `effects.ts` porte les ghosts et les styles du nœud flottant ;
- `types.ts` porte les contrats de prévisualisation et de cible.

## Contrat et limites

Le contrôleur reste limité au HTML. Il ne change ni le placement logique, ni le
journal runtime, ni la capacité `list` ; le commit final repasse par le player.

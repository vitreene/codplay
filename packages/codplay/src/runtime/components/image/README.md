# Composant image V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `img` affiche une image dans un conteneur HTML. Il conserve une
image native par source afin qu'un changement d'URL ne réutilise pas un nœud
ayant déjà porté une autre source.

## Fonctionnement

Le profil `ImageInitial` accepte la source, le texte alternatif et les styles de
la racine ou de l'image interne. `fitMode` ne fait pas partie du contrat V2 ;
le comportement équivalent doit être exprimé dans `img.style.objectFit`.

## Organisation interne

- `image-types.ts` décrit les données initiales et les actions ;
- `image-validation.ts` vérifie ces données à la compilation ;
- `image-component.ts` crée, conserve et rattache les nœuds `<img>` ;
- `index.ts` expose la surface publique du composant.

## Contrat et limites

- une source est affectée une seule fois au nœud créé pour cette source ;
- un changement de source détache l'image active et rattache l'image conservée
  ou nouvellement créée ;
- les nœuds restent conservés pendant un detach ou un seek ;
- la disponibilité de la ressource relève du preload, pas du composant ;
- les champs communs de style viennent de `BaseComponentVisualData`.

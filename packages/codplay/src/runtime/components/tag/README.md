# Composant tag V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `tag` est l'élément HTML générique de CodPlay. Il permet de créer
une balise simple, comme `div`, `section`, `p` ou `h1`, avec les propriétés
visuelles communes.

## Fonctionnement

Le profil `TagInitial` décrit la balise et les données communes de contenu,
classe, style et attributs. La validation vérifie le nom de balise et complète
la valeur absente par `div` avant l'instanciation.

## Organisation interne

- `tag-types.ts` décrit le profil initial et l'état appliqué ;
- `tag-validation.ts` porte la vérification et le default `div` ;
- `tag-component.ts` produit la balise et applique les mises à jour ;
- `index.ts` expose le composant et ses types.

## Contrat et limites

Le composant ne connaît que sa propre racine. Il délègue les classes, styles,
attributs et contenu aux services HTML communs et ne contient pas de validation
dynamique des données auteur.

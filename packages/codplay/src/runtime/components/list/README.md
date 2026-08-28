# Composant list V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

Le composant `list` fournit la racine HTML d'une liste. Il possède son élément
conteneur, mais pas les éléments enfants et ne décide pas de leur ordre.

## Fonctionnement

Le profil `ListInitial` indique la balise racine et les options de réordonnage.
La valeur par défaut est `section`. La capacité `list` reçoit ensuite les
deltas structurels et applique la politique de placement.

## Organisation interne

- `list-types.ts` décrit la racine et `ListConfig` ;
- `list-validation.ts` vérifie le profil et complète la balise par défaut ;
- `list-component.ts` affiche la racine et applique ses propriétés visuelles ;
- `index.ts` expose le composant et les contrats associés.

## Contrat et limites

Le composant ne manipule pas directement ses enfants, ne lit pas le DOM pour
reconstruire l'ordre et ne possède pas de circuit d'animation. L'ordre complet
vient de la scène résolue et est appliqué par le materializer.

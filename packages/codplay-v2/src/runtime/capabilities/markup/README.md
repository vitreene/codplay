# Capacité markup V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

La capacité `markup` enregistre les parties d'un composant que d'autres
éléments peuvent utiliser comme points d'insertion. Elle fait le lien entre le
composant et la couche qui transforme son HTML ou son SVG en nœuds affichés.

Elle ne crée pas les composants et ne décide pas de leur contenu. Elle conserve
uniquement les déclarations de points publiés et permet au lecteur de les
retrouver.

## Fonctionnement

Lorsqu'un composant est affiché, `materializeComponentWithMarkup()` :

1. mémorise sa racine, ou la liste ordonnée de ses racines lorsqu'il s'agit
   d'un fragment ;
2. enregistre les parties que la définition du composant autorise à publier ;
3. retourne une fonction qui supprimera ces enregistrements lors du démontage.

Le lecteur récupère ensuite les cibles avec `getMountTargets()` et les combine
avec les cibles de son propre conteneur avant de résoudre la scène.

## Organisation interne

`MarkupCapabilityState` conserve l'état d'un composant. La définition créée par
`createMarkupModuleServiceDefinition()` est enregistrée dans le catalogue et
produit une instance par lecteur.

La sanitation des templates est une responsabilité de la compilation de scène,
dans `src/scene/validation/markup-sanitizer.ts`. La capacité `markup` ne
l'exporte pas et ne l'appelle pas.

## Contrat et limites

- une instance de capacité existe par lecteur ;
- les identifiants de cible sont comparés comme des valeurs exactes ;
- un identifiant ne peut apparaître qu'une fois dans une instance ;
- supprimer un composant supprime toutes ses parties publiées ;
- le module ne déduit pas le sens d'un nom de cible ;
- son état est indépendant de l'état logique de la scène ;
- il ne lit pas le DOM, ne monte pas les enfants et ne sanitise pas les templates.
